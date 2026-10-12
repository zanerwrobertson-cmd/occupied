import { StyleSheet, Text, View } from 'react-native';

import type { Zone } from '@/data/types';
import { font, useTheme } from '@/theme/theme';

import { LevelBadge } from './Level';
import { SectionTitle } from './SectionTitle';

/** Floors or sub-areas inside a building, each with its own level. */
export function ZoneList({ title, zones }: { title: string; zones: Zone[] }) {
  const { t } = useTheme();
  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
        {zones.map((z, i) => (
          <View key={z.name} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.border }]}>
            <Text style={[styles.name, { color: t.text }]}>{z.name}</Text>
            <LevelBadge level={z.level} small />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  box: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 14,
  },
  name: { flex: 1, fontFamily: font.semibold, fontSize: 16 },
});
