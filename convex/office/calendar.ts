import type { CalendarId } from './registry';

// Versioned NYSE core-session reference, reviewed 15 October 2026.
// https://www.nyse.com/trade/hours-calendars
// Applies to the initial US regular-session simulation; no extended hours.
const holidays = new Set([
  '2026-01-01',
  '2026-01-19',
  '2026-02-16',
  '2026-04-03',
  '2026-05-25',
  '2026-06-19',
  '2026-07-03',
  '2026-09-07',
  '2026-11-26',
  '2026-12-25',
  '2027-01-01',
  '2027-01-18',
  '2027-02-15',
  '2027-03-26',
  '2027-05-31',
  '2027-06-18',
  '2027-07-05',
  '2027-09-06',
  '2027-11-25',
  '2027-12-24',
]);
const earlyCloses = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);
export const CALENDAR_VERSION = 'reference-2026-2027-v1';
export type MarketState = {
  state: 'OPEN' | 'CLOSED' | 'UNVERIFIED';
  reason: string;
  timezone: string;
  version: string;
};
export function marketState(calendar: CalendarId, timestamp: number): MarketState {
  if (!Number.isFinite(timestamp)) throw new Error('Invalid market timestamp');
  const base = {
    timezone: calendar === 'crypto' ? 'UTC' : 'America/New_York',
    version: CALENDAR_VERSION,
  };
  if (calendar === 'crypto')
    return {
      ...base,
      state: 'OPEN',
      reason: 'Continuous reference session; venue health unverified',
    };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const day = get('weekday');
  if (calendar === 'fx-reference') {
    const closed =
      day === 'Sat' ||
      (day === 'Sun' && minutes < 17 * 60) ||
      (day === 'Fri' && minutes >= 17 * 60);
    return {
      ...base,
      state: closed ? 'CLOSED' : 'UNVERIFIED',
      reason: closed
        ? 'Reference FX weekend closure'
        : 'Provider-specific sessions and maintenance not verified',
    };
  }
  if (!['2026', '2027'].includes(get('year')))
    return { ...base, state: 'UNVERIFIED', reason: 'Calendar year not verified' };
  if (day === 'Sat' || day === 'Sun') return { ...base, state: 'CLOSED', reason: 'Weekend' };
  if (holidays.has(date)) return { ...base, state: 'CLOSED', reason: 'Exchange holiday' };
  const close = earlyCloses.has(date) ? 13 * 60 : 16 * 60;
  return {
    ...base,
    state: minutes >= 9 * 60 + 30 && minutes < close ? 'OPEN' : 'CLOSED',
    reason: earlyCloses.has(date)
      ? 'Early close at 13:00 New York'
      : 'Regular session 09:30–16:00 New York',
  };
}
