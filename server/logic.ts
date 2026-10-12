/**
 * Pure maths for turning device counts into levels. No I/O, so it ports as-is
 * (e.g. into a Supabase Edge Function) and is unit-tested in __tests__/logic-test.ts.
 *
 * THE IDEA
 *   A raw count ("212 devices") means nothing on its own: 212 is packed for a small floor and
 *   empty for the SSC. So every count is compared with what's normal for *that* place:
 *
 *     ratio = devices now ÷ baseline        baseline = 95th-percentile count over the last 4 weeks
 *
 *   The 95th percentile is "almost the busiest it gets" (ignoring the rare 5% spikes). Then:
 *     ratio < 0.35 → Quiet · < 0.55 → Moderate · < 0.75 → Busy · otherwise → Very Busy
 */
import type { Level, Trend } from '../src/data/types';

// --- Constants (all times in milliseconds) -------------------------------------------------
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
/** p95 baseline window. */
export const BASELINE_MS = 4 * WEEK_MS;
/** typicalDay window. */
export const TYPICAL_MS = 8 * WEEK_MS;
/** Under this much history, fall back to the max count seen so far. */
export const COLD_START_MS = WEEK_MS;
/** Counts under this arrive as "<10" and are never stored as a number. */
export const MIN_COUNT = 10;
/** Trend band: within ±10% of the recent average is "steady". */
export const TREND_BAND = 0.1;
/** typicalDay covers 7 AM → 11 PM, matching src/lib/levels.ts. */
export const DAY_START_HOUR = 7;
export const DAY_HOURS = 17;

/**
 * 95th percentile, nearest-rank method. null for no values.
 * Sort the values; take the one 95% of the way along. e.g. for 1..100 that's 95.
 */
export function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

/** Middle value (average of the two middle ones for an even count). Used for typical-day curves. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** <0.35 Quiet · <0.55 Moderate · <0.75 Busy · else Very Busy. */
export function levelFromRatio(ratio: number): Level {
  if (ratio < 0.35) return 0;
  if (ratio < 0.55) return 1;
  if (ratio < 0.75) return 2;
  return 3;
}

/** Latest vs the average of up to 3 previous values, with a ±10% band. */
export function trendOf(latest: number, previous: number[]): Trend {
  const prev = previous.slice(-3); // the last 3 readings before this one
  if (prev.length === 0) return 'steady';
  const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
  if (avg === 0) return latest > 0 ? 'up' : 'steady'; // avoid dividing by zero
  if (latest > avg * (1 + TREND_BAND)) return 'up';
  if (latest < avg * (1 - TREND_BAND)) return 'down';
  return 'steady';
}

/** One count at one time (ts = epoch milliseconds). */
export type Sample = { ts: number; devices: number };

/**
 * What "full" means for a zone or building: p95 of counts over the last 4 weeks, or the
 * max seen so far when there's under a week of history. null when there's nothing to go on.
 */
export function baseline(samples: Sample[], at: number): number | null {
  // Only the last 4 weeks count, and nothing after `at`.
  const recent = samples.filter((s) => s.ts > at - BASELINE_MS && s.ts <= at);
  if (recent.length === 0) return null;
  // How long have we had data? Under a week isn't enough for a fair p95, so use the max instead.
  const first = Math.min(...samples.map((s) => s.ts));
  const value = at - first < COLD_START_MS ? Math.max(...recent.map((s) => s.devices)) : p95(recent.map((s) => s.devices));
  return value && value > 0 ? value : null;
}

/** devices ÷ baseline, or 0 when there's no baseline yet. */
export function ratio(devices: number, base: number | null): number {
  return base ? devices / base : 0;
}

/**
 * Median ratio per hour (7 AM → 11 PM) on the same weekday as `at`, over the last 8 weeks,
 * scaled 0–100. Hours with no readings (closed) are 0. `localParts` maps ts → local weekday/hour.
 */
export function typicalDay(
  samples: Sample[],
  base: number | null,
  at: number,
  localParts: (ts: number) => { weekday: number; hour: number },
): number[] {
  // Group every reading from the same weekday (e.g. all Mondays) by hour…
  const weekday = localParts(at).weekday;
  const byHour: number[][] = Array.from({ length: DAY_HOURS }, () => []);
  for (const s of samples) {
    if (s.ts <= at - TYPICAL_MS || s.ts > at) continue;
    const p = localParts(s.ts);
    const i = p.hour - DAY_START_HOUR;
    if (p.weekday === weekday && i >= 0 && i < DAY_HOURS) byHour[i].push(ratio(s.devices, base));
  }
  // …then take each hour's median ratio, cap it at 1, and scale to 0–100.
  return byHour.map((r) => Math.round(Math.min(1, median(r) ?? 0) * 100));
}

/** Weekday and hour in the server's local time zone (run it in campus time, America/Toronto). */
export function localParts(ts: number) {
  const d = new Date(ts);
  return { weekday: d.getDay(), hour: d.getHours() };
}
