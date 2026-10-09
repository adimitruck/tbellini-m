'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArchiveError, ArchiveService, emptySnapshot, personalEvents, type ArchiveEvent, type ArchiveSnapshot, type Person } from '@/domain/archive';
import { createDemoRepositories, DEMO_USERS, resetDemoStorage } from '@/infrastructure/demo';
import { createArchiveClient, createSupabaseRepositories } from '@/infrastructure/supabase';
import { archiveConfiguration } from '@/lib/archive-config';
import { LatestRequest } from '@/lib/latest-request';
import { EventForm, PersonForm } from './forms';
import { Calendar } from './calendar';
import { Auth } from './auth';
import { EventDetail } from './event-detail';
import { EventList, Members } from './community-views';
type View = 'events' | 'calendar' | 'personal' | 'people' | 'members';
type Editor = { kind: 'event'; record?: ArchiveEvent } | { kind: 'person'; record?: Person } | null;
const views: { id: View; label: string; symbol: string }[] = [
  { id: 'events', label: 'Community events', symbol: '◈' }, { id: 'calendar', label: 'Community calendar', symbol: '▦' },
  { id: 'personal', label: 'My calendar', symbol: '◷' }, { id: 'members', label: 'TBellini users', symbol: '◎' }, { id: 'people', label: 'My archive people', symbol: '◇' },
];
export interface ArchiveAppProps { initialView?: View }
export function ArchiveApp({ initialView = 'events' }: ArchiveAppProps): ReactElement {
  const [view, setView] = useState<View>(initialView); const [editor, setEditor] = useState<Editor>(null);
  const [selected, setSelected] = useState<ArchiveEvent | null>(null); const [snapshot, setSnapshot] = useState<ArchiveSnapshot>(emptySnapshot);
  const [service, setService] = useState<ArchiveService | null>(null); const [client, setClient] = useState<SupabaseClient | null>(null);
  const [demoUserId, setDemoUserId] = useState<string>(DEMO_USERS[0]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const requests = useRef(new LatestRequest());
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);
  const configuration = archiveConfiguration({ mode: process.env.NEXT_PUBLIC_ARCHIVE_MODE, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, nodeEnv: process.env.NODE_ENV });
  const mode = configuration.mode;
  const configurationError = configuration.error;
  useEffect((): (() => void) => {
    let active = true; let unsubscribe = (): void => {};
    const gate = requests.current;
    const failed = (cause: unknown): void => { if (active) { setError(cause instanceof Error ? cause.message : 'Unable to load TBellini.'); setLoading(false); } };
    async function initialize(): Promise<void> {
      try {
        if (configurationError) throw new ArchiveError(configurationError);
        if (mode === 'demo') {
          await gate.run(async (): Promise<{ service: ArchiveService; snapshot: ArchiveSnapshot }> => {
            const next = new ArchiveService(createDemoRepositories(window.localStorage, demoUserId)); return { service: next, snapshot: await next.snapshot() };
          }, (result): void => { if (active) { setService(result.service); setSnapshot(result.snapshot); setLoading(false); setError(''); } }, failed);
        } else if (mode === 'supabase') {
          const supabase = createArchiveClient(); setClient(supabase);
          const loadUser = async (): Promise<void> => {
            await gate.run(async (isCurrent): Promise<{ service: ArchiveService | null; snapshot: ArchiveSnapshot }> => {
              const { data, error: authError } = await supabase.auth.getUser();
              if (authError && authError.name !== 'AuthSessionMissingError') throw authError;
              if (!active || !isCurrent()) return { service: null, snapshot: emptySnapshot() };
              setAuthenticatedUserId(data.user?.id ?? null);
              if (!data.user) return { service: null, snapshot: emptySnapshot() };
              const next = new ArchiveService(createSupabaseRepositories(supabase, data.user.id)); return { service: next, snapshot: await next.snapshot() };
            }, (result): void => { if (active) { setService(result.service); setSnapshot(result.snapshot); setError(''); setLoading(false); } }, failed);
          };
          const { data } = supabase.auth.onAuthStateChange((_event, session): void => {
            gate.invalidate();
            setAuthenticatedUserId(session?.user.id ?? null); setService(null); setSnapshot(emptySnapshot()); setSelected(null); setEditor(null); setLoading(true); setBusy(false);
            setTimeout((): void => { if (active) void loadUser(); }, 0);
          });
          unsubscribe = (): void => data.subscription.unsubscribe();
          await loadUser();
        }
      } catch (cause) { failed(cause); }
    }
    void initialize(); return (): void => { active = false; gate.invalidate(); unsubscribe(); };
  }, [mode, configurationError, demoUserId]);
  async function mutate(action: (archive: ArchiveService) => Promise<unknown>): Promise<void> {
    if (!service) return; const generation = requests.current.token; setBusy(true); setError('');
    try { await action(service); const data = await service.snapshot(); if (!requests.current.isCurrent(generation)) throw new ArchiveError('Your session changed. Reopen the form with your current account.'); setSnapshot(data); if (selected) setSelected(data.events.find((event): boolean => event.id === selected.id) ?? null); }
    catch (cause) { if (requests.current.isCurrent(generation)) setError(cause instanceof Error ? cause.message : 'The change could not be saved.'); throw cause; }
    finally { if (requests.current.isCurrent(generation)) setBusy(false); }
  }
  function run(action: (archive: ArchiveService) => Promise<unknown>): void { void mutate(action).catch((): void => {}); }
  async function signOut(): Promise<void> { if (!client) return; try { const { error: cause } = await client.auth.signOut(); if (cause) throw cause; } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign out.'); } }
  const go = (next: View): void => { setView(next); setSelected(null); setEditor(null); };
  const userId = service?.currentUserId ?? demoUserId;
  const currentProfile = snapshot.members.find((profile): boolean => profile.id === userId);
  const myEvents = personalEvents(snapshot, userId);
  const switchDemoUser = (id: string): void => { requests.current.invalidate(); setLoading(true); setService(null); setSnapshot(emptySnapshot()); setSelected(null); setEditor(null); setDemoUserId(id); };
  const resetDemo = (): void => {
    if (!window.confirm('Reset the shared demo and discard this browser’s changes?')) return;
    setSelected(null); setEditor(null); setLoading(true);
    void requests.current.run(async (): Promise<{ service: ArchiveService; snapshot: ArchiveSnapshot }> => {
      resetDemoStorage(window.localStorage); const next = new ArchiveService(createDemoRepositories(window.localStorage, demoUserId)); return { service: next, snapshot: await next.snapshot() };
    }, (result): void => { setService(result.service); setSnapshot(result.snapshot); setError(''); setLoading(false); }, (cause): void => { setError(cause instanceof Error ? cause.message : 'Unable to reset the demo.'); setLoading(false); });
  };
  return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/">tbellini<span>m</span></Link><p className="brand-caption">ONE COMMUNITY · MANY MOMENTS</p>
    <nav aria-label="TBellini views">{views.map((item): ReactElement => <button key={item.id} aria-current={view === item.id ? 'page' : undefined} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={(): void => go(item.id)}><span aria-hidden="true">{item.symbol}</span>{item.label}</button>)}</nav>
    <div className="sidebar-foot"><span className="status-dot" /> TBellini community<p>Shared events.<br />Your own calendar.</p></div></aside>
    <main><header className="topbar"><span>{currentProfile ? `Signed in as ${currentProfile.displayName}` : 'TBellini community'}</span><div className="topbar-actions"><span className="archive-badge">M0 · Events & Calendar</span>{client && authenticatedUserId && <button onClick={(): void => { void signOut(); }}>Sign out</button>}</div></header>
    {mode === 'demo' && <div className="demo-banner"><span>Shared demo · stored in this browser</span><label className="demo-user-select">Demo user<select aria-label="Demo user" value={demoUserId} disabled={busy} onChange={(event): void => switchDemoUser(event.target.value)}>{DEMO_USERS.map((id): ReactElement => <option key={id} value={id}>{snapshot.members.find((member): boolean => member.id === id)?.displayName ?? (id === DEMO_USERS[0] ? 'Sam Rivera' : 'Alex Chen')}</option>)}</select></label><button className="text-button" disabled={busy} onClick={resetDemo}>Reset demo</button></div>}
    <div className="content">{error && <div className="error" role="alert">{error}</div>}{loading ? <p role="status">Opening TBellini…</p> : !service ? client ? authenticatedUserId ? <section className="empty-state"><h1>TBellini could not open.</h1><p>Your account is signed in. Try loading again or sign out to switch accounts.</p><button onClick={(): void => window.location.reload()}>Reload archive</button></section> : <Auth client={client} /> : <section className="empty-state"><h1>TBellini is not ready yet.</h1><p>Check the configuration above and reload.</p></section> : editor?.kind === 'event' ? <EventForm event={editor.record} onCancel={(): void => setEditor(null)} onSave={async (input): Promise<void> => { await mutate((archive): Promise<ArchiveEvent> => archive.saveEvent(input, editor.record?.id)); setEditor(null); }} /> : editor?.kind === 'person' ? <PersonForm person={editor.record} onCancel={(): void => setEditor(null)} onSave={async (input): Promise<void> => { await mutate((archive): Promise<Person> => archive.savePerson(input, editor.record?.id)); setEditor(null); }} /> : selected ? <EventDetail event={selected} snapshot={snapshot} currentUserId={userId} busy={busy} onBack={(): void => setSelected(null)} onEdit={(): void => setEditor({ kind: 'event', record: selected })} onRecordPerson={(): void => setEditor({ kind: 'person' })} run={run} /> : <>
    <div className="page-heading"><div><p className="eyebrow">{view === 'people' ? 'YOUR PRIVATE HISTORICAL PEOPLE' : view === 'personal' ? 'YOUR GOING & INTERESTED EVENTS' : 'THE TBELLINI COMMUNITY'}</p><h1>{view === 'calendar' ? 'Community calendar' : view === 'personal' ? 'My calendar' : view === 'people' ? 'My archive people' : view === 'members' ? 'TBellini users' : 'Community events'}</h1><p className="muted">{view === 'people' ? 'Private people records, separate from signed-up users.' : view === 'personal' ? 'Only events you marked Going or Interested. Tags never add events here.' : view === 'members' ? 'One shared group for everyone who signs up.' : 'Shared events from every member, all in one place.'}</p></div>{view !== 'members' && <button className="primary" onClick={(): void => setEditor({ kind: view === 'people' ? 'person' : 'event' })}>+ {view === 'people' ? 'Record archive person' : 'Create event'}</button>}</div>
    {view === 'calendar' || view === 'personal' ? <>{view === 'personal' && <p className="small muted">{myEvents.length} events on your personal calendar</p>}<Calendar key={view} events={view === 'personal' ? myEvents : snapshot.events} onSelect={setSelected} />{view === 'personal' && !myEvents.length && <div className="empty-state"><h2>Make room for your next moment.</h2><p>Open a community event and choose Going or Interested.</p><button onClick={(): void => go('events')}>Browse community events</button></div>}</> : view === 'members' ? <Members key={userId} snapshot={snapshot} currentUserId={userId} onSaveProfile={async (name): Promise<void> => { await mutate((archive) => archive.saveProfile(name)); }} onGenerateInvitation={async (): Promise<string> => { let code = ''; await mutate(async (archive): Promise<void> => { code = await archive.generateInvitation(); }); return code; }} /> : view === 'people' ? <div className="people-grid">{snapshot.people.map((person): ReactElement => <article key={person.id} className="person-card"><div className="avatar">{person.displayName[0]}</div><h2>{person.displayName}</h2><p className="muted">{person.notes || 'No notes yet.'}</p><p className="small">{snapshot.attendance.filter((link): boolean => link.personId === person.id).length} private event links</p><div className="actions"><button onClick={(): void => setEditor({ kind: 'person', record: person })}>Edit</button><button disabled={busy} className="danger" onClick={(): void => { if (window.confirm('Delete this archive person and their private event links?')) run((archive): Promise<void> => archive.deletePerson(person.id)); }}>Delete</button></div></article>)}{!snapshot.people.length && <div className="empty-state"><h2>Your private people archive.</h2><p>Record historical people without creating user accounts or RSVPs.</p></div>}</div> : <EventList snapshot={snapshot} currentUserId={userId} onSelect={setSelected} />}
    </>}</div></main></div>;
}
