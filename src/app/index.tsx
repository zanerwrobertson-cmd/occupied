import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BuildingCard } from '@/components/BuildingCard';
import { CampusMap } from '@/components/CampusMap';
import { ClockIcon, ListIcon, LogoMark, MapIcon, SearchIcon, StarIcon } from '@/components/Icons';
import { SectionTitle } from '@/components/SectionTitle';
import { Segmented } from '@/components/Segmented';
import type { Building } from '@/data/types';
import { minutesAgo } from '@/lib/levels';
import { useFavorites } from '@/state/favorites';
import { useOccupancy } from '@/state/occupancy';
import { font, useTheme } from '@/theme/theme';

type View_ = 'list' | 'map';
type Sort = 'az' | 'quiet';

export default function Home() {
  const { t } = useTheme();
  const { snapshot, now, error } = useOccupancy();
  const { favorites } = useFavorites();
  const [view, setView] = useState<View_>('list');
  const [sort, setSort] = useState<Sort>('az');
  const [query, setQuery] = useState('');

  const buildings = useMemo(() => snapshot?.buildings ?? [], [snapshot]);
  const q = query.trim().toLowerCase();

  const all = useMemo(() => {
    const matches = buildings.filter(
      (b) => !q || b.name.toLowerCase().includes(q) || b.short.toLowerCase().includes(q),
    );
    return matches.sort((a, b) => {
      if (sort === 'quiet' && a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });
  }, [buildings, q, sort]);

  const favs = useMemo(
    () => favorites.map((id) => buildings.find((b) => b.id === id)).filter((b): b is Building => !!b),
    [favorites, buildings],
  );

  const open = (id: string) => router.push({ pathname: '/building/[id]', params: { id } });

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <LogoMark bg={t.accent} fg={t.onAccent} />
            <Text accessibilityRole="header" style={[styles.wordmark, { color: t.text }]}>
              Occupied
            </Text>
          </View>
          {snapshot && (
            <View style={styles.updated}>
              <ClockIcon color={t.text2} />
              <Text style={[styles.updatedText, { color: t.text2 }]}>{minutesAgo(snapshot.updatedAt, now)}</Text>
            </View>
          )}
        </View>
        <Segmented<View_>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: 'List', icon: (c) => <ListIcon color={c} /> },
            { value: 'map', label: 'Map', icon: (c) => <MapIcon color={c} /> },
          ]}
        />
      </View>

      {!snapshot ? (
        <View style={styles.center}>
          {error ? (
            <Text style={[styles.note, { color: t.text2 }]}>{error}</Text>
          ) : (
            <ActivityIndicator color={t.accent} />
          )}
        </View>
      ) : view === 'map' ? (
        <CampusMap buildings={buildings} onOpen={open} />
      ) : (
        <>
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
                clearButtonMode="while-editing"
                returnKeyType="search"
                style={[styles.input, { color: t.text }]}
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {!q && favs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.favTitle}>
                  <StarIcon size={14} color={t.accent} filled />
                  <SectionTitle>Favorites</SectionTitle>
                </View>
                {favs.map((b) => (
                  <BuildingCard key={b.id} building={b} favorite onPress={() => open(b.id)} />
                ))}
              </View>
            )}

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
              {all.map((b) => (
                <BuildingCard key={b.id} building={b} onPress={() => open(b.id)} />
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

const styles = StyleSheet.create({
  root: { flex: 1 },
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
