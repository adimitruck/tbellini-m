/** Calendar grouping uses the event's recorded timezone, never the browser timezone. */
export function eventDay(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const get = (type: string): string => parts.find((part): boolean => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function localDateTime(instant: string, timezone: string): string {
  const date = eventDay(instant, timezone);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
  return `${date}T${time}`;
}
function offsetAt(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const value = (type: string): number => Number(parts.find((part): boolean => part.type === type)?.value);
  const wall = new Date(0); wall.setUTCFullYear(value('year'), value('month') - 1, value('day')); wall.setUTCHours(value('hour'), value('minute'), value('second'), 0);
  return wall.getTime() - instant;
}
/** Resolve an IANA wall time, including historical second-level offsets, rejecting DST gaps/repeats. */
export function toInstant(local: string, timezone: string): string {
  const parsed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? Date.parse(`${local}:00Z`) : NaN;
  if (!Number.isFinite(parsed)) throw new Error('Enter a valid date and time.');
  const matches = new Set<string>();
  // Nearby days discover both sides of a timezone transition without assuming offsets in 15-minute steps.
  for (const day of [-2, -1, 0, 1, 2]) {
    const candidate = new Date(parsed - offsetAt(parsed + day * 86400000, timezone)).toISOString();
    if (localDateTime(candidate, timezone) === local) matches.add(candidate);
  }
  if (matches.size !== 1) throw new Error('This time is skipped or repeated by daylight saving. Choose an unambiguous time.');
  return [...matches][0];
}
export interface OriginalEventTime { instant: string; timezone: string }
/** Text-only corrections preserve seconds and known instants in a repeated local hour. */
export function formInstant(local: string, timezone: string, original?: OriginalEventTime): string {
  return original && timezone === original.timezone && local === localDateTime(original.instant, timezone) ? original.instant : toInstant(local, timezone);
}
export function formatEventTime(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(instant));
}
