/**
 * Fake Western ITS feed: realistic device counts per zone. Pure functions only — the CLI that
 * sends them is scripts/simulator.ts.
 *
 * HOW A COUNT IS MADE (zoneCount)
 *   count = zone capacity × share for this building type at this time × weekend factor × noise
 *     - capacity:  rough peak headcount for the zone (CAPACITY below)
 *     - share:     0–1 from a daily curve per building type (CURVES below)
 *     - weekend:   × 0.4 on Saturday and Sunday
 *     - noise:     × a random 0.9–1.1, so no two readings are identical
 *   Counts under 10 become "<10". Buildings outside opening hours are left out entirely.
 *
 * Kept free of network code so the Jest tests can call it directly.
 */
import { BUILDINGS, ZONES } from '../../src/data/buildings';
import { isOpen } from '../../src/lib/hours';
import type { ZoneInfo } from '../../src/data/types';

// --- Types ---------------------------------------------------------------------------------
/** One zone in a reading, exactly as ITS would send it. */
export type ZonePayload = { zone: string; devices: number | '<10' };
/** One full reading: a timestamp and every open zone's count. */
export type Payload = { timestamp: string; zones: ZonePayload[] };
/** A random-number function returning 0 ≤ x < 1 (Math.random, or seededRng for tests). */
export type Rng = () => number;

// --- Building types and capacities -----------------------------------------------------------
/** Which daily pattern a building follows. */
type Kind = 'library' | 'food' | 'gym' | 'academic';

/** Building id → pattern. Anything not listed is 'academic'. */
const KIND: Record<string, Kind> = { weldon: 'library', taylor: 'library', ucc: 'food', rec: 'gym' };

/** Rough peak headcount per zone. Anything not listed uses ACADEMIC_DEFAULT. */
export const CAPACITY: Record<string, number> = {
  'weldon-f1': 260, 'weldon-f2': 220, 'weldon-f3': 200, 'weldon-f4': 160, 'weldon-f5': 130,
  'taylor-f1': 180, 'taylor-f2': 150, 'taylor-f3': 120, 'taylor-f4': 90,
  'rec-weights': 120, 'rec-cardio': 140, 'rec-courts': 200, 'rec-pool': 80,
  'ucc-spoke': 250, 'ucc-food-court': 400, 'ucc-lounges': 180,
  'ssc-main': 700, 'nsc-main': 300, 'pab-main': 200, 'mc-main': 300, 'uc-main': 350, 'tc-main': 150,
  'th-main': 300, 'ivey-main': 600, 'ahb-main': 250, 'fims-main': 400, 'hsb-main': 300, 'msb-main': 350,
  'bgs-main': 300, 'chem-main': 300, 'seb-main': 350, 'teb-main': 250, 'aceb-main': 400,
  'stevenson-main': 150, 'ncb-main': 450,
};
const ACADEMIC_DEFAULT = 300;

// --- Daily curves ------------------------------------------------------------------------------
/**
 * Share of capacity by local hour (fractional), as [hour, share] points joined by straight lines.
 * e.g. [12, 0.55] = at noon the zone is at 55% of capacity. 11.5 = 11:30.
 */
const CURVES: Record<Kind, [number, number][]> = {
  // Morning ramp, steady afternoon, evening rush that lasts until ~11 PM.
  library: [[7, 0.05], [8, 0.12], [10, 0.35], [12, 0.55], [16, 0.6], [18, 0.7], [19.5, 0.88], [21.5, 0.9], [22.5, 0.7], [23, 0.55], [24, 0.3]],
  // Lunch peak 11:30–1:30, smaller dinner bump.
  food: [[7, 0.08], [9, 0.2], [11, 0.35], [11.5, 0.8], [12.5, 0.98], [13.5, 0.75], [14.5, 0.35], [16.5, 0.35], [17.5, 0.55], [18.5, 0.5], [19.5, 0.25], [23, 0.08]],
  // Early-morning and 4–8 PM peaks.
  gym: [[6, 0.25], [6.75, 0.6], [8, 0.55], [9, 0.3], [12, 0.3], [13, 0.4], [15, 0.4], [16, 0.65], [17.5, 0.92], [20, 0.85], [21, 0.45], [23, 0.15]],
  // Daytime base; class-change spikes are added separately. Dead after 6 PM.
  academic: [[7, 0.03], [8, 0.2], [9, 0.45], [12, 0.55], [16, 0.45], [17, 0.3], [18, 0.06], [19, 0.03], [24, 0.02]],
};

