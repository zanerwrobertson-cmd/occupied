/**
 * TYPICAL-DAY CHART — a bar chart of how busy a building usually is each hour, 7 AM → 11 PM.
 *
 * Shown on the building detail screen. Each of the 17 bars is one hour; its height is the
 * typical busyness (0–100). The bar for the current hour is highlighted and labelled "Now".
 * Built from plain Views (no chart library): each bar is a View whose height is the value.
 */
import { StyleSheet, Text, View } from 'react-native';

import { DAY_START_HOUR, formatHourLong, formatHourShort, hourIndex } from '@/lib/levels';
import { font, useTheme } from '@/theme/theme';

/** Height of the bar area in pixels. Values go up to 100, so the tallest bar is 104 px. */
const CHART_H = 130;

export function TypicalDayChart({
  values,
  currentHour,
  currentLabel,
}: {
  /** 17 numbers, 0–100: index 0 = 7 AM, index 16 = 11 PM */
  values: number[];
  /** Current hour, 0–23 */
  currentHour: number;
  /** Text for the live state, e.g. "Busy" or "Closed" */
  currentLabel: string;
}) {
  const { t } = useTheme();
  // Which bar is "now" (-1 if the current hour is outside 7 AM–11 PM).
  const nowI = hourIndex(currentHour);
  // Which hour is usually busiest — for the screen-reader summary.
  const peak = values.indexOf(Math.max(...values));
  // A chart can't be "seen" by screen readers, so describe it in one sentence instead.
  const summary =
    `Typical busyness by hour from 7 AM to 11 PM. Usually busiest around ${formatHourLong(DAY_START_HOUR + peak)}.` +
    (nowI >= 0 ? ` Right now: ${currentLabel}.` : '');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      {/* ===== The bars ===== */}
      <View style={styles.bars}>
        {values.map((v, i) => {
          const isNow = i === nowI;
          return (
            // One column per hour: the "Now" label (or empty) above the bar.
            <View key={i} style={styles.col}>
              <Text style={[styles.now, { color: t.text }]}>{isNow ? 'Now' : ''}</Text>
              <View
                style={{
                  width: '100%',
                  // 1 px per point, plus 4 so even a 0 bar is visible as a stub.
                  height: Math.round(v * 1.0) + 4,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                  // Highlight = "this hour" (accent), not the live level — the bar height is the typical value.
                  backgroundColor: isNow ? t.accent : t.chartMuted,
                }}
              />
            </View>
          );
        })}
      </View>
      {/* ===== Hour labels under the bars: every 3rd hour (7a, 10a, 1p, 4p, 7p, 10p) ===== */}
      <View style={[styles.ticks, { borderTopColor: t.border }]}>
        {values.map((_, i) => (
          <Text key={i} numberOfLines={1} style={[styles.tick, { color: t.text2 }]}>
            {i % 3 === 0 ? formatHourShort(DAY_START_HOUR + i) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 16, paddingHorizontal: 14, paddingBottom: 12, borderRadius: 16, borderWidth: 1 },
  // alignItems: 'flex-end' makes the bars grow upward from a shared baseline.
  bars: { height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, height: CHART_H, justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  now: { fontFamily: font.extrabold, fontSize: 10 },
  ticks: { flexDirection: 'row', gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: 1 },
  // overflow: 'visible' lets labels like "10a" spill wider than their narrow column.
  tick: { flex: 1, fontFamily: font.semibold, fontSize: 10, textAlign: 'center', overflow: 'visible' },
});
