import { BUILDINGS, MOCK_READINGS } from './buildings';
import type { Building, BuildingReading, Snapshot } from './types';

/** How often the app re-fetches. The backend updates every 10–15 minutes. */
export const REFRESH_MS = 5 * 60 * 1000;

/**
 * Single seam for the data feed.
 *
 * TODO: replace the mock with a real request, e.g.
 *   const res = await fetch(`${API_URL}/occupancy`);
 *   const { updatedAt, readings } = await res.json();
 * The backend should already convert raw counts (Wi-Fi associations, door
 * counters…) into a relative Level per building so the app never shows headcounts.
 */
export async function fetchSnapshot(): Promise<Snapshot> {
  const readings: BuildingReading[] = MOCK_READINGS;
  const updatedAt = Date.now() - 6 * 60 * 1000;
  return { updatedAt, buildings: merge(readings) };
}

function merge(readings: BuildingReading[]): Building[] {
  const byId = new Map(readings.map((r) => [r.id, r]));
  return BUILDINGS.flatMap((info) => {
    const r = byId.get(info.id);
    return r ? [{ ...info, ...r }] : [];
  });
}
