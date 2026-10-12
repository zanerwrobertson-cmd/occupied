import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { fetchSnapshot, REFRESH_MS } from '@/data/source';
import type { Building, Snapshot } from '@/data/types';

type OccupancyState = {
  snapshot: Snapshot | null;
  error: string | null;
  /** Ticks every 30 s so "Updated X min ago" stays honest */
  now: number;
  refresh: () => Promise<void>;
  getBuilding: (id: string) => Building | undefined;
};

const Ctx = createContext<OccupancyState | null>(null);

export function OccupancyProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await fetchSnapshot());
      setError(null);
    } catch (e) {
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

  const value = useMemo<OccupancyState>(
    () => ({
      snapshot,
      error,
      now,
      refresh,
      getBuilding: (id) => snapshot?.buildings.find((b) => b.id === id),
    }),
    [snapshot, error, now, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOccupancy() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOccupancy must be used inside OccupancyProvider');
  return v;
}
