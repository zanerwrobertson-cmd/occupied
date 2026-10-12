/**
 * DATA SOURCE — where the app gets its busyness data. The one place that talks to the network.
 *
 *   EXPO_PUBLIC_API_URL set   → fetch GET <url>/occupancy from the backend (server/ folder)
 *   not set                   → use the mock readings in buildings.ts (handy for design work)
 *
 * src/state/occupancy.tsx calls fetchSnapshot() on start-up, every 5 minutes, and whenever the
 * app comes back to the foreground.
 */
import { BUILDINGS, MOCK_READINGS } from './buildings';
import type { Building, BuildingReading, Snapshot } from './types';

/** How often the app re-fetches. The backend updates every 10–15 minutes. */
export const REFRESH_MS = 5 * 60 * 1000;

/** A snapshot older than this is flagged "Data may be out of date". */
export const STALE_MS = 30 * 60 * 1000;

/**
 * Backend base URL, e.g. http://192.168.1.23:4000 (see TESTING.md). Inlined at build time,
 * so it must be read exactly like this. Unset → mock data.
 * (Expo replaces `process.env.EXPO_PUBLIC_…` with the value from .env.local when it bundles the
 * app. Only EXPO_PUBLIC_ variables are included — never put secrets in one.)
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Single seam for the data feed. The backend already turns raw device counts into a
 * relative Level per building, so the app never sees headcounts.
 */
export async function fetchSnapshot(): Promise<Snapshot> {
  if (API_URL) return fetchFromApi(API_URL);
  // Mock mode: pretend the data was recorded 6 minutes ago.
  const readings: BuildingReading[] = MOCK_READINGS;
  const updatedAt = Date.now() - 6 * 60 * 1000;
  return { updatedAt, buildings: merge(readings) };
}

/**
 * Real mode: ask the backend. Any problem throws an error; the occupancy provider catches it,
 * keeps showing the last good data, and shows the "Data may be out of date" banner.
 */
async function fetchFromApi(base: string): Promise<Snapshot> {
  // Strip any trailing "/" so we don't request "…4000//occupancy".
  const res = await fetch(`${base.replace(/\/+$/, '')}/occupancy`);
  if (!res.ok) throw new Error(`Could not load data (${res.status})`);
  const body: unknown = await res.json();
  if (!isSnapshot(body)) throw new Error('Could not read data from the server');
  return body;
}

/** Basic sanity check on what the server sent back, so a wrong URL doesn't crash the app. */
function isSnapshot(x: unknown): x is Snapshot {
  const s = x as Partial<Snapshot> | null;
  return typeof s?.updatedAt === 'number' && Array.isArray(s.buildings);
}

/**
 * Mock mode only: combine static building info with the mock readings.
 * Every building in BUILDINGS, with "nodata" for any the feed didn't report.
 */
function merge(readings: BuildingReading[]): Building[] {
  // Map from id → reading, for quick lookups.
  const byId = new Map(readings.map((r) => [r.id, r]));
  return BUILDINGS.map((info): Building => {
    const r = byId.get(info.id);
    if (!r) return { ...info, status: 'nodata' };
    if (r.status === 'low') return { ...info, ...r, status: 'low' };
    return { ...info, ...r, status: 'live' };
  });
}
