import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { font, useTheme } from '@/theme/theme';

export function SectionTitle({ children }: { children: ReactNode }) {
  const { t } = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: t.text2 }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.bold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
});
