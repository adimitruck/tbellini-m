import { ArchiveError } from '@/domain/archive';
import type { AuthPort, DemoControls, RepositoryFactory } from '@/domain/ports';
import { createDemoRepositories, DemoAuth, type StoragePort } from '@/infrastructure/demo';
import { DemoStore } from '@/infrastructure/demo-store';
import { createArchiveClient, createSupabaseRepositories, SupabaseAuth } from '@/infrastructure/supabase';
import { archiveConfiguration, type ArchiveConfigurationInput } from './archive-config';

/** What the UI needs from the chosen backend: who is signed in, and repositories for that member. */
export interface ArchiveRuntime {
  auth: AuthPort;
  repositoriesFor: RepositoryFactory;
  /** Present only in demo mode. */
  demo: DemoControls | null;
}

/**
 * The one composition root: reads the configuration, picks the demo or Supabase adapters and wires them together.
 * Throws an ArchiveError that names the missing configuration when the app cannot run.
 */
export function createArchiveRuntime(input: ArchiveConfigurationInput, storage: StoragePort): ArchiveRuntime {
  const configuration = archiveConfiguration(input);
  if (configuration.error) throw new ArchiveError(configuration.error);
  if (configuration.mode === 'demo') {
    const auth = new DemoAuth(new DemoStore(storage));
    return { auth, repositoriesFor: (userId) => createDemoRepositories(storage, userId), demo: auth };
  }
  const client = createArchiveClient(input.supabaseUrl ?? '', input.supabaseKey ?? '');
  return {
    auth: new SupabaseAuth(client.auth),
    repositoriesFor: (userId) => createSupabaseRepositories(client, userId),
    demo: null,
  };
}
