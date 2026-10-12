import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeftIcon, ClockIcon, StarIcon, TrendIcon } from '@/components/Icons';
import { LevelBars } from '@/components/Level';
import { SectionTitle } from '@/components/SectionTitle';
import { TypicalDayChart } from '@/components/TypicalDayChart';
import { ZoneList } from '@/components/ZoneList';
import { comparedToUsual, formatHourLong, minutesAgo, TREND_TEXT, WEEKDAYS } from '@/lib/levels';
import { useFavorites } from '@/state/favorites';
import { useOccupancy } from '@/state/occupancy';
import { font, useTheme } from '@/theme/theme';

export default function BuildingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, level } = useTheme();
  const { getBuilding, snapshot, now } = useOccupancy();
  const { isFavorite, toggle } = useFavorites();
  const b = getBuilding(id ?? '');

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const date = new Date(now);
  const hour = date.getHours();

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back} hitSlop={6}>
          <ChevronLeftIcon color={t.accent} />
          <Text style={[styles.backText, { color: t.accent }]}>Back</Text>
        </Pressable>
        {b && (
          <Pressable
            onPress={() => toggle(b.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isFavorite(b.id) }}
            accessibilityLabel={isFavorite(b.id) ? 'Remove from Favorites' : 'Add to Favorites'}
            style={[styles.star, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <StarIcon color={t.accent} filled={isFavorite(b.id)} />
          </Pressable>
        )}
      </View>

      {!b ? (
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: t.text2 }]}>Building not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
              {b.name}
            </Text>
            {snapshot && (
              <Text style={[styles.updated, { color: t.text2 }]}>{minutesAgo(snapshot.updatedAt, now)}</Text>
            )}
          </View>

          {(() => {
            const s = level(b.level);
            const usual = comparedToUsual(b.level, b.typicalDay, hour);
            return (
              <View
                accessible
                accessibilityLabel={`Right now ${s.label}. ${TREND_TEXT[b.trend]}.${usual ? ` ${usual}.` : ''}`}
                style={[styles.hero, { backgroundColor: s.bg }]}
              >
                <View style={styles.heroTop}>
                  <View style={[styles.heroTile, { backgroundColor: s.solid }]}>
                    <LevelBars level={b.level} color={s.pinFg} scale={1.9} />
                  </View>
                  <View>
                    <Text style={[styles.heroKicker, { color: s.fg }]}>Right now</Text>
                    <Text style={[styles.heroLevel, { color: s.fg }]}>{s.label}</Text>
                  </View>
                </View>
                <View style={styles.heroLines}>
                  <View style={styles.heroLine}>
                    <TrendIcon trend={b.trend} color={s.fg} size={18} />
                    <Text style={[styles.heroLineText, { color: s.fg }]}>{TREND_TEXT[b.trend]}</Text>
                  </View>
                  {usual && (
                    <View style={styles.heroLine}>
                      <ClockIcon color={s.fg} size={18} />
                      <Text style={[styles.heroLineText, { color: s.fg }]}>{usual}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

          {b.floors && b.floors.length > 0 && <ZoneList title="By floor" zones={b.floors} />}
          {b.areas && b.areas.length > 0 && <ZoneList title={b.areasHeading ?? 'Areas'} zones={b.areas} />}

          <View style={styles.section}>
            <View style={styles.chartHead}>
              <SectionTitle>Typical {WEEKDAYS[date.getDay()]}</SectionTitle>
              <Text style={[styles.chartNow, { color: t.text2 }]}>Now · {formatHourLong(hour)}</Text>
            </View>
            <TypicalDayChart values={b.typicalDay} currentHour={hour} currentLevel={b.level} />
          </View>

          <Text style={[styles.foot, { color: t.text2 }]}>
            “{level(b.level).label}” is relative to this building’s normal range, not a headcount.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  back: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 6, paddingRight: 12 },
  backText: { fontFamily: font.semibold, fontSize: 16 },
  star: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontFamily: font.medium, fontSize: 16 },
  scroll: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  titleBlock: { gap: 4 },
  title: { fontFamily: font.extrabold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  updated: { fontFamily: font.medium, fontSize: 13 },
  hero: { padding: 20, borderRadius: 22, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 13,
  },
  heroKicker: { fontFamily: font.bold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.85 },
  heroLevel: { fontFamily: font.extrabold, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  heroLines: { gap: 6 },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLineText: { fontFamily: font.semibold, fontSize: 15 },
  section: { gap: 8 },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chartNow: { fontFamily: font.semibold, fontSize: 13 },
  foot: { fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
});