/** Weekends are 40% as busy as weekdays. */
export const WEEKEND_FACTOR = 0.4;
/** ±10% random variation on every count. */
export const NOISE = 0.1;

/**
 * Value of a curve at hour h, drawing straight lines between its points.
 * e.g. points (10, 0.35) and (12, 0.55): at 11 → halfway → 0.45.
 */
function interpolate(points: [number, number][], h: number): number {
  if (h <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [h1, v1] = points[i];
    if (h <= h1) {
      const [h0, v0] = points[i - 1];
      return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0);
    }
  }
  return points[points.length - 1][1];
}

/** Classes start on the half hour 8:30–5:30; hallways and lounges fill for ~10 minutes either side. */
function classChangeSpike(h: number): number {
  if (h < 8.25 || h > 17.75) return 0;
  // How many minutes from the nearest :30 (h % 1 = the fraction of the hour, 0.5 = :30).
  const minutesFromHalf = Math.abs(((h % 1) - 0.5) * 60);
  // Biggest spike right at :30, fading to nothing 15 minutes either side.
  return minutesFromHalf >= 15 ? 0 : 0.35 * (1 - minutesFromHalf / 15);
}

/** Expected share of capacity (before noise) for a building at a local time. */
export function expectedShare(buildingId: string, at: Date): number {
  const kind = KIND[buildingId] ?? 'academic';
  const h = at.getHours() + at.getMinutes() / 60; // e.g. 14:30 → 14.5
  let share = interpolate(CURVES[kind], h);
  if (kind === 'academic') share += classChangeSpike(h);
  const weekend = at.getDay() === 0 || at.getDay() === 6;
  return weekend ? share * WEEKEND_FACTOR : share;
}

/** Peak headcount for a zone (default if not listed in CAPACITY). */
export function capacityOf(zone: string) {
  return CAPACITY[zone] ?? ACADEMIC_DEFAULT;
}

/** Device count for one zone, with ±10% noise. Counts under 10 become "<10". */
export function zoneCount(z: ZoneInfo, at: Date, rng: Rng): number | '<10' {
  // rng() is 0–1, so (rng() * 2 − 1) is −1 to 1, and noise is 0.9 to 1.1.
  const noise = 1 + (rng() * 2 - 1) * NOISE;
  const n = Math.round(capacityOf(z.id) * expectedShare(z.building, at) * noise);
  return n < 10 ? '<10' : n;
}

export type PayloadOptions = {
  /** Leave these zones out even though they're open (missing-zone scenario). */
  drop?: string[];
  /** Report every zone as "<10" (all-below-threshold scenario). */
  allBelow?: boolean;
};

/** One reading at `at`. Zones in buildings that are closed at that time are omitted. */
export function buildPayload(at: Date, rng: Rng, opts: PayloadOptions = {}): Payload {
  // Buildings open at this time (same opening hours the app uses).
  const open = new Set(BUILDINGS.filter((b) => isOpen(b.hours, at)).map((b) => b.id));
  const zones = ZONES.filter((z) => open.has(z.building) && !opts.drop?.includes(z.id)).map((z) => ({
    zone: z.id,
    devices: opts.allBelow ? ('<10' as const) : zoneCount(z, at, rng),
  }));
  return { timestamp: at.toISOString(), zones };
}

// ---------- scenarios ----------
// Edge cases for testing how the server and app cope with bad or unusual data.

