/**
 * SECTION TITLE — the small grey uppercase heading above each section ("FAVORITES", "BY FLOOR"…).
 *
 * `accessibilityRole="header"` lets screen-reader users jump between sections.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { font, useTheme } from '@/theme/theme';

// `children` is whatever is written between the tags: <SectionTitle>Favorites</SectionTitle>
export function SectionTitle({ children }: { children: ReactNode }) {
  const { t } = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: t.text2 }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Uppercase + extra letter spacing makes small headings easier to read.
  title: { fontFamily: font.bold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
});
