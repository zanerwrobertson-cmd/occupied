import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { fetchSnapshot, REFRESH_MS, STALE_MS } from '@/data/source';
import type { Building, Snapshot } from '@/data/types';
import { withOpeningHours } from '@/lib/hours';

type OccupancyState = {
  /** Latest snapshot, with buildings outside opening hours marked "closed" */
  snapshot: Snapshot | null;
  error: string | null;
  /** Snapshot is older than STALE_MS, or the last refresh failed */
  stale: boolean;
  /** Ticks every 30 s so "Updated X min ago" stays honest */
  now: number;
  refresh: () => Promise<void>;
  getBuilding: (id: string) => Building | undefined;
};

const Ctx = createContext<OccupancyState | null>(null);

export function OccupancyProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const poll = setInterval(refresh, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
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

  const stale = !!raw && (error !== null || now - raw.updatedAt > STALE_MS);

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

export function useOccupancy() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOccupancy must be used inside OccupancyProvider');
  return v;
}
