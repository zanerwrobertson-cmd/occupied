/**
 * THEME — every colour and font in the app, for both light and dark mode.
 *
 * Components never hard-code colours. They call useTheme() and get:
 *   t        general colours (backgrounds, text, borders, map) for the current mode
 *   level(l) the colours + label for a busyness level (Quiet / Moderate / Busy / Very Busy)
 *   display  the colours + label for any building or zone — a level, or grey for
 *            "No data yet" / "Closed" / "Low activity"
 *
 * The phone's system setting picks light or dark (app.json has "userInterfaceStyle": "automatic").
 */
import { useColorScheme } from 'react-native';

import type { Level, Rated } from '@/data/types';
import { STATUS_TEXT } from '@/lib/levels';

/** General colour "tokens". Each has a light and a dark value below. */
export type Theme = {
  bg: string; // screen background
  surface: string; // cards and panels
  favSurface: string; // favourite cards (slightly purple)
  favBorder: string;
  text: string; // main text
  text2: string; // secondary/grey text
  border: string;
  track: string; // background of segmented controls and the stale banner
  accent: string; // Western-ish purple for buttons and highlights
  onAccent: string; // text on top of `accent`
  chartMuted: string; // non-highlighted chart bars
  mapLand: string; // map colours ↓
  mapGreen: string;
  mapRiver: string;
  mapRoad: string;
  mapBuilding: string; // buildings that aren't in the app
  chipBg: string; // map pin labels
  chipFg: string;
};

/** Colours for one busyness level (or a grey status). */
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

// --- General colours -------------------------------------------------------------------------
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
  mapBuilding: '#DDD7CC',
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
  mapBuilding: '#2C2935',
  chipBg: 'rgba(29,26,36,0.92)',
  chipFg: '#F3F0F8',
};

// --- Level colours ---------------------------------------------------------------------------
// Index = Level: 0 Quiet (green), 1 Moderate (yellow), 2 Busy (orange), 3 Very Busy (red).
// Text colours were picked to be readable (4.5:1 contrast) on their backgrounds.
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

/** Grey for No data / Closed / Low activity, and for muting levels when data is stale. */
const lightNeutral: Omit<LevelStyle, 'label'> = { bg: '#ECEAF0', fg: '#4A4458', dot: '#8C8699', solid: '#8C8699', pinFg: '#FFFFFF' };
const darkNeutral: Omit<LevelStyle, 'label'> = { bg: '#2A2633', fg: '#C9C2D6', dot: '#7D768A', solid: '#5E5870', pinFg: '#F3F0F8' };

/**
 * The hook every component uses for colours. ("Hooks" are functions starting with `use` that
 * React re-runs on every render — so when the phone switches to dark mode, colours update.)
 */
export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const t = scheme === 'dark' ? dark : light;
  const levels = scheme === 'dark' ? darkLevels : lightLevels;
  const neutral = scheme === 'dark' ? darkNeutral : lightNeutral;
  return {
    scheme,
    t,
    levels,
    neutral,
    /** Colours for a level number, e.g. level(2) → Busy's orange. */
    level: (l: Level) => levels[l],
    /**
     * Style for a building or zone: its level colours when live, otherwise neutral grey
     * with the status text. `muted` keeps the level's label and dot but greys the rest.
     */
    display: (r: Rated, muted = false): LevelStyle => {
      // Zones from the mock don't set status; no status means live.
      const status = r.status ?? 'live';
      if (status === 'live' && r.level !== undefined) {
        const s = levels[r.level];
        // Stale data: grey card, but keep the level's name and coloured dot.
        return muted ? { ...neutral, label: s.label, dot: s.dot } : s;
      }
      // Not live → grey with "Closed" / "No data yet" / "Low activity".
      return { ...neutral, label: STATUS_TEXT[status === 'live' ? 'nodata' : status] };
    },
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
