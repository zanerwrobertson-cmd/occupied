import { useColorScheme } from 'react-native';

import type { Level } from '@/data/types';

export type Theme = {
  bg: string;
  surface: string;
  favSurface: string;
  favBorder: string;
  text: string;
  text2: string;
  border: string;
  track: string;
  accent: string;
  onAccent: string;
  chartMuted: string;
  mapLand: string;
  mapGreen: string;
  mapRiver: string;
  mapRoad: string;
  chipBg: string;
  chipFg: string;
};

export type LevelStyle = {
  label: string;
  /** Badge background */
  bg: string;
  /** Badge text — passes 4.5:1 on bg */
  fg: string;
  /** Small dot inside badges */
  dot: string;
  /** Solid fill for pins, chart highlight, big level tile */
  solid: string;
  /** Glyph colour drawn on top of `solid` */
  pinFg: string;
};

const light: Theme = {
  bg: '#F6F4FA',
  surface: '#FFFFFF',
  favSurface: '#FBF8FF',
  favBorder: '#DCCDF3',
  text: '#1A1523',
  text2: '#5E5670',
  border: '#E6E1EF',
  track: '#ECE8F3',
  accent: '#5B2A9E',
  onAccent: '#FFFFFF',
  chartMuted: '#D9D3E4',
  mapLand: '#EFECE4',
  mapGreen: '#D7E8CF',
  mapRiver: '#BFD9EE',
  mapRoad: '#FFFFFF',
  chipBg: 'rgba(255,255,255,0.92)',
  chipFg: '#1A1523',
};

const dark: Theme = {
  bg: '#121016',
  surface: '#1D1A24',
  favSurface: '#211B2C',
  favBorder: '#3B2F52',
  text: '#F3F0F8',
  text2: '#A9A1B8',
  border: '#2F2A3A',
  track: '#24202D',
  accent: '#B794F4',
  onAccent: '#1A1030',
  chartMuted: '#3A3446',
  mapLand: '#1A1820',
  mapGreen: '#1E2A1E',
  mapRiver: '#1B2A3A',
  mapRoad: '#2A2633',
  chipBg: 'rgba(29,26,36,0.92)',
  chipFg: '#F3F0F8',
};

const lightLevels: LevelStyle[] = [
  { label: 'Quiet', bg: '#DCF5E3', fg: '#14632F', dot: '#2FA35A', solid: '#2FA35A', pinFg: '#0B2913' },
  { label: 'Moderate', bg: '#FBF0C4', fg: '#6B5300', dot: '#D9A915', solid: '#E8B923', pinFg: '#3A2A00' },
  { label: 'Busy', bg: '#FFE3CC', fg: '#8A3B00', dot: '#EF7D22', solid: '#EF7D22', pinFg: '#3A1A00' },
  { label: 'Very Busy', bg: '#FCDADA', fg: '#9B1C1C', dot: '#D93636', solid: '#D93636', pinFg: '#FFFFFF' },
];

const darkLevels: LevelStyle[] = [
  { label: 'Quiet', bg: '#143A22', fg: '#86E3A7', dot: '#3FBF6C', solid: '#3FBF6C', pinFg: '#0B2913' },
  { label: 'Moderate', bg: '#3A3112', fg: '#F2D266', dot: '#E8B923', solid: '#E8B923', pinFg: '#3A2A00' },
  { label: 'Busy', bg: '#43260F', fg: '#FFB070', dot: '#F28A35', solid: '#F28A35', pinFg: '#3A1A00' },
  { label: 'Very Busy', bg: '#481818', fg: '#FF9E9E', dot: '#E5484D', solid: '#E5484D', pinFg: '#FFFFFF' },
];

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const t = scheme === 'dark' ? dark : light;
  const levels = scheme === 'dark' ? darkLevels : lightLevels;
  return {
    scheme,
    t,
    levels,
    level: (l: Level) => levels[l],
  } as const;
}

/** Custom fonts on Android ignore fontWeight, so each weight is its own family. */
export const font = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
} as const;
