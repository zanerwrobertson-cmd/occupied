/**
 * STALE BANNER — "🕓 Data may be out of date".
 *
 * Shown on the home and detail screens when the latest data is more than 30 minutes old
 * (STALE_MS in src/data/source.ts), or when the last refresh failed and we're still showing
 * older data. `stale` is worked out in src/state/occupancy.tsx.
 */
import { StyleSheet, Text, View } from 'react-native';

import { font, useTheme } from '@/theme/theme';

import { ClockIcon } from './Icons';

/** Shown when the snapshot is old or the last refresh failed. */
export function StaleBanner() {
  const { t } = useTheme();
  return (
    // accessibilityRole="alert" makes screen readers announce it when it appears.
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: t.track, borderColor: t.border }]}>
      <ClockIcon color={t.text} />
      <Text style={[styles.text, { color: t.text }]}>Data may be out of date</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: { fontFamily: font.semibold, fontSize: 13 },
});
