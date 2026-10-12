/**
 * SNAPSHOT — builds the answer to GET /occupancy: every building with its level, trend,
 * floors/areas and typical-day curve, worked out fresh from the stored readings.
 *
 * Recomputing from raw readings on every request is simple and fast enough for one campus
 * (well under a second for 8 weeks of data). If it ever gets slow, cache the result for a minute.
 */
import { BUILDINGS, ZONES } from '../src/data/buildings';
import type { Building, Snapshot, Zone, ZoneInfo } from '../src/data/types';

import { baseline, levelFromRatio, localParts, ratio, trendOf, typicalDay, TYPICAL_MS, type Sample } from './logic';
import type { Row, Store } from './store';

/**
 * GET /occupancy: the app's Snapshot, as of `at` (default now).
 *
 * The latest reading time across all zones is "now" for the feed. A zone missing from that
 * reading has no data (ITS omits closed zones; the app turns those into "Closed" using opening
 * hours). "<10" readings show as low activity. A building's level is the sum of its zones
 * against the building's own p95.
 */
export function buildSnapshot(store: Store, at = Date.now(), parts = localParts): Snapshot {
  // 1. Load the last 8 weeks of readings (enough for typical-day curves), up to `at`.
  const rows = store.since(at - TYPICAL_MS).filter((r) => r.ts <= at);
  // The newest reading time = "now" as far as the feed is concerned.
  const updatedAt = rows.reduce((m, r) => Math.max(m, r.ts), 0);

  // 2. Group the readings by zone: "weldon-f1" → [its readings, oldest first].
  const byZone = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byZone.get(r.zone);
    if (list) list.push(r);
    else byZone.set(r.zone, [r]);
  }

  // 3. Work out every building, one at a time.
  const buildings = BUILDINGS.map((info): Building => {
    const zones = ZONES.filter((z) => z.building === info.id);
    // The building's total count at every reading time, and what's "normal" for it.
    const totals = buildingTotals(zones, byZone);
    const base = baseline(totals, at);
    // This building's zones that are in the newest reading.
    const latest = zones.map((z) => byZone.get(z.id)?.find((r) => r.ts === updatedAt)).filter((r): r is Row => !!r);

    // Floors / areas as the app shows them (undefined if the building has none).
    const zoneView = (kind: ZoneInfo['kind']) => {
      const list = zones.filter((z) => z.kind === kind).map((z) => zoneReading(z, byZone.get(z.id) ?? [], updatedAt, at));
      return list.length ? list : undefined;
    };
    const common = {
      ...info,
      floors: zoneView('floor'),
      areas: zoneView('area'),
      typicalDay: totals.length ? typicalDay(totals, base, at, parts) : undefined,
    };

    // Decide the building's status: no zones reporting → no data; all "<10" → low activity;
    // otherwise live, with a level from the total and a trend from recent totals.
    if (latest.length === 0) return { ...common, status: 'nodata' };
    if (latest.every((r) => r.belowThreshold)) return { ...common, status: 'low' };
    const total = latest.reduce((sum, r) => sum + (r.devices ?? 0), 0);
    const previous = totals.filter((s) => s.ts < updatedAt).map((s) => s.devices);
    return { ...common, status: 'live', level: levelFromRatio(ratio(total, base)), trend: trendOf(total, previous) };
  });

  return { updatedAt, buildings };
}

/** Building count per reading time: the sum of its zones, with "<10" counted as 0. */
function buildingTotals(zones: ZoneInfo[], byZone: Map<string, Row[]>): Sample[] {
  const sums = new Map<number, number>();
  for (const z of zones)
    for (const r of byZone.get(z.id) ?? []) sums.set(r.ts, (sums.get(r.ts) ?? 0) + (r.devices ?? 0));
  return [...sums].map(([ts, devices]) => ({ ts, devices })).sort((a, b) => a.ts - b.ts);
}

/** One floor/area for the app: its level against its own baseline, or "low" / "nodata". */
function zoneReading(z: ZoneInfo, rows: Row[], updatedAt: number, at: number): Zone {
  const r = rows.find((x) => x.ts === updatedAt);
  if (!r) return { name: z.name, status: 'nodata' };
  if (r.belowThreshold || r.devices === null) return { name: z.name, status: 'low' };
  const samples = rows.filter((x) => x.devices !== null).map((x) => ({ ts: x.ts, devices: x.devices as number }));
  return { name: z.name, level: levelFromRatio(ratio(r.devices, baseline(samples, at))) };
}
