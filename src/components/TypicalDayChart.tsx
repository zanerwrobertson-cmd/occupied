import { StyleSheet, Text, View } from 'react-native';

import { DAY_START_HOUR, formatHourLong, formatHourShort, hourIndex } from '@/lib/levels';
import { font, useTheme } from '@/theme/theme';

const CHART_H = 130;

export function TypicalDayChart({
  values,
  currentHour,
  currentLabel,
}: {
  values: number[];
  currentHour: number;
  /** Text for the live state, e.g. "Busy" or "Closed" */
  currentLabel: string;
}) {
  const { t } = useTheme();
  const nowI = hourIndex(currentHour);
  const peak = values.indexOf(Math.max(...values));
  const summary =
    `Typical busyness by hour from 7 AM to 11 PM. Usually busiest around ${formatHourLong(DAY_START_HOUR + peak)}.` +
    (nowI >= 0 ? ` Right now: ${currentLabel}.` : '');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.bars}>
        {values.map((v, i) => {
          const isNow = i === nowI;
          return (
            <View key={i} style={styles.col}>
              <Text style={[styles.now, { color: t.text }]}>{isNow ? 'Now' : ''}</Text>
              <View
                style={{
                  width: '100%',
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
  bars: { height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, height: CHART_H, justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  now: { fontFamily: font.extrabold, fontSize: 10 },
  ticks: { flexDirection: 'row', gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: 1 },
  tick: { flex: 1, fontFamily: font.semibold, fontSize: 10, textAlign: 'center', overflow: 'visible' },
});
