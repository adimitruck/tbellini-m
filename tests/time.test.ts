import { describe, expect, it } from 'vitest';
import { eventDay, formInstant, localDateTime, toInstant } from '../src/domain/time';
describe('recorded timezone', (): void => {
  it('groups by local day rather than UTC', (): void => { expect(eventDay('2026-10-10T01:00:00Z', 'America/Chicago')).toBe('2026-10-09'); });
  it('roundtrips local time without host timezone dependence', (): void => { const instant = toInstant('2026-10-09T18:30', 'America/Chicago'); expect(instant).toBe('2026-10-09T23:30:00.000Z'); expect(localDateTime(instant, 'America/Chicago')).toBe('2026-10-09T18:30'); });
  it('rejects DST gap and repeated wall times', (): void => { expect((): string => toInstant('2026-03-08T02:30', 'America/Chicago')).toThrow(); expect((): string => toInstant('2026-11-01T01:30', 'America/Chicago')).toThrow(); });
});
describe('event correction and timezone precision', (): void => {
  it('preserves seconds and the known instant of a repeated DST hour on text corrections', (): void => { const instant = '2026-11-01T07:30:42.123Z'; expect(formInstant(localDateTime(instant, 'America/Chicago'), 'America/Chicago', { instant, timezone: 'America/Chicago' })).toBe(instant); });
  it('recomputes the instant when the timezone or wall time is corrected', (): void => { const original = { instant: '2026-10-06T17:30:42.000Z', timezone: 'America/Chicago' }; expect(formInstant('2026-10-06T12:30', 'America/New_York', original)).toBe('2026-10-06T16:30:00.000Z'); expect(formInstant('2026-10-06T13:30', 'America/Chicago', original)).toBe('2026-10-06T18:30:00.000Z'); });
  it('handles historical second-level offsets and rejects invalid dates', (): void => { expect(toInstant('1900-01-01T12:00', 'Europe/Paris')).toBe('1900-01-01T11:50:39.000Z'); expect((): string => toInstant('2026-02-30T12:00', 'America/Chicago')).toThrow(); });
});
