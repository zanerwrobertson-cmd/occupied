import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'occupied.favorites.v1';
const DEFAULT_FAVORITES: string[] = [];

type FavoritesState = {
  favorites: string[];
  /** Saved favorites have been read from the device */
  loaded: boolean;
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
};

const Ctx = createContext<FavoritesState | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(DEFAULT_FAVORITES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setFavorites(parsed.filter((x): x is string => typeof x === 'string'));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(favorites)).catch(() => {});
  }, [favorites, loaded]);

  const toggle = useCallback((id: string) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }, []);

  const value = useMemo<FavoritesState>(
    () => ({ favorites, loaded, isFavorite: (id) => favorites.includes(id), toggle }),
    [favorites, loaded, toggle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFavorites must be used inside FavoritesProvider');
  return v;
}
