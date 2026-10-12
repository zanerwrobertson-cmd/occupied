/**
 * Tests for the simulator (scripts/sim/core.ts), run against the real server code with an
 * in-memory store — no network needed:
 *   - payloads follow the ITS format and privacy rules,
 *   - the daily curves have the right shape,
 *   - every scenario gets the expected response from the server,
 *   - a full 6-week backfill gives sensible levels (Weldon busy on a weekday evening).
 */
import { BUILDINGS, ZONES } from '../../src/data/buildings';
import { isOpen, withOpeningHours } from '../../src/lib/hours';
import { handleIngest } from '../../server/ingest';
import { buildSnapshot } from '../../server/snapshot';
import { MemoryStore } from '../../server/store';
import {
  buildPayload,
  expectedShare,
  MISSING_ZONE,
  parseDuration,
  scenarioRequests,
  SCENARIOS,
  seededRng,
  STALE_AGE_MS,
  WEEKEND_FACTOR,
  type Payload,
} from '../sim/core';

const KEY = 'test-key';
const ZONE_IDS = new Set(ZONES.map((z) => z.id));
// Local times, matching how the simulator and server read opening hours.
const MON_2PM = new Date(2026, 9, 12, 14, 0);
const MON_3AM = new Date(2026, 9, 12, 3, 0);

describe('buildPayload', () => {
  const p = buildPayload(MON_2PM, seededRng(1));

  it('matches the ITS format exactly', () => {
    expect(Object.keys(p).sort()).toEqual(['timestamp', 'zones']);
    expect(p.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    for (const z of p.zones) {
      expect(Object.keys(z).sort()).toEqual(['devices', 'zone']);
      expect(z.devices === '<10' || (Number.isInteger(z.devices) && z.devices >= 10)).toBe(true);
    }
  });

  it('only uses zone ids from the app data, named building-floor or building-area', () => {
    for (const z of p.zones) {
      expect(ZONE_IDS.has(z.zone)).toBe(true);
      expect(z.zone).toMatch(/^[a-z]+-[a-z0-9-]+$/);
    }
    expect(p.zones.map((z) => z.zone)).toEqual(expect.arrayContaining(['weldon-f1', 'ucc-spoke', 'rec-pool']));
  });

  it('never includes MAC addresses, access points or residences', () => {
    const json = JSON.stringify(p).toLowerCase();
    expect(json).not.toMatch(/mac|\bap\b|access.?point|bssid|residence|([0-9a-f]{2}:){5}[0-9a-f]{2}/);
  });

  it('omits zones of closed buildings', () => {
    expect(buildPayload(MON_3AM, seededRng(1)).zones).toEqual([]);
    const sunday9am = new Date(2026, 9, 11, 9, 0); // academic opens at 9, libraries at 10 (placeholder hours)
    const zones = buildPayload(sunday9am, seededRng(1)).zones.map((z) => z.zone);
    expect(zones).toContain('ssc-main');
    expect(zones.some((z) => z.startsWith('weldon-'))).toBe(false);
    for (const z of zones) {
      const b = BUILDINGS.find((x) => x.id === ZONES.find((y) => y.id === z)!.building)!;
      expect(isOpen(b.hours, sunday9am)).toBe(true);
    }
  });

  it('sends counts under 10 as "<10"', () => {
    const late = buildPayload(new Date(2026, 9, 12, 21, 30), seededRng(2)); // academic buildings are near empty
    expect(late.zones.find((z) => z.zone === 'tc-main')?.devices).toBe('<10');
  });
});

describe('curves', () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

  it('library: morning ramp, evening rush', () => {
    expect(expectedShare('weldon', at(12, 8))).toBeLessThan(expectedShare('weldon', at(12, 12)));
    expect(expectedShare('weldon', at(12, 20))).toBeGreaterThan(expectedShare('weldon', at(12, 15)));
  });

  it('UCC: lunch peak beats the dinner bump', () => {
    expect(expectedShare('ucc', at(12, 12, 30))).toBeGreaterThan(expectedShare('ucc', at(12, 18)));
    expect(expectedShare('ucc', at(12, 18))).toBeGreaterThan(expectedShare('ucc', at(12, 16)));
  });

  it('rec: early-morning and 4–8 PM peaks', () => {
    expect(expectedShare('rec', at(12, 7))).toBeGreaterThan(expectedShare('rec', at(12, 10)));
    expect(expectedShare('rec', at(12, 18))).toBeGreaterThan(expectedShare('rec', at(12, 7)));
  });

  it('academic: spikes at class changes, dead after 6 PM', () => {
    expect(expectedShare('ssc', at(12, 10, 30))).toBeGreaterThan(expectedShare('ssc', at(12, 10, 0)));
    expect(expectedShare('ssc', at(12, 19))).toBeLessThan(0.05);
  });

  it('weekends are ~40% of weekdays', () => {
    expect(expectedShare('weldon', at(11, 14)) / expectedShare('weldon', at(12, 14))).toBeCloseTo(WEEKEND_FACTOR);
  });

  it('noise stays within ±10%', () => {
    const counts = Array.from({ length: 200 }, (_, i) => buildPayload(MON_2PM, seededRng(i)).zones.find((z) => z.zone === 'ssc-main')!.devices as number);
    const expected = 700 * expectedShare('ssc', MON_2PM);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(Math.floor(expected * 0.9));
    expect(Math.max(...counts)).toBeLessThanOrEqual(Math.ceil(expected * 1.1));
  });
});

