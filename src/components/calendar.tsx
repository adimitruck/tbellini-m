'use client';
import { useState, type ReactElement } from 'react';
import type { ArchiveEvent } from '@/domain/archive';
import { eventDay } from '@/domain/time';
import { CALENDAR_TEXT } from './labels';

export interface CalendarProps {
  events: ArchiveEvent[];
  onSelect(event: ArchiveEvent): void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const NOON = 12;

/** The first day of the month containing `date`, at noon so daylight saving shifts never change the date. */
const firstOfMonth = (date: Date, offset = 0): Date =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1, NOON);

export function Calendar({ events, onSelect }: CalendarProps): ReactElement {
  const [month, setMonth] = useState((): Date => firstOfMonth(new Date()));
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0, NOON).getDate();
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const cell = (index: number): ReactElement => {
    const day = `${monthKey}-${String(index + 1).padStart(2, '0')}`;
    const todays = events.filter((event): boolean => eventDay(event.startsAt, event.timezone) === day);
    return (
      <div className="calendar-cell" key={day}>
        <span>{index + 1}</span>
        {todays.map((event): ReactElement => (
          <button className="calendar-event" key={event.id} onClick={(): void => onSelect(event)}>
            {event.title}
          </button>
        ))}
      </div>
    );
  };
  return (
    <section aria-label={CALENDAR_TEXT.monthly}>
      <div className="calendar-heading">
        <h2>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <div className="actions">
          <button aria-label={CALENDAR_TEXT.previous} onClick={(): void => setMonth(firstOfMonth(month, -1))}>
            ←
          </button>
          <button onClick={(): void => setMonth(firstOfMonth(new Date()))}>{CALENDAR_TEXT.today}</button>
          <button aria-label={CALENDAR_TEXT.next} onClick={(): void => setMonth(firstOfMonth(month, 1))}>→</button>
        </div>
      </div>
      <p className="muted small">{CALENDAR_TEXT.hint}</p>
      <div className="calendar-scroll">
        <div className="calendar-grid">
          {WEEKDAYS.map((day): ReactElement => <div className="weekday" key={day}>{day}</div>)}
          {Array.from({ length: month.getDay() }, (_, i): ReactElement => (
            <div className="calendar-cell empty" key={`empty-${i}`} />
          ))}
          {Array.from({ length: days }, (_, i): ReactElement => cell(i))}
        </div>
      </div>
    </section>
  );
}
