/**
 * HOME SCREEN (route "/") — the first screen students see.
 *
 * Layout, top to bottom:
 *   - Header: logo, "Updated X min ago", the List | Map switch, and a stale-data banner if needed.
 *   - List view: search box, Favorites section (or a hint if there are none), then every building
 *     as a card, sortable A–Z or Quietest first.
 *   - Map view: the CampusMap component instead of the list.
 *
 * All the data comes from useOccupancy() (src/state/occupancy.tsx); this file only decides what
 * to show and in what order.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BuildingCard } from '@/components/BuildingCard';
import { CampusMap } from '@/components/CampusMap';
import { ClockIcon, ListIcon, LogoMark, MapIcon, SearchIcon, StarIcon } from '@/components/Icons';
import { SectionTitle } from '@/components/SectionTitle';
import { StaleBanner } from '@/components/StaleBanner';
import { Segmented } from '@/components/Segmented';
import type { Building } from '@/data/types';
import { minutesAgo, quietRank } from '@/lib/levels';
import { matchesQuery, normalize } from '@/lib/search';
import { useFavorites } from '@/state/favorites';
import { useOccupancy } from '@/state/occupancy';
import { font, useTheme } from '@/theme/theme';

// The two options of each segmented switch. (`View_` has an underscore because `View` is
// already taken by the React Native component imported above.)
type View_ = 'list' | 'map';
type Sort = 'az' | 'quiet';

export default function Home() {
  // --- Shared data --------------------------------------------------------------------------
  const { t } = useTheme(); // colours for light/dark mode
  // snapshot = latest busyness data (null until the first load finishes)
  // now      = current time, ticking every 30 s so "Updated X min ago" stays correct
  // error    = message if loading failed
  // stale    = true if the data is over 30 min old or the last refresh failed
  const { snapshot, now, error, stale } = useOccupancy();
  // favorites = list of starred building ids; favoritesLoaded = finished reading them from storage
  const { favorites, loaded: favoritesLoaded } = useFavorites();

  // --- Screen state (only this screen cares about these) -----------------------------------
  // useState gives a value plus a function to change it; changing it re-draws the screen.
  const [view, setView] = useState<View_>('list'); // List or Map
  const [sort, setSort] = useState<Sort>('az'); // A–Z or Quietest first
  const [query, setQuery] = useState(''); // what's typed in the search box

  // useMemo remembers a calculated value and only recalculates when its inputs (the array at
  // the end) change. Here: the building list, or an empty list while still loading.
  const buildings = useMemo(() => snapshot?.buildings ?? [], [snapshot]);
  // Search text with case and punctuation removed, e.g. "D.B. Weldon" → "dbweldon".
  const q = normalize(query);

  // Buildings that match the search, sorted. Recomputed only when data, search or sort changes.
  const all = useMemo(() => {
    const matches = buildings.filter((b) => matchesQuery(b, q));
    return matches.sort((a, b) => {
      // "Quietest first": order by quietRank (Quiet → Very Busy → Low activity → Closed → No data).
      if (sort === 'quiet' && quietRank(a) !== quietRank(b)) return quietRank(a) - quietRank(b);
      // Otherwise (or when equally busy), alphabetical by name.
      return a.name.localeCompare(b.name);
    });
  }, [buildings, q, sort]);

  // Turn the favourite ids into Building objects, in the order they were starred.
  // Ids that no longer exist in the data are dropped by the filter.
  const favs = useMemo(
    () => favorites.map((id) => buildings.find((b) => b.id === id)).filter((b): b is Building => !!b),
    [favorites, buildings],
  );

  // Navigate to the detail screen for one building (src/app/building/[id].tsx).
  const open = (id: string) => router.push({ pathname: '/building/[id]', params: { id } });

  // --- What's drawn on screen ---------------------------------------------------------------
  return (
    // SafeAreaView adds padding at the top so content isn't hidden under the notch/status bar.
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: t.bg }]}>
      {/* ===== Header ===== */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          {/* Logo + app name */}
          <View style={styles.brand}>
            <LogoMark bg={t.accent} fg={t.onAccent} />
            <Text accessibilityRole="header" style={[styles.wordmark, { color: t.text }]}>
              Occupied
            </Text>
          </View>
          {/* "Updated 6 min ago" — only once there's data */}
          {snapshot && (
            <View style={styles.updated}>
              <ClockIcon color={t.text2} />
              <Text style={[styles.updatedText, { color: t.text2 }]}>{minutesAgo(snapshot.updatedAt, now)}</Text>
            </View>
          )}
        </View>
        {/* List | Map switch */}
        <Segmented<View_>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: 'List', icon: (c) => <ListIcon color={c} /> },
            { value: 'map', label: 'Map', icon: (c) => <MapIcon color={c} /> },
          ]}
        />
        {/* "Data may be out of date" when the data is old or the last refresh failed */}
        {stale && <StaleBanner />}
      </View>

      {/* ===== Body: one of three states ===== */}
      {!snapshot ? (
        // 1. No data yet: show the error if loading failed, otherwise a spinner.
        <View style={styles.center}>
          {error ? (
            <Text style={[styles.note, { color: t.text2 }]}>{error}</Text>
          ) : (
            <ActivityIndicator color={t.accent} />
          )}
        </View>
      ) : view === 'map' ? (
        // 2. Map view. `muted` greys the colours when the data is stale.
        <CampusMap buildings={buildings} muted={stale} onOpen={open} />
      ) : (
        // 3. List view (the <>…</> "fragment" groups two siblings without adding a wrapper view).
        <>
          {/* Search box — stays fixed above the scrolling list */}
          <View style={styles.searchWrap}>
            <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.border }]}>
              <SearchIcon color={t.text2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search buildings"
                placeholderTextColor={t.text2}
                accessibilityLabel="Search buildings"
                autoCorrect={false}
                clearButtonMode="while-editing" // iOS shows an ✕ to clear the text
                returnKeyType="search"
                style={[styles.input, { color: t.text }]}
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled" // taps on cards work even while the keyboard is open
            keyboardDismissMode="on-drag" // scrolling hides the keyboard
            showsVerticalScrollIndicator={false}
          >
            {/* No favourites yet (and not searching): a one-line hint instead of an empty section.
                We wait for favoritesLoaded so the hint doesn't flash before saved favourites load. */}
            {!q && favoritesLoaded && favs.length === 0 && (
              <Text style={[styles.hint, { color: t.text2 }]}>Tap ☆ on a building to pin it here</Text>
            )}
            {/* Favourites section (hidden while searching so results aren't shown twice) */}
            {!q && favs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.favTitle}>
                  <StarIcon size={14} color={t.accent} filled />
                  <SectionTitle>Favorites</SectionTitle>
                </View>
                {favs.map((b) => (
                  <BuildingCard key={b.id} building={b} favorite muted={stale} onPress={() => open(b.id)} />
                ))}
              </View>
            )}

            {/* All buildings (or search results) */}
            <View style={styles.section}>
              <View style={styles.listHead}>
                <SectionTitle>{q ? 'Results' : 'All buildings'}</SectionTitle>
                <Segmented<Sort>
                  label="Sort"
                  compact
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: 'az', label: 'A–Z' },
                    { value: 'quiet', label: 'Quietest first' },
                  ]}
                />
              </View>
              {/* `key` lets React track each card between re-draws; it must be unique. */}
              {all.map((b) => (
                <BuildingCard key={b.id} building={b} muted={stale} onPress={() => open(b.id)} />
              ))}
              {all.length === 0 && (
                <Text style={[styles.empty, { color: t.text2, borderColor: t.border }]}>
                  No buildings match “{query}”
                </Text>
              )}
            </View>

            <Text style={[styles.note, { color: t.text2 }]}>
              Levels compare each building to its own normal range. Refreshes every 10–15 min.
            </Text>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

// --- Styles ----------------------------------------------------------------------------------
// StyleSheet.create is like CSS for React Native. Colours aren't here because they depend on
// light/dark mode — they're passed in-line from the theme (`t`) above.
const styles = StyleSheet.create({
  root: { flex: 1 }, // fill the whole screen
  header: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: font.extrabold, fontSize: 22, letterSpacing: -0.4 },
  updated: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  updatedText: { fontFamily: font.medium, fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: { flex: 1, height: '100%', fontFamily: font.regular, fontSize: 16 },
  scroll: { paddingTop: 6, paddingHorizontal: 20, paddingBottom: 40, gap: 22 },
  section: { gap: 10 },
  favTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hint: { fontFamily: font.medium, fontSize: 14 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  empty: {
    marginTop: 8,
    padding: 24,
    textAlign: 'center',
    fontFamily: font.regular,
    fontSize: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  note: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
