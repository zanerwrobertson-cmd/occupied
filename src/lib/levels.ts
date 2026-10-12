import type { Building, Level, Status, Trend } from '@/data/types';

/** First hour covered by typicalDay arrays. */
export const DAY_START_HOUR = 7;
export const DAY_HOURS = 17; // 7 AM → 11 PM

export const TREND_TEXT: Record<Trend, string> = {
  up: 'Getting busier',
  down: 'Getting quieter',
  steady: 'Steady',
};

/** Text for the neutral (grey) states — always shown with the colour, never colour alone. */
export const STATUS_TEXT: Record<Exclude<Status, 'live'>, string> = {
  nodata: 'No data yet',
  closed: 'Closed',
  low: 'Low activity',
};

/** "Quietest first" order: live levels, then low activity, closed, and no data last. */
export function quietRank(b: Building): number {
  if (b.status === 'live') return b.level;
  return { low: 4, closed: 5, nodata: 6 }[b.status];
}

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

/** 24 (closing at midnight) reads as "12 AM". */
export function formatHourLong(hour: number): string {
  const hh = hour % 24;
  const h = hh % 12 === 0 ? 12 : hh % 12;
  return `${h} ${hh < 12 ? 'AM' : 'PM'}`;
}

/** "Busier than usual for 2 PM" etc., or null when there's no live level or outside charted hours. */
export function comparedToUsual(b: Building, hour: number): string | null {
  if (b.status !== 'live') return null;
  const i = hourIndex(hour);
  if (i < 0) return null;
  const usual = valueToLevel(b.typicalDay[i]);
  const when = formatHourLong(hour);
  if (b.level > usual) return `Busier than usual for ${when}`;
  if (b.level < usual) return `Quieter than usual for ${when}`;
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
