import type { Level, Trend } from '@/data/types';

/** First hour covered by typicalDay arrays. */
export const DAY_START_HOUR = 7;
export const DAY_HOURS = 17; // 7 AM → 11 PM

export const TREND_TEXT: Record<Trend, string> = {
  up: 'Getting busier',
  down: 'Getting quieter',
  steady: 'Steady',
};

/** Map a 0–100 typical-day value onto a Level. */
export function valueToLevel(v: number): Level {
  if (v < 35) return 0;
  if (v < 55) return 1;
  if (v < 75) return 2;
  return 3;
}

/** Index into typicalDay for a given hour, or -1 outside 7 AM–11 PM. */
export function hourIndex(hour: number): number {
  const i = hour - DAY_START_HOUR;
  return i >= 0 && i < DAY_HOURS ? i : -1;
}

export function formatHourShort(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'a' : 'p'}`;
}

export function formatHourLong(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "Busier than usual for 2 PM" etc., or null outside charted hours. */
export function comparedToUsual(level: Level, typicalDay: number[], hour: number): string | null {
  const i = hourIndex(hour);
  if (i < 0) return null;
  const usual = valueToLevel(typicalDay[i]);
  const when = formatHourLong(hour);
  if (level > usual) return `Busier than usual for ${when}`;
  if (level < usual) return `Quieter than usual for ${when}`;
  return `About normal for ${when}`;
}

export function minutesAgo(ts: number, now: number): string {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return 'Updated just now';
  if (m === 1) return 'Updated 1 min ago';
  if (m < 60) return `Updated ${m} min ago`;
  const h = Math.floor(m / 60);
  return `Updated ${h} hr ago`;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
