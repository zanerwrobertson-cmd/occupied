/**
 * BUILDING CARD — one row in the home-screen list.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ D.B. Weldon Library               ● Busy     │
 *   │ ↗ Getting busier                             │
 *   └──────────────────────────────────────────────┘
 *
 * Name and trend on the left, level badge on the right. Tapping it opens the detail screen.
 * Favourite cards get a light purple background.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Building } from '@/data/types';
import { TREND_TEXT } from '@/lib/levels';
import { font, useTheme } from '@/theme/theme';

import { LevelBadge, TrendLabel } from './Level';

export function BuildingCard({
  building,
  favorite,
  muted,
  onPress,
}: {
  building: Building;
  /** Show it with the favourite styling */
  favorite?: boolean;
  /** Grey out the level when the data is stale */
  muted?: boolean;
  onPress: () => void;
}) {
  const { t, display } = useTheme();
  // Only a live reading has a trend; Closed / No data / Low activity don't.
  const live = building.status === 'live';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // What a screen reader says, e.g. "D.B. Weldon Library, Busy, getting busier".
      accessibilityLabel={
        `${building.name}, ${display(building).label}` +
        (live ? `, ${TREND_TEXT[building.trend].toLowerCase()}` : '')
      }
      // Pressable can take a function: `pressed` is true while a finger is on it (dims the card).
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: favorite ? t.favSurface : t.surface,
          borderColor: favorite ? t.favBorder : t.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {/* Left: name + trend */}
      <View style={styles.text}>
        <Text style={[styles.name, { color: t.text }]}>{building.name}</Text>
        {live && <TrendLabel trend={building.trend} color={t.text2} />}
      </View>
      {/* Right: "● Busy" / "● Closed" … */}
      <LevelBadge rated={building} muted={muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 68,
    flexDirection: 'row', // text and badge side by side
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  // flex: 1 lets the text take the remaining width; minWidth: 0 lets long names wrap.
  text: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: font.bold, fontSize: 16, lineHeight: 20 },
});
