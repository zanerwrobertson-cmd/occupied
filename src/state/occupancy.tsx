/**
 * OCCUPANCY STATE — loads the busyness data and keeps it fresh for every screen.
 *
 * What it does:
 *   - fetches data as soon as the app opens,
 *   - re-fetches every 5 minutes (REFRESH_MS) and whenever the app comes back to the foreground,
 *   - ticks a clock every 30 seconds, so "Updated X min ago" and opening hours stay correct,
 *   - marks buildings "Closed" outside their opening hours (whatever the feed said),
 *   - works out `stale`: the data is over 30 minutes old OR the last refresh failed. Old data
 *     is kept on screen (better than nothing) with a "Data may be out of date" banner.
 *
 * Like favorites.tsx, it uses a React context: OccupancyProvider (in _layout.tsx) holds the
 * data, and any screen reads it with useOccupancy().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { fetchSnapshot, REFRESH_MS, STALE_MS } from '@/data/source';
import type { Building, Snapshot } from '@/data/types';
import { withOpeningHours } from '@/lib/hours';

/** What useOccupancy() gives you. */
type OccupancyState = {
  /** Latest snapshot, with buildings outside opening hours marked "closed" */
  snapshot: Snapshot | null;
  /** Message from the last failed refresh, or null if it worked */
  error: string | null;
  /** Snapshot is older than STALE_MS, or the last refresh failed */
  stale: boolean;
  /** Ticks every 30 s so "Updated X min ago" stays honest */
  now: number;
  /** Fetch new data right now */
  refresh: () => Promise<void>;
  /** Find one building by id, e.g. getBuilding('weldon') */
  getBuilding: (id: string) => Building | undefined;
};

const Ctx = createContext<OccupancyState | null>(null);

export function OccupancyProvider({ children }: { children: ReactNode }) {
  // `raw` = exactly what fetchSnapshot returned (before opening hours are applied).
  const [raw, setRaw] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  /** Fetch new data. On failure, keep the old data and remember the error. */
  const refresh = useCallback(async () => {
    try {
      setRaw(await fetchSnapshot());
      setError(null);
    } catch (e) {
      // Keep the previous snapshot; `stale` flags it on screen.
      setError(e instanceof Error ? e.message : 'Could not load data');
    }
    setNow(Date.now());
  }, []);

  // Set up all the timers once. The function returned at the end runs when the provider is
  // removed, and cleans the timers up so they don't keep running in the background.
  useEffect(() => {
    const first = setTimeout(refresh, 0); // first load, straight away
    const poll = setInterval(refresh, REFRESH_MS); // then every 5 minutes
    const tick = setInterval(() => setNow(Date.now()), 30_000); // clock tick every 30 s
    // AppState tells us when the app goes to the background and comes back ('active').
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
      sub.remove();
    };
  }, [refresh]);

  // Re-applied on every tick so a building flips to "Closed" at closing time even between refreshes.
  const snapshot = useMemo<Snapshot | null>(() => {
    if (!raw) return null;
    const at = new Date(now);
    return { ...raw, buildings: raw.buildings.map((b) => withOpeningHours(b, at)) };
  }, [raw, now]);

  // Show the banner if the data is too old, or the latest attempt to refresh it failed.
  const stale = !!raw && (error !== null || now - raw.updatedAt > STALE_MS);

  // Bundle everything for useOccupancy(); rebuilt only when something changes.
  const value = useMemo<OccupancyState>(
    () => ({
      snapshot,
      error,
      stale,
      now,
      refresh,
      getBuilding: (id) => snapshot?.buildings.find((b) => b.id === id),
    }),
    [snapshot, error, stale, now, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the busyness data from any screen inside OccupancyProvider. */
export function useOccupancy() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOccupancy must be used inside OccupancyProvider');
  return v;
}
