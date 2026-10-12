/**
 * FAVORITES — remembers which buildings the user has starred, saved on their device.
 *
 * How it works:
 *   - A React "context" makes the favourites available to every screen without passing them
 *     down by hand. FavoritesProvider (in _layout.tsx) holds the data; any screen calls
 *     useFavorites() to read or change it.
 *   - AsyncStorage is a simple key → text store on the phone (localStorage on the web). We save
 *     the list of ids as JSON under KEY, so favourites survive closing the app.
 *   - Nothing is sent to a server: favourites are private to the device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Storage key. The ".v1" lets us change the saved format later without reading old data wrongly. */
const KEY = 'occupied.favorites.v1';
/** New users start with no favourites (the home screen shows a hint instead). */
const DEFAULT_FAVORITES: string[] = [];

/** What useFavorites() gives you. */
type FavoritesState = {
  /** Starred building ids, in the order they were starred, e.g. ['weldon', 'rec'] */
  favorites: string[];
  /** Saved favorites have been read from the device */
  loaded: boolean;
  isFavorite: (id: string) => boolean;
  /** Star it if it isn't, un-star it if it is */
  toggle: (id: string) => void;
};

// The context starts empty (null); FavoritesProvider fills it in.
const Ctx = createContext<FavoritesState | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(DEFAULT_FAVORITES);
  const [loaded, setLoaded] = useState(false);

  // 1. On start-up (the empty [] means "run once"), read saved favourites from the device.
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          // Be defensive: only accept an array of strings, in case the stored data is damaged.
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setFavorites(parsed.filter((x): x is string => typeof x === 'string'));
        }
      })
      .catch(() => {}) // storage unavailable (e.g. private browsing) → just start empty
      .finally(() => setLoaded(true));
  }, []);

  // 2. Whenever favourites change, save them. We wait until `loaded` so we don't overwrite the
  //    saved list with the empty default before it has been read.
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(favorites)).catch(() => {});
  }, [favorites, loaded]);

  // useCallback keeps the same function between renders, so components using it don't
  // re-draw unnecessarily. `f` is the current list.
  const toggle = useCallback((id: string) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }, []);

  // Bundle everything into one object; only rebuilt when the inputs change.
  const value = useMemo<FavoritesState>(
    () => ({ favorites, loaded, isFavorite: (id) => favorites.includes(id), toggle }),
    [favorites, loaded, toggle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read/change favourites from any screen inside FavoritesProvider. */
export function useFavorites() {
  const v = useContext(Ctx);
  // A clear error if someone forgets to wrap the app in the provider.
  if (!v) throw new Error('useFavorites must be used inside FavoritesProvider');
  return v;
}
