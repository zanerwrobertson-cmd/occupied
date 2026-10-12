/**
 * BUILDING DETAIL SCREEN (route "/building/<id>", e.g. /building/weldon).
 *
 * The square brackets in the file name make `id` a URL parameter: opening /building/weldon
 * gives this screen id = "weldon".
 *
 * Layout, top to bottom:
 *   - Back button and Favorites star
 *   - Building name, "Updated X min ago", today's opening hours
 *   - Stale-data banner (if needed)
 *   - The big "Right now" card: level (or Closed / No data / Low activity), trend, and
 *     "Busier than usual for 2 PM"
 *   - Floors and sub-areas, each with its own level
 *   - Typical-day hourly chart
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChevronLeftIcon, ClockIcon, StarIcon, TrendIcon } from '@/components/Icons';
import { LevelBars } from '@/components/Level';
import { SectionTitle } from '@/components/SectionTitle';
import { StaleBanner } from '@/components/StaleBanner';
import { TypicalDayChart } from '@/components/TypicalDayChart';
import { ZoneList } from '@/components/ZoneList';
import { todaysHours } from '@/lib/hours';
import { comparedToUsual, DAY_HOURS, formatHourLong, minutesAgo, TREND_TEXT } from '@/lib/levels';
import { useFavorites } from '@/state/favorites';
import { useOccupancy } from '@/state/occupancy';
import { font, useTheme } from '@/theme/theme';

export default function BuildingDetail() {
  // Read the building id from the URL.
  const { id } = useLocalSearchParams<{ id: string }>();
  // t = colours; display(b) = colours + label for a building's level or status.
  const { t, display } = useTheme();
  const { getBuilding, snapshot, now, stale } = useOccupancy();
  const { isFavorite, toggle } = useFavorites();
  // Look up this building in the latest data. undefined if the id doesn't exist.
  const b = getBuilding(id ?? '');

  // Go back to the previous screen. If someone opened this page directly (e.g. a web link),
  // there's nothing to go back to, so go to Home instead.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Current time, from the provider's clock that ticks every 30 seconds.
  const date = new Date(now);
  const hour = date.getHours();

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: t.bg }]}>
      {/* ===== Top bar: Back + Favorite star ===== */}
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
            {/* Filled star = favourite, outline = not */}
            <StarIcon color={t.accent} filled={isFavorite(b.id)} />
          </Pressable>
        )}
      </View>

      {!b ? (
        // Unknown id (e.g. a mistyped URL).
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: t.text2 }]}>Building not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ===== Title block ===== */}
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
              {b.name}
            </Text>
            {snapshot && (
              <Text style={[styles.updated, { color: t.text2 }]}>{minutesAgo(snapshot.updatedAt, now)}</Text>
            )}
            {/* e.g. "Hours today: 8 AM – 11 PM" or "Closed today" */}
            <Text style={[styles.updated, { color: t.text2 }]}>Hours today: {todaysHours(b.hours, date)}</Text>
          </View>

          {stale && <StaleBanner />}

          {/* ===== "Right now" card =====
              Written as an immediately-called function so we can set up a few local variables
              (s, live, usual) right where they're used. */}
          {(() => {
            // s = colours + label. If live: the level's colours (greyed when stale).
            // Otherwise neutral grey with "Closed" / "No data yet" / "Low activity".
            const s = display(b, stale);
            const live = b.status === 'live';
            // "Busier than usual for 2 PM", or null when it doesn't apply (closed, no data,
            // outside 7 AM–11 PM, or no typical-day curve).
            const usual = comparedToUsual(b, hour);
            return (
              <View
                // `accessible` + label: screen readers read the whole card as one sentence.
                accessible
                accessibilityLabel={
                  `Right now ${s.label}.` + (live ? ` ${TREND_TEXT[b.trend]}.` : '') + (usual ? ` ${usual}.` : '')
                }
                style={[styles.hero, { backgroundColor: s.bg }]}
              >
                <View style={styles.heroTop}>
                  {/* Coloured tile with 1–4 bars (all faint when there's no level) */}
                  <View style={[styles.heroTile, { backgroundColor: s.solid }]}>
                    <LevelBars level={live ? b.level : undefined} color={s.pinFg} scale={1.9} />
                  </View>
                  <View>
                    <Text style={[styles.heroKicker, { color: s.fg }]}>Right now</Text>
                    <Text style={[styles.heroLevel, { color: s.fg }]}>{s.label}</Text>
                  </View>
                </View>
                {/* Trend and comparison lines only make sense for a live reading. */}
                {live && (
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
                )}
              </View>
            );
          })()}

          {/* ===== Floors and sub-areas ===== */}
          {/* Floor and area levels only mean something while the building itself has a live reading. */}
          {b.status === 'live' && b.floors && b.floors.length > 0 && (
            <ZoneList title="By floor" zones={b.floors} muted={stale} />
          )}
          {b.status === 'live' && b.areas && b.areas.length > 0 && (
            <ZoneList title={b.areasHeading ?? 'Areas'} zones={b.areas} muted={stale} />
          )}

          {/* ===== Typical-day chart =====
              Only shown when there's a full 17-hour curve (7 AM → 11 PM). The API sends it once
              it has history; buildings with no history yet don't get a chart. */}
          {b.typicalDay?.length === DAY_HOURS && (
            <View style={styles.section}>
              <View style={styles.chartHead}>
                {/* The mock is one shared curve, so say "day" rather than a weekday. */}
                <SectionTitle>Typical day</SectionTitle>
                <Text style={[styles.chartNow, { color: t.text2 }]}>Now · {formatHourLong(hour)}</Text>
              </View>
              <TypicalDayChart values={b.typicalDay} currentHour={hour} currentLabel={display(b).label} />
            </View>
          )}

          {/* Footnote explaining that levels are relative, not headcounts. */}
          {b.status === 'live' && (
            <Text style={[styles.foot, { color: t.text2 }]}>
              “{display(b).label}” is relative to this building’s normal range, not a headcount.
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --- Styles ----------------------------------------------------------------------------------
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
  // 44 px tall = Apple's minimum comfortable tap target.
  back: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 6, paddingRight: 12 },
  backText: { fontFamily: font.semibold, fontSize: 16 },
  star: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontFamily: font.medium, fontSize: 16 },
  scroll: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  titleBlock: { gap: 4 },
  title: { fontFamily: font.extrabold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  updated: { fontFamily: font.medium, fontSize: 13 },
  // "hero" = the big "Right now" card
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