describe('scenarios', () => {
  const run = (name: (typeof SCENARIOS)[number]) => {
    const store = new MemoryStore();
    const results = scenarioRequests(name, MON_2PM, seededRng(3), KEY).map((r) => ({
      r,
      res: handleIngest(store, KEY, r.key, r.body),
    }));
    return { store, results };
  };

  it.each(SCENARIOS)('%s: server answers with the expected status', (name) => {
    const { results } = run(name);
    expect(results.length).toBeGreaterThan(0);
    for (const { r, res } of results) expect({ label: r.label, status: res.status }).toEqual({ label: r.label, status: r.expect });
  });

  it('missing-zone: that floor shows "no data", the rest stay live', () => {
    const { store } = run('missing-zone');
    const weldon = buildSnapshot(store, MON_2PM.getTime()).buildings.find((b) => b.id === 'weldon')!;
    expect(weldon.status).toBe('live');
    expect(weldon.floors?.find((f) => f.name === 'Floor 3')?.status).toBe('nodata');
    expect(MISSING_ZONE).toBe('weldon-f3');
  });

  it('all-below-threshold: every open building is low activity', () => {
    const { store } = run('all-below-threshold');
    const snap = buildSnapshot(store, MON_2PM.getTime());
    expect(snap.buildings.every((b) => b.status === 'low')).toBe(true);
  });

  it('stale: the only reading is 45 minutes old', () => {
    const { store } = run('stale');
    const snap = buildSnapshot(store, MON_2PM.getTime());
    expect(MON_2PM.getTime() - snap.updatedAt).toBe(STALE_AGE_MS);
  });

  it('bad-key and malformed: nothing is stored', () => {
    expect(run('bad-key').store.since(0)).toHaveLength(0);
    expect(run('malformed').store.since(0)).toHaveLength(0);
  });

  it('duplicate-timestamp: the second reading overwrites the first', () => {
    const { store, results } = run('duplicate-timestamp');
    const second = JSON.parse(results[1].r.body) as Payload;
    const f1 = second.zones.find((z) => z.zone === 'weldon-f1')!.devices;
    const stored = store.since(0).filter((r) => r.zone === 'weldon-f1');
    expect(stored).toHaveLength(1);
    expect(stored[0].devices).toBe(f1);
  });

  it('out-of-order: a late older reading does not replace the latest', () => {
    const { store } = run('out-of-order');
    expect(buildSnapshot(store, MON_2PM.getTime()).updatedAt).toBe(MON_2PM.getTime());
    expect(new Set(store.since(0).map((r) => r.ts)).size).toBe(2);
  });
});

describe('end to end: 6-week backfill', () => {
  const store = new MemoryStore();
  const end = new Date(2026, 9, 16, 23, 0).getTime(); // Friday night
  const rng = seededRng(42);
  beforeAll(() => {
    for (let t = end - parseDuration('6w'); t <= end; t += parseDuration('15m')) {
      const p = buildPayload(new Date(t), rng);
      if (p.zones.length) handleIngest(store, KEY, KEY, JSON.stringify(p));
    }
  });
  const weldonAt = (d: Date) => buildSnapshot(store, d.getTime()).buildings.find((b) => b.id === 'weldon')!;

  it('Weldon is busy at 8 PM on a weekday', () => {
    const b = weldonAt(new Date(2026, 9, 15, 20, 0)); // Thursday
    expect(b.status).toBe('live');
    expect(b.level).toBeGreaterThanOrEqual(2);
  });

  it('Weldon is quiet at opening on Sunday, and shows Closed before it opens', () => {
    expect(weldonAt(new Date(2026, 9, 11, 10, 0)).level).toBe(0);
    // Nothing on campus is open at 8 AM Sunday (placeholder hours), so the newest reading is from
    // Saturday night; the app applies opening hours on top and shows Closed.
    const sun8 = new Date(2026, 9, 11, 8, 0);
    expect(withOpeningHours(weldonAt(sun8), sun8).status).toBe('closed');
  });

  it('typicalDay peaks in the evening for Weldon on a weekday', () => {
    const curve = weldonAt(new Date(2026, 9, 15, 23, 0)).typicalDay!;
    expect(curve).toHaveLength(17);
    expect(curve.indexOf(Math.max(...curve)) + 7).toBeGreaterThanOrEqual(19);
  });
});
