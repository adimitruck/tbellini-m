import { COLUMNS, CREATOR_COLUMN, RPC, TABLES } from '../../src/infrastructure/supabase-schema';

/**
 * An in-memory stand-in for the hosted database, spoken to through the real supabase-js client over a fake fetch.
 * It mirrors supabase/migrations/20261017000000_shared_space.sql: every signed-in member reads everything, only a
 * record's creator updates or deletes it (other rows are simply invisible to the write), tags need the event's
 * creator, RSVPs are self-only, foreign keys cascade, and clients may not choose server-managed columns.
 */
export type Row = Record<string, string | null>;

export class Failure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const RLS = new Failure(403, '42501', 'new row violates row-level security policy');
const FOREIGN_KEY = new Failure(409, '23503', 'violates foreign key constraint');
const CHECK = new Failure(400, '23514', 'violates check constraint');
const DENIED = new Failure(403, '42501', 'permission denied for column');

const WRITABLE: Record<string, readonly string[]> = {
  [TABLES.events]: ['title', 'description', 'starts_at', 'ends_at', 'timezone', 'location', CREATOR_COLUMN.events],
  [TABLES.people]: [COLUMNS.displayName, 'notes', CREATOR_COLUMN.people],
  [TABLES.tags]: [COLUMNS.eventId, COLUMNS.personId, COLUMNS.taggedBy],
  [TABLES.rsvps]: [COLUMNS.eventId, COLUMNS.userId, COLUMNS.status],
  [TABLES.profiles]: [COLUMNS.displayName],
  [TABLES.claims]: [COLUMNS.personId, COLUMNS.claimantId],
};
const KEYS: Record<string, readonly string[]> = {
  [TABLES.events]: [COLUMNS.id],
  [TABLES.people]: [COLUMNS.id],
  [TABLES.tags]: [COLUMNS.eventId, COLUMNS.personId],
  [TABLES.rsvps]: [COLUMNS.eventId, COLUMNS.userId],
  [TABLES.profiles]: [COLUMNS.id],
  [TABLES.claims]: [COLUMNS.personId, COLUMNS.claimantId],
};
/** Column that restricts who may update or delete a row; rows outside it are invisible to the write. */
const SCOPE: Record<string, string> = {
  [TABLES.events]: CREATOR_COLUMN.events,
  [TABLES.people]: CREATOR_COLUMN.people,
  [TABLES.tags]: COLUMNS.taggedBy,
  [TABLES.rsvps]: COLUMNS.userId,
  [TABLES.profiles]: COLUMNS.id,
  [TABLES.claims]: COLUMNS.claimantId,
};

const postgresInstant = (value: string): string =>
  new Date(value).toISOString().replace(/\.000Z$/, '+00:00').replace('Z', '+00:00');

export class FakeDatabase {
  readonly tables: Record<string, Row[]> = Object.fromEntries(Object.values(TABLES).map((name): [string, Row[]] => [name, []]));
  readonly requests: { method: string; path: string; search: string }[] = [];
  /** Failures to inject, keyed by "METHOD table"; each applies once. */
  readonly injected = new Map<string, Failure>();

  /** Adds a profile and, as the signup trigger does, a Person for it. */
  addMember(id: string, displayName: string): void {
    const now = postgresInstant('2026-10-01T12:00:00Z');
    this.tables[TABLES.profiles].push({ id, display_name: displayName, created_at: now, updated_at: now });
    this.tables[TABLES.people].push({
      id: crypto.randomUUID(), created_by: id, member_id: id, display_name: displayName, notes: null,
      provenance: 'manual', created_at: now, updated_at: now,
    });
  }

