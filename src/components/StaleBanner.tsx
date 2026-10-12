import { StyleSheet, Text, View } from 'react-native';

import { font, useTheme } from '@/theme/theme';

import { ClockIcon } from './Icons';

/** Shown when the snapshot is old or the last refresh failed. */
export function StaleBanner() {
  const { t } = useTheme();
  return (
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
