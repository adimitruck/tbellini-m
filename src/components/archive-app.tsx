'use client';
import Link from 'next/link';
import { useCallback, useState, type ReactElement } from 'react';
import type { ArchiveEvent, Person } from '@/domain/archive';
import { personalEvents } from '@/domain/snapshot';
import type { ArchiveRuntime } from '@/lib/archive-runtime';
import { Auth } from './auth';
import { Calendar } from './calendar';
import { EventDetail } from './event-detail';
import { EventList } from './event-list';
import { EventForm, PersonForm } from './forms';
import { VIEWS, VIEW_LABELS, type View } from './labels';
import { Members } from './members-view';
import { PeopleView } from './people-view';
import { PersonDetail } from './person-detail';
import { useArchiveSession } from './use-archive-session';

type Editor = { kind: 'event'; record?: ArchiveEvent } | { kind: 'person'; record?: Person } | null;

export interface ArchiveAppProps {
  runtime: ArchiveRuntime;
  initialView?: View;
}

/** Depends only on the runtime's ports; the composition root decides which adapters sit behind them. */
export function ArchiveApp({ runtime, initialView = 'events' }: ArchiveAppProps): ReactElement {
  const [view, setView] = useState<View>(initialView);
  const [editor, setEditor] = useState<Editor>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const closeOpenItems = useCallback((): void => {
    setSelectedId(null);
    setPersonId(null);
    setEditor(null);
  }, []);
  const session = useArchiveSession(runtime, closeOpenItems);
  const { snapshot, busy, userId } = session;
  const selected = snapshot.events.find((event): boolean => event.id === selectedId) ?? null;
  const current = snapshot.members.find((member): boolean => member.id === userId);
  const openPerson = snapshot.people.find((person): boolean => person.id === personId) ?? null;
  const labels = VIEW_LABELS[view];
  const creates = view === 'people' ? 'person' : 'event';
  const myEvents = userId ? personalEvents(snapshot, userId) : [];
  const go = (next: View): void => {
    setView(next);
    closeOpenItems();
  };
  const signOut = async (): Promise<void> => {
    try {
      await runtime.auth.signOut();
    } catch (cause) {
      session.setError(cause instanceof Error ? cause.message : 'Unable to sign out.');
    }
  };
  const switchDemoUser = (id: string): void => {
    runtime.auth.signIn({ email: id, password: '' }).catch((cause: unknown): void => {
      session.setError(cause instanceof Error ? cause.message : 'Unable to switch demo member.');
    });
  };
  const resetDemo = (): void => {
    if (!window.confirm('Reset the shared demo and discard this browser’s changes?')) return;
    closeOpenItems();
    runtime.demo?.reset();
    session.reload();
  };

  function body(): ReactElement {
    if (session.loading) return <p role="status">Opening TBellini…</p>;
    if (!session.service || !userId) {
      return userId ? (
        <section className="empty-state">
          <h1>TBellini could not open.</h1>
          <p>Your account is signed in. Try loading again or sign out to switch accounts.</p>
          <button onClick={session.reload}>Reload archive</button>
        </section>
      ) : (
        <Auth auth={runtime.auth} />
      );
    }
    if (editor?.kind === 'event') {
      return (
        <EventForm
          event={editor.record}
          onCancel={(): void => setEditor(null)}
          onSave={async (input): Promise<void> => {
            await session.mutate((archive) => archive.saveEvent(input, editor.record?.id));
            setEditor(null);
          }}
        />
      );
    }
    if (editor?.kind === 'person') {
      return (
        <PersonForm
          person={editor.record}
          onCancel={(): void => setEditor(null)}
          onSave={async (input): Promise<void> => {
            await session.mutate((archive) => archive.savePerson(input, editor.record?.id));
            setEditor(null);
          }}
        />
      );
    }
    if (selected) {
      return (
        <EventDetail
          event={selected}
          snapshot={snapshot}
          currentUserId={userId}
          busy={busy}
          onBack={(): void => setSelectedId(null)}
          onEdit={(): void => setEditor({ kind: 'event', record: selected })}
          run={session.run}
        />
      );
    }
    if (view === 'people' && openPerson) {
      return (
        <PersonDetail
          person={openPerson}
          snapshot={snapshot}
          currentUserId={userId}
          busy={busy}
          onBack={(): void => setPersonId(null)}
          onEdit={(): void => setEditor({ kind: 'person', record: openPerson })}
          onOpenEvent={(event): void => {
            setView('events');
            setPersonId(null);
            setSelectedId(event.id);
          }}
          run={session.run}
        />
      );
    }
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">{labels.eyebrow}</p>
            <h1>{labels.title}</h1>
            <p className="muted">{labels.description}</p>
          </div>
          {labels.create && (
            <button className="primary" onClick={(): void => setEditor({ kind: creates })}>
              + {labels.create}
            </button>
          )}
        </div>
        {viewBody(userId)}
      </>
    );
  }

  function viewBody(id: string): ReactElement {
    const select = (event: ArchiveEvent): void => setSelectedId(event.id);
    if (view === 'calendar' || view === 'personal') {
      const events = view === 'personal' ? myEvents : snapshot.events;
      return (
        <>
          {view === 'personal' && <p className="small muted">{myEvents.length} events on your personal calendar</p>}
          <Calendar key={view} events={events} onSelect={select} />
          {view === 'personal' && !myEvents.length && (
            <div className="empty-state">
              <h2>Make room for your next moment.</h2>
              <p>Open an event and choose Going or Interested.</p>
              <button onClick={(): void => go('events')}>Browse events</button>
            </div>
          )}
        </>
      );
    }
    if (view === 'members') {
      return (
        <Members
          key={id}
          snapshot={snapshot}
          currentUserId={id}
          onSaveProfile={async (name): Promise<void> => {
            await session.mutate((archive) => archive.saveProfile(name));
          }}
          onGenerateInvitation={async (forPersonId): Promise<string> => {
            let code = '';
            await session.mutate(async (archive): Promise<void> => {
              code = await archive.generateInvitation(undefined, forPersonId);
            });
            return code;
          }}
        />
      );
    }
    if (view === 'people') {
      return (
        <PeopleView snapshot={snapshot} onOpen={(person): void => setPersonId(person.id)} />
      );
    }
    return <EventList snapshot={snapshot} currentUserId={id} onSelect={select} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">tbellini<span>m</span></Link>
        <p className="brand-caption">ONE GROUP · MANY MOMENTS</p>
        <nav aria-label="TBellini views">
          {VIEWS.map((id): ReactElement => (
            <button
              key={id}
              aria-current={view === id ? 'page' : undefined}
              className={view === id ? 'nav-item active' : 'nav-item'}
              onClick={(): void => go(id)}
            >
              <span aria-hidden="true">{VIEW_LABELS[id].symbol}</span>
              {VIEW_LABELS[id].nav}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" /> TBellini
          <p>Shared events.<br />Your own calendar.</p>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>{current ? `Signed in as ${current.displayName}` : 'TBellini'}</span>
          <div className="topbar-actions">
            <span className="archive-badge">M0 · Events & Calendar</span>
            {!runtime.demo && userId && <button onClick={(): void => void signOut()}>Sign out</button>}
          </div>
        </header>
        {runtime.demo && (
          <div className="demo-banner">
            <span>Shared demo · stored in this browser</span>
            <label className="demo-user-select">
              Demo user
              <select
                aria-label="Demo user"
                value={userId ?? ''}
                disabled={busy}
                onChange={(event): void => switchDemoUser(event.target.value)}
              >
                {runtime.demo.users.map((id): ReactElement => (
                  <option key={id} value={id}>
                    {snapshot.members.find((member): boolean => member.id === id)?.displayName ?? id}
                  </option>
                ))}
              </select>
            </label>
            <button className="text-button" disabled={busy} onClick={resetDemo}>Reset demo</button>
          </div>
        )}
        <div className="content">
          {session.error && <div className="error" role="alert">{session.error}</div>}
          {body()}
        </div>
      </main>
    </div>
  );
}
