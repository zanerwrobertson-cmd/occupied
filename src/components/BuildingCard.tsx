import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Building } from '@/data/types';
import { TREND_TEXT } from '@/lib/levels';
import { font, useTheme } from '@/theme/theme';

import { LevelBadge, TrendLabel } from './Level';

export function BuildingCard({
  building,
  favorite,
  onPress,
}: {
  building: Building;
  favorite?: boolean;
  onPress: () => void;
}) {
  const { t, level } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${building.name}, ${level(building.level).label}, ${TREND_TEXT[building.trend].toLowerCase()}`}
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
        <TrendLabel trend={building.trend} color={t.text2} />
      </View>
      <LevelBadge level={building.level} />
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