  /** A fetch that acts as the signed-in member `userId`. */
  fetchAs(userId: string): typeof fetch {
    return async (input, init): Promise<Response> => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      this.requests.push({ method, path: url.pathname, search: url.search });
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : null;
      const accept = new Headers(init?.headers).get('Accept') ?? '';
      const prefer = new Headers(init?.headers).get('Prefer') ?? '';
      try {
        const result = this.handle(userId, method, url, body, prefer);
        return this.respond(result, accept);
      } catch (failure) {
        if (!(failure instanceof Failure)) throw failure;
        const { status, code, message } = failure;
        return new Response(JSON.stringify({ code, message, details: null, hint: null }), { status });
      }
    };
  }

  private respond(result: unknown, accept: string): Response {
    if (result === null) return new Response(null, { status: 204 });
    if (accept.includes('vnd.pgrst.object+json') && Array.isArray(result)) {
      if (result.length !== 1) {
        const message = 'JSON object requested, multiple (or no) rows returned';
        const body = { code: 'PGRST116', message, details: '', hint: null };
        return new Response(JSON.stringify(body), { status: 406 });
      }
      return new Response(JSON.stringify(result[0]), { status: 200 });
    }
    return new Response(JSON.stringify(result), { status: 200 });
  }

  private handle(uid: string, method: string, url: URL, body: unknown, prefer: string): unknown {
    const target = url.pathname.split('/').pop() ?? '';
    const injected = this.injected.get(`${method} ${target}`);
    if (injected) {
      this.injected.delete(`${method} ${target}`);
      throw injected;
    }
    if (!this.tables[TABLES.profiles].some((profile): boolean => profile.id === uid)) throw RLS;
    if (url.pathname.includes('/rpc/')) return this.rpc(uid, target, body);
    const table = target;
    if (method === 'GET') return this.project(this.filter(table, url), url);
    const wantsRows = prefer.includes('return=representation');
    let rows: Row[];
    if (method === 'POST') rows = this.insert(uid, table, body, prefer);
    else if (method === 'PATCH') rows = this.update(uid, table, body, url);
    else rows = this.remove(uid, table, url);
    return wantsRows ? this.project(rows, url) : null;
  }

  private filter(table: string, url: URL): Row[] {
    let rows = [...this.tables[table]];
    for (const [column, condition] of url.searchParams) {
      if (!condition.startsWith('eq.')) continue;
      const wanted = condition.slice(3);
      rows = rows.filter((row): boolean => row[column] === wanted);
    }
    const order = url.searchParams.get('order');
    if (order) {
      const columns = order.split(',').map((part): string => part.split('.')[0]);
      rows.sort((a, b): number => {
        for (const column of columns) {
          const compared = String(a[column]).localeCompare(String(b[column]));
          if (compared) return compared;
        }
        return 0;
      });
    }
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = url.searchParams.get('limit');
    return rows.slice(offset, limit === null ? undefined : offset + Number(limit));
  }

  private project(rows: Row[], url: URL): Row[] {
    const select = url.searchParams.get('select') ?? '*';
    if (select === '*') return rows.map((row): Row => ({ ...row }));
    const columns = select.split(',');
    return rows.map((row): Row => Object.fromEntries(columns.map((column): [string, string | null] => [column, row[column]])));
  }

  private person(id: string | null): Row | undefined {
    return this.tables[TABLES.people].find((row): boolean => row.id === id);
  }

  /** A claim is withdrawn by its claimant or rejected by the creator of the claimed Person. */
  private scoped(uid: string, table: string, url: URL): Row[] {
    const mayChange = (row: Row): boolean =>
      row[SCOPE[table]] === uid ||
      (table === TABLES.claims && this.person(row[COLUMNS.personId])?.[CREATOR_COLUMN.people] === uid);
    return this.filter(table, url).filter(mayChange);
  }

  private insert(uid: string, table: string, body: unknown, prefer: string): Row[] {
    const inputs = (Array.isArray(body) ? body : [body]) as Row[];
    const inserted: Row[] = [];
    for (const input of inputs) {
      if (Object.keys(input).some((column): boolean => !WRITABLE[table].includes(column))) throw DENIED;
      const existing = this.tables[table].find((row): boolean => KEYS[table].every((key): boolean => row[key] === input[key]));
      if (existing) {
        // Postgres checks the insert policy before it looks for a conflicting row.
        this.authorize(uid, table, input);
        if (prefer.includes('ignore-duplicates')) continue;
        if (!prefer.includes('merge-duplicates')) throw new Failure(409, '23505', 'duplicate key');
        this.authorize(uid, table, { ...existing, ...input });
        Object.assign(existing, input, { updated_at: postgresInstant(new Date().toISOString()) });
        inserted.push(existing);
        continue;
      }
      const row = this.build(uid, table, input);
      this.tables[table].push(row);
      inserted.push(row);
    }
    return inserted;
  }

  private authorize(uid: string, table: string, row: Row): void {
    if (table === TABLES.profiles) throw RLS;
    if (row[SCOPE[table]] !== uid) throw RLS;
    if (table === TABLES.tags) {
      const event = this.tables[TABLES.events].find((item): boolean => item.id === row[COLUMNS.eventId]);
      if (!event) throw FOREIGN_KEY;
      if (event[CREATOR_COLUMN.events] !== uid) throw RLS;
      if (!this.tables[TABLES.people].some((person): boolean => person.id === row[COLUMNS.personId])) throw FOREIGN_KEY;
    }
    if (table === TABLES.claims && this.person(row[COLUMNS.personId])?.member_id !== null) throw RLS;
    if (table === TABLES.rsvps && !this.tables[TABLES.events].some((event): boolean => event.id === row[COLUMNS.eventId])) {
      throw FOREIGN_KEY;
    }
  }

  private build(uid: string, table: string, input: Row): Row {
    const now = postgresInstant(new Date().toISOString());
    const row: Row = { ...input, created_at: now };
    if (table === TABLES.events || table === TABLES.people) {
      Object.assign(row, { id: crypto.randomUUID(), provenance: 'manual', updated_at: now });
    }
    if (table === TABLES.rsvps) row.updated_at = now;
    if (table === TABLES.events) {
      const event: Row = { description: null, ends_at: null, timezone: 'UTC', location: null, ...row };
      const backwards = event.ends_at && Date.parse(event.ends_at) < Date.parse(String(event.starts_at));
      if (!String(event.title ?? '').trim() || backwards) throw CHECK;
      Object.assign(row, event, { starts_at: postgresInstant(String(event.starts_at)) });
      if (row.ends_at) row.ends_at = postgresInstant(row.ends_at);
    }
    if (table === TABLES.people) Object.assign(row, { member_id: null, notes: input.notes ?? null });
    if (table === TABLES.people && !String(input[COLUMNS.displayName] ?? '').trim()) throw CHECK;
    this.authorize(uid, table, row);
    const taken = (other: Row): boolean => other[COLUMNS.claimantId] === row[COLUMNS.claimantId];
    if (table === TABLES.claims && this.tables[table].some(taken)) throw new Failure(409, '23505', 'duplicate key');
    return row;
  }

  private update(uid: string, table: string, body: unknown, url: URL): Row[] {
    const changes = body as Row;
    const forbidden = (column: string): boolean => !WRITABLE[table].includes(column) || column === SCOPE[table];
    if (Object.keys(changes).some(forbidden)) throw DENIED;
    const rows = this.scoped(uid, table, url);
    for (const row of rows) Object.assign(row, changes, { updated_at: postgresInstant(new Date().toISOString()) });
    return rows;
  }

  private remove(uid: string, table: string, url: URL): Row[] {
    const doomed = this.scoped(uid, table, url);
    this.tables[table] = this.tables[table].filter((row): boolean => !doomed.includes(row));
    this.cascade(table, doomed);
    return doomed;
  }

  private cascade(table: string, removed: Row[]): void {
    const ids = new Set(removed.map((row): string | null => row.id));
    if (table === TABLES.events) {
      for (const dependent of [TABLES.tags, TABLES.rsvps]) {
        this.tables[dependent] = this.tables[dependent].filter((row): boolean => !ids.has(row[COLUMNS.eventId]));
      }
    }
    if (table === TABLES.people) {
      for (const dependent of [TABLES.tags, TABLES.claims]) {
        this.tables[dependent] = this.tables[dependent].filter((row): boolean => !ids.has(row[COLUMNS.personId]));
      }
    }
  }

  private rpc(uid: string, name: string, body: unknown): string | null {
    const args = body as Record<string, unknown>;
    if (name === RPC.confirmClaim.name) {
      this.confirmClaim(uid, String(args[RPC.confirmClaim.person]), String(args[RPC.confirmClaim.claimant]));
      return null;
    }
    if (name !== RPC.createInvitation.name) throw new Failure(404, 'PGRST202', 'no such function');
    const days = args[RPC.createInvitation.expiresInDays];
    if (typeof days !== 'number' || days < 1 || days > 30) {
      throw new Failure(400, '22023', 'Invitations expire within 1 to 30 days.');
    }
    const named = args[RPC.createInvitation.forPerson];
    if (named !== undefined && this.person(String(named))?.member_id !== null) {
      throw new Failure(400, '22023', 'Choose a person who is not linked to a member yet.');
    }
    return 'ABCD-2345';
  }

  /** confirm_person_claim(): the creator of an unlinked Person links the claimant and merges their own Person in. */
  private confirmClaim(uid: string, personId: string, claimantId: string): void {
    const claimed = this.person(personId);
    if (!claimed || claimed[CREATOR_COLUMN.people] !== uid || claimed.member_id !== null) {
      throw new Failure(403, '42501', 'Only the creator of an unlinked person can confirm a claim.');
    }
    const pending = (row: Row): boolean => row[COLUMNS.personId] === personId && row[COLUMNS.claimantId] === claimantId;
    if (!this.tables[TABLES.claims].some(pending)) throw new Failure(400, '22023', 'No such claim.');
    const own = this.tables[TABLES.people].find((row): boolean => row.member_id === claimantId);
    if (own) {
      const known = new Set(this.tables[TABLES.tags].map((row): string => `${row.event_id}:${row.person_id}`));
      for (const tag of this.tables[TABLES.tags].filter((row): boolean => row.person_id === own.id)) {
        if (!known.has(`${tag.event_id}:${personId}`)) this.tables[TABLES.tags].push({ ...tag, person_id: personId });
      }
      this.tables[TABLES.people] = this.tables[TABLES.people].filter((row): boolean => row !== own);
      this.cascade(TABLES.people, [own]);
    }
    claimed.member_id = claimantId;
    const others = (row: Row): boolean => row[COLUMNS.claimantId] !== claimantId;
    this.tables[TABLES.claims] = this.tables[TABLES.claims].filter(others);
  }
}
