import { ArchiveError } from '@/domain/archive';
import { ARCHIVE_MESSAGES } from '@/domain/rules';
import { assertSnapshotIntegrity, snapshotSchema, type ArchiveSnapshot } from '@/domain/snapshot';
import { DEMO_STORAGE_KEY, LEGACY_V1_KEY, LEGACY_V2_KEY, migrateV1, migrateV2 } from './demo-migration';
import { seedArchive } from './demo-seed';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function decodeSnapshot(input: unknown): ArchiveSnapshot {
  const parsed = snapshotSchema.parse(input);
  assertSnapshotIntegrity(parsed);
  return parsed;
}

/** The newest stored format wins; an older one is migrated once, and its key is kept for recovery. */
function initialSnapshot(storage: StoragePort): ArchiveSnapshot {
  const v2 = storage.getItem(LEGACY_V2_KEY);
  if (v2 !== null) return migrateV2(JSON.parse(v2));
  const v1 = storage.getItem(LEGACY_V1_KEY);
  return v1 !== null ? migrateV1(JSON.parse(v1)) : seedArchive();
}

/** Browser-stored archive. Every read and write is validated against the current snapshot schema. */
export class DemoStore {
  constructor(private readonly storage: StoragePort) {}

  read(): ArchiveSnapshot {
    try {
      const raw = this.storage.getItem(DEMO_STORAGE_KEY);
      if (raw !== null) return decodeSnapshot(JSON.parse(raw));
      const initial = decodeSnapshot(initialSnapshot(this.storage));
      this.write(initial);
      return initial;
    } catch {
      throw new ArchiveError(ARCHIVE_MESSAGES.unreadable);
    }
  }

  write(snapshot: ArchiveSnapshot): void {
    this.storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(decodeSnapshot(snapshot)));
  }

  reset(): void {
    this.write(seedArchive());
  }
}
