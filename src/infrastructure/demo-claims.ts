import { tagKey, type EventPersonTag, type PersonClaim } from '@/domain/archive';
import type { ClaimRepository } from '@/domain/ports';
import { requireConfirmable, requireUnlinked } from '@/domain/rules';
import type { ArchiveSnapshot } from '@/domain/snapshot';
import type { DemoStore } from './demo-store';

/** Mirrors the database's confirm_person_claim(): merge the claimant's automatic Person into the claimed one. */
function link(data: ArchiveSnapshot, personId: string, claimantId: string): void {
  const own = data.people.find((person): boolean => person.memberId === claimantId);
  if (own) {
    const known = new Set(data.tags.map(tagKey));
    const moved = data.tags
      .filter((tag): boolean => tag.personId === own.id)
      .map((tag): EventPersonTag => ({ ...tag, personId }))
      .filter((tag): boolean => !known.has(tagKey(tag)));
    data.tags = [...data.tags.filter((tag): boolean => tag.personId !== own.id), ...moved];
    data.people = data.people.filter((person): boolean => person.id !== own.id);
  }
  const claimed = data.people.find((person): boolean => person.id === personId);
  if (claimed) claimed.memberId = claimantId;
  data.claims = data.claims.filter((claim): boolean => claim.claimantId !== claimantId);
}

export class DemoClaims implements ClaimRepository {
  constructor(
    private readonly store: DemoStore,
    private readonly userId: string,
  ) {}

  async list(): Promise<PersonClaim[]> {
    return this.store.read().claims;
  }

  async request(personId: string): Promise<void> {
    const data = this.store.read();
    requireUnlinked(data.people.find((person): boolean => person.id === personId));
    data.claims = data.claims.filter((claim): boolean => claim.claimantId !== this.userId);
    data.claims.push({ personId, claimantId: this.userId, createdAt: new Date().toISOString() });
    this.store.write(data);
  }

  async cancel(personId: string, claimantId: string): Promise<void> {
    const data = this.store.read();
    const isThis = (claim: PersonClaim): boolean => claim.personId === personId && claim.claimantId === claimantId;
    data.claims = data.claims.filter((claim): boolean => !isThis(claim));
    this.store.write(data);
  }

  async confirm(personId: string, claimantId: string): Promise<void> {
    const data = this.store.read();
    requireConfirmable(
      data.people.find((person): boolean => person.id === personId),
      data.claims,
      claimantId,
      this.userId,
    );
    link(data, personId, claimantId);
    this.store.write(data);
  }
}
