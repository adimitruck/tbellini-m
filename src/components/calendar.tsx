'use client';
import { useState, type ReactElement } from 'react';
import type { ArchiveEvent } from '@/domain/archive';
import { eventDay } from '@/domain/time';
export interface CalendarProps { events: ArchiveEvent[]; onSelect(event: ArchiveEvent): void }
export function Calendar({ events, onSelect }: CalendarProps): ReactElement {
  const [month, setMonth] = useState((): Date => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1, 12); });
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12).getDate();
  const start = month.getDay();
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  return <section aria-label="Monthly calendar"><div className="calendar-heading"><h2>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><div className="actions"><button aria-label="Previous month" onClick={(): void => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}>←</button><button onClick={(): void => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12)); }}>Today</button><button aria-label="Next month" onClick={(): void => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}>→</button></div></div><p className="muted small">Each event appears on its recorded local date.</p><div className="calendar-scroll"><div className="calendar-grid">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day): ReactElement => <div className="weekday" key={day}>{day}</div>)}{Array.from({ length: start }, (_, i): ReactElement => <div className="calendar-cell empty" key={`empty-${i}`} />)}{Array.from({ length: days }, (_, i): ReactElement => { const day = `${monthKey}-${String(i + 1).padStart(2, '0')}`; return <div className="calendar-cell" key={day}><span>{i + 1}</span>{events.filter((event): boolean => eventDay(event.startsAt, event.timezone) === day).map((event): ReactElement => <button className="calendar-event" key={event.id} onClick={(): void => onSelect(event)}>{event.title}</button>)}</div>; })}</div></div></section>;
}
