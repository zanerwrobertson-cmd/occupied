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
  favorite?: boolean;
  /** Grey out the level when the data is stale */
  muted?: boolean;
  onPress: () => void;
}) {
  const { t, display } = useTheme();
  const live = building.status === 'live';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${building.name}, ${display(building).label}` +
        (live ? `, ${TREND_TEXT[building.trend].toLowerCase()}` : '')
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: favorite ? t.favSurface : t.surface,
          borderColor: favorite ? t.favBorder : t.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.text}>
        <Text style={[styles.name, { color: t.text }]}>{building.name}</Text>
        {live && <TrendLabel trend={building.trend} color={t.text2} />}
      </View>
      <LevelBadge rated={building} muted={muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  text: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: font.bold, fontSize: 16, lineHeight: 20 },
});
