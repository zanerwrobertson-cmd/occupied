/**
 * ZONE LIST — the "BY FLOOR" or "INSIDE THE UCC" box on the detail screen.
 *
 *   BY FLOOR
 *   ┌──────────────────────────────┐
 *   │ Floor 1          ● Very Busy │
 *   │ Floor 2          ● Busy      │
 *   │ Floor 4          ● Low activity │
 *   └──────────────────────────────┘
 *
 * Each row is one zone (a floor or a sub-area) with its own level or grey status.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { Zone } from '@/data/types';
import { font, useTheme } from '@/theme/theme';

import { LevelBadge } from './Level';
import { SectionTitle } from './SectionTitle';

/** Floors or sub-areas inside a building, each with its own level or "Low activity". */
export function ZoneList({ title, zones, muted }: { title: string; zones: Zone[]; muted?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      <View style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
        {zones.map((z, i) => (
          // A divider line above every row except the first.
          <View key={z.name} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.border }]}>
            <Text style={[styles.name, { color: t.text }]}>{z.name}</Text>
            <LevelBadge rated={z} small muted={muted} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  // overflow: 'hidden' clips the rows to the box's rounded corners.
  box: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // name on the left, badge on the right
    gap: 12,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 14,
  },
  name: { flex: 1, fontFamily: font.semibold, fontSize: 16 },
});
