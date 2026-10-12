import { StyleSheet, Text, View } from 'react-native';

import type { Level, Rated, Trend } from '@/data/types';
import { TREND_TEXT } from '@/lib/levels';
import { font, useTheme } from '@/theme/theme';

import { TrendIcon } from './Icons';

/**
 * Coloured pill with a dot and a text label — never colour alone.
 * Neutral grey for No data / Closed / Low activity; `muted` greys a level when data is stale.
 */
export function LevelBadge({ rated, small, muted }: { rated: Rated; small?: boolean; muted?: boolean }) {
  const { display } = useTheme();
  const s = display(rated, muted);
  return (
    <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: s.bg }]}>
      <View style={[styles.dot, { backgroundColor: s.dot }]} />
      <Text style={[styles.badgeText, small && styles.badgeTextSmall, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

/** 1–4 ascending bars — a second, shape-based cue for the level. No level → all bars faint. */
export function LevelBars({ level, color, scale = 1 }: { level?: Level; color: string; scale?: number }) {
  const heights = [6, 9, 12, 15];
  return (
    <View style={[styles.bars, { gap: 2 * scale }]}>
      {heights.map((h, i) => (
        <View
          key={h}
          style={{
            width: 3 * scale,
            height: h * scale,
            borderRadius: 1.5 * scale,
            backgroundColor: color,
            opacity: level !== undefined && i <= level ? 1 : 0.3,
          }}
        />
      ))}
    </View>
  );
}

export function TrendLabel({ trend, color, size = 13 }: { trend: Trend; color: string; size?: number }) {
  return (
    <View style={styles.trend}>
      <TrendIcon trend={trend} color={color} size={size + 1} />
      <Text style={{ fontFamily: font.medium, fontSize: size, color }}>{TREND_TEXT[trend]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    flexShrink: 0,
  },
  badgeSmall: { paddingVertical: 5, paddingHorizontal: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontFamily: font.bold, fontSize: 14 },
  badgeTextSmall: { fontSize: 13 },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
