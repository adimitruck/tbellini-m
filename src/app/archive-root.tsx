'use client';
import { useSyncExternalStore, type ReactElement } from 'react';
import { ArchiveApp } from '@/components/archive-app';
import { readArchiveEnvironment } from '@/lib/archive-config';
import { createArchiveRuntime, type ArchiveRuntime } from '@/lib/archive-runtime';

type Boot = { runtime: ArchiveRuntime } | { error: string };

function boot(): Boot {
  try {
    return { runtime: createArchiveRuntime(readArchiveEnvironment(), window.localStorage) };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : 'Unable to start TBellini.' };
  }
}

let booted: Boot | null = null;
const bootOnce = (): Boot => (booted ??= boot());
const noSubscription = (): (() => void) => (): void => {};
const notOnServer = (): null => null;

/**
 * Client entry point: builds the runtime once in the browser, where demo storage and Supabase sessions live.
 * Server rendering has no browser, so it renders the loading state and the client takes over.
 */
export function ArchiveRoot(): ReactElement {
  const started = useSyncExternalStore(noSubscription, bootOnce, notOnServer);
  if (!started) return <p role="status">Opening TBellini…</p>;
  if ('error' in started) {
    return (
      <section className="empty-state">
        <h1>TBellini is not ready yet.</h1>
        <p role="alert">{started.error}</p>
      </section>
    );
  }
  return <ArchiveApp runtime={started.runtime} />;
}