export const SCENARIOS = [
  'missing-zone',
  'all-below-threshold',
  'stale',
  'bad-key',
  'malformed',
  'duplicate-timestamp',
  'out-of-order',
] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** Zone dropped by the missing-zone scenario. */
export const MISSING_ZONE = 'weldon-f3';
/** How far back the stale scenario's only reading is. */
export const STALE_AGE_MS = 45 * 60 * 1000;

/** One HTTP request a scenario makes: a label for the output, the key and body to send, and the status we expect back. */
export type SimRequest = { label: string; key: string; body: string; expect: number };

/**
 * The requests a scenario sends, with the status the server should answer. missing-zone and
 * all-below-threshold also apply to every reading in --live mode (see simulator.ts).
 */
export function scenarioRequests(name: Scenario, now: Date, rng: Rng, key: string): SimRequest[] {
  const ok = (label: string, p: Payload): SimRequest => ({ label, key, body: JSON.stringify(p), expect: 200 });
  const at = (msAgo: number) => new Date(now.getTime() - msAgo);
  switch (name) {
    case 'missing-zone':
      return [ok(`reading without ${MISSING_ZONE}`, buildPayload(now, rng, { drop: [MISSING_ZONE] }))];
    case 'all-below-threshold':
      return [ok('every zone "<10"', buildPayload(now, rng, { allBelow: true }))];
    case 'stale':
      return [ok('one reading from 45 min ago, then nothing', buildPayload(at(STALE_AGE_MS), rng))];
    case 'bad-key':
      return [{ label: 'wrong x-ingest-key', key: `${key}-wrong`, body: JSON.stringify(buildPayload(now, rng)), expect: 401 }];
    // Each of these must be rejected with 400 and store nothing.
    case 'malformed': {
      const ts = now.toISOString();
      const bad = (label: string, body: string): SimRequest => ({ label, key, body, expect: 400 });
      return [
        bad('not JSON', '{"timestamp":'),
        bad('missing timestamp', JSON.stringify({ zones: [] })),
        bad('timestamp not UTC', JSON.stringify({ timestamp: '2026-10-12 14:00', zones: [] })),
        bad('raw count under 10', JSON.stringify({ timestamp: ts, zones: [{ zone: 'weldon-f1', devices: 5 }] })),
        bad('negative count', JSON.stringify({ timestamp: ts, zones: [{ zone: 'weldon-f1', devices: -20 }] })),
        bad('extra field (MAC address)', JSON.stringify({ timestamp: ts, zones: [{ zone: 'weldon-f1', devices: 40, mac: 'aa:bb:cc:dd:ee:ff' }] })),
        bad('same zone twice', JSON.stringify({ timestamp: ts, zones: [{ zone: 'weldon-f1', devices: 40 }, { zone: 'weldon-f1', devices: 50 }] })),
      ];
    }
    case 'duplicate-timestamp': {
      const first = buildPayload(now, rng);
      const second = { ...first, zones: first.zones.map((z) => ({ ...z, devices: typeof z.devices === 'number' ? z.devices + 25 : z.devices })) };
      return [ok('reading', first), ok('same timestamp again, different counts (overwrites)', second)];
    }
    case 'out-of-order':
      return [ok('reading now', buildPayload(now, rng)), ok('older reading arriving late', buildPayload(at(15 * 60 * 1000), rng))];
  }
}

/**
 * Deterministic RNG for tests and repeatable runs.
 * "mulberry32": a tiny random-number generator that always gives the same sequence for the same
 * seed, so tests get identical "random" counts every time they run.
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "10s", "15m", "6h", "6w", "3d" → ms. */
export function parseDuration(s: string): number {
  const m = /^(\d+(?:\.\d+)?)(s|m|h|d|w)$/.exec(s.trim());
  if (!m) throw new Error(`Bad duration "${s}" — use e.g. 10s, 15m, 6h, 3d, 6w`);
  const unit = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3, w: 604800e3 }[m[2] as 's' | 'm' | 'h' | 'd' | 'w'];
  return Number(m[1]) * unit;
}
