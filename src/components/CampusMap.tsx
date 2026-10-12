import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import type { Building, Level } from '@/data/types';
import { font, useTheme } from '@/theme/theme';

import { ChevronRightIcon } from './Icons';
import { LevelBadge, LevelBars, TrendLabel } from './Level';

/** Pins are authored in a 390-wide design space and scaled to the screen. */
const DESIGN_W = 390;

/**
 * Schematic campus map — NOT geographically accurate.
 * TODO: swap for real coordinates (react-native-maps or a custom illustrated campus map).
 */
export function CampusMap({
  buildings,
  onOpen,
}: {
  buildings: Building[];
  onOpen: (id: string) => void;
}) {
  const { t, level, scheme } = useTheme();
  const [width, setWidth] = useState(DESIGN_W);
  const [selected, setSelected] = useState('weldon');
  const k = width / DESIGN_W;
  const sel = buildings.find((b) => b.id === selected) ?? buildings[0];

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={[styles.root, { backgroundColor: t.mapLand, borderTopColor: t.border }]}>
      <Svg width={width} height={700 * k} viewBox="0 0 390 700" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Ellipse cx={150} cy={300} rx={80} ry={46} fill={t.mapGreen} />
        <Ellipse cx={300} cy={120} rx={60} ry={30} fill={t.mapGreen} />
        <Ellipse cx={70} cy={520} rx={70} ry={40} fill={t.mapGreen} />
        <Path d="M0 610 C 90 560, 170 640, 260 600 S 360 560, 390 575 L390 700 L0 700 Z" fill={t.mapRiver} />
        <Path d="M18 62 H372 V548 H18 Z" fill="none" stroke={t.mapRoad} strokeWidth={10} strokeLinejoin="round" />
        <Path d="M18 200 C 120 210, 260 190, 372 200" fill="none" stroke={t.mapRoad} strokeWidth={6} />
        <Path d="M200 62 C 210 200, 190 380, 210 548" fill="none" stroke={t.mapRoad} strokeWidth={6} />
        <Path d="M18 390 C 140 380, 260 400, 372 395" fill="none" stroke={t.mapRoad} strokeWidth={6} />
      </Svg>

      <View style={styles.legend}>
        {([0, 1, 2, 3] as Level[]).map((l) => {
          const s = level(l);
          return (
            <View key={l} style={[styles.legendChip, { backgroundColor: t.surface }]}>
              <View style={[styles.legendDot, { backgroundColor: s.solid }]}>
                <LevelBars level={l} color={s.pinFg} scale={0.6} />
              </View>
              <Text style={[styles.legendText, { color: t.text }]}>{s.label}</Text>
            </View>
          );
        })}
      </View>

      {buildings.map((b) => {
        const s = level(b.level);
        const on = b.id === selected;
        return (
          <Pressable
            key={b.id}
            onPress={() => setSelected(b.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${b.name}, ${s.label}`}
            hitSlop={4}
            style={[styles.pin, { left: b.map.x * k - 26, top: b.map.y * k - 15 }]}
          >
            <View
              style={[
                styles.pinDot,
                {
                  backgroundColor: s.solid,
                  borderColor: on ? t.accent : t.surface,
                  borderWidth: on ? 3 : 2,
                },
              ]}
            >
              <LevelBars level={b.level} color={s.pinFg} scale={0.9} />
            </View>
            <Text
              style={[
                styles.pinLabel,
                { backgroundColor: on ? t.accent : t.chipBg, color: on ? t.onAccent : t.chipFg },
              ]}
            >
              {b.short}
            </Text>
          </Pressable>
        );
      })}

      {sel && (
        <View
          style={[
            styles.sheet,
            { backgroundColor: t.surface, shadowOpacity: scheme === 'dark' ? 0.5 : 0.18 },
          ]}
        >
          <View style={styles.sheetRow}>
            <View style={styles.sheetText}>
              <Text style={[styles.sheetName, { color: t.text }]}>{sel.name}</Text>
              <TrendLabel trend={sel.trend} color={t.text2} />
            </View>
            <LevelBadge level={sel.level} />
          </View>
          <Pressable
            onPress={() => onOpen(sel.id)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sheetBtn, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.sheetBtnText, { color: t.onAccent }]}>View details</Text>
            <ChevronRightIcon color={t.onAccent} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', borderTopWidth: 1 },
  legend: { position: 'absolute', left: 12, right: 12, top: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 9,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  legendDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 5 },
  legendText: { fontFamily: font.bold, fontSize: 12 },
  pin: { position: 'absolute', width: 52, minHeight: 44, alignItems: 'center', gap: 2 },
  pinDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 7,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinLabel: {
    fontFamily: font.extrabold,
    fontSize: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    padding: 16,
    borderRadius: 20,
    gap: 12,
    shadowColor: '#000',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sheetText: { flex: 1, minWidth: 0, gap: 4 },
  sheetName: { fontFamily: font.extrabold, fontSize: 17, lineHeight: 21 },
  sheetBtn: { height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sheetBtnText: { fontFamily: font.bold, fontSize: 16 },
});
