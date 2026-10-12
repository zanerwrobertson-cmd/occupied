import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { font, useTheme } from '@/theme/theme';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
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
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
  label: string;
}) {
  const { t, scheme } = useTheme();
  return (
    <View accessibilityLabel={label} style={[styles.track, compact && styles.trackCompact, { backgroundColor: t.track }]}>
      {options.map((o) => {
        const on = o.value === value;
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
              on && {
                backgroundColor: t.surface,
                shadowColor: '#000',
                shadowOpacity: scheme === 'dark' ? 0.5 : 0.12,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
                elevation: 2,
              },
            ]}
          >
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
  segFull: { flex: 1, height: 40, borderRadius: 10 },
  segCompact: { height: 34, paddingHorizontal: 12, borderRadius: 9 },
  label: { fontFamily: font.bold, fontSize: 15 },
  labelCompact: { fontFamily: font.bold, fontSize: 13 },
});
