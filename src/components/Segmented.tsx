/**
 * SEGMENTED CONTROL — a row of buttons where exactly one is selected, like iOS's switch.
 * Used for "List | Map" and "A–Z | Quietest first" on the home screen.
 *
 * It's "generic" (<T extends string>): T is the set of allowed values, e.g. 'list' | 'map', so
 * TypeScript checks that onChange only ever receives one of those.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { font, useTheme } from '@/theme/theme';

/** One button in the control. */
export type SegmentOption<T extends string> = {
  value: T; // what onChange receives when this button is tapped
  label: string; // text shown on the button
  /** Optional icon, drawn in the button's current text colour. */
  icon?: (color: string) => ReactNode;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
  label,
}: {
  options: SegmentOption<T>[];
  /** The currently selected value */
  value: T;
  onChange: (v: T) => void;
  /** Smaller version that sizes to its content (used for the sort switch) */
  compact?: boolean;
  /** What screen readers call the whole control, e.g. "View" */
  label: string;
}) {
  const { t, scheme } = useTheme();
  return (
    // The "track" is the grey rounded background behind the buttons.
    <View accessibilityLabel={label} style={[styles.track, compact && styles.trackCompact, { backgroundColor: t.track }]}>
      {options.map((o) => {
        const on = o.value === value; // is this the selected button?
        const color = on ? t.text : t.text2;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[
              styles.seg,
              compact ? styles.segCompact : styles.segFull,
              // The selected button gets a white "pill" with a soft shadow.
              on && {
                backgroundColor: t.surface,
                shadowColor: '#000',
                shadowOpacity: scheme === 'dark' ? 0.5 : 0.12,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
                elevation: 2, // Android's version of a shadow
              },
            ]}
          >
            {/* `?.` = only call icon if it was provided */}
            {o.icon?.(color)}
            <Text style={[compact ? styles.labelCompact : styles.label, { color }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14 },
  trackCompact: { padding: 3, borderRadius: 12 },
  seg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  segFull: { flex: 1, height: 40, borderRadius: 10 }, // full width: buttons share the space equally
  segCompact: { height: 34, paddingHorizontal: 12, borderRadius: 9 },
  label: { fontFamily: font.bold, fontSize: 15 },
  labelCompact: { fontFamily: font.bold, fontSize: 13 },
});
