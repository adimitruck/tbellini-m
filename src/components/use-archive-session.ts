'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArchiveError } from '@/domain/archive';
import { ArchiveService } from '@/domain/service';
import { emptySnapshot, type ArchiveSnapshot } from '@/domain/snapshot';
import { LatestRequest } from '@/lib/latest-request';
import type { ArchiveRuntime } from '@/lib/archive-runtime';

export const SESSION_MESSAGES = {
  loadFailed: 'Unable to load TBellini.',
  saveFailed: 'The change could not be saved.',
  sessionChanged: 'Your session changed. Reopen the form with your current account.',
} as const;

type Action = (service: ArchiveService) => Promise<unknown>;
interface Loaded {
  service: ArchiveService | null;
  snapshot: ArchiveSnapshot;
}

export interface ArchiveSession {
  userId: string | null;
  service: ArchiveService | null;
  snapshot: ArchiveSnapshot;
  loading: boolean;
  error: string;
  busy: boolean;
  /** Runs a change, then refreshes the snapshot; rejects when the change fails. */
  mutate(action: Action): Promise<void>;
  /** Fire-and-forget mutate for buttons; the failure is already shown as the session error. */
  run(action: Action): void;
  /** Loads again for the current member, for example after resetting the demo. */
  reload(): void;
  setError(message: string): void;
}

const messageOf = (cause: unknown, fallback: string): string => (cause instanceof Error ? cause.message : fallback);

/** Follows the signed-in member of the runtime and keeps their archive snapshot loaded. */
export function useArchiveSession(runtime: ArchiveRuntime, onMemberChange: () => void): ArchiveSession {
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded>({ service: null, snapshot: emptySnapshot() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const requests = useRef(new LatestRequest());
  const onChange = useRef(onMemberChange);
  useEffect((): void => {
    onChange.current = onMemberChange;
  });

  useEffect((): (() => void) => {
    const gate = requests.current;
    const load = (member: string | null): void => {
      gate.invalidate();
      setUserId(member);
      setLoaded({ service: null, snapshot: emptySnapshot() });
      setBusy(false);
      onChange.current();
      if (!member) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void gate.run(
        async (): Promise<Loaded> => {
          const service = new ArchiveService(runtime.repositoriesFor(member));
          return { service, snapshot: await service.snapshot() };
        },
        (result): void => {
          setLoaded(result);
          setError('');
          setLoading(false);
        },
        (cause): void => {
          setError(messageOf(cause, SESSION_MESSAGES.loadFailed));
          setLoading(false);
        },
      );
    };
    const unsubscribe = runtime.auth.subscribe(load);
    return (): void => {
      gate.invalidate();
      unsubscribe();
    };
  }, [runtime, generation]);

  const { service } = loaded;
  const mutate = useCallback(
    async (action: Action): Promise<void> => {
      if (!service) return;
      const token = requests.current.token;
      setBusy(true);
      setError('');
      try {
        await action(service);
        const snapshot = await service.snapshot();
        if (!requests.current.isCurrent(token)) throw new ArchiveError(SESSION_MESSAGES.sessionChanged);
        setLoaded({ service, snapshot });
      } catch (cause) {
        if (requests.current.isCurrent(token)) setError(messageOf(cause, SESSION_MESSAGES.saveFailed));
        throw cause;
      } finally {
        if (requests.current.isCurrent(token)) setBusy(false);
      }
    },
    [service],
  );
  const run = useCallback((action: Action): void => void mutate(action).catch((): void => {}), [mutate]);
  const reload = useCallback((): void => setGeneration((value): number => value + 1), []);

  return { userId, service, snapshot: loaded.snapshot, loading, error, busy, mutate, run, reload, setError };
}
