/**
 * ICONS — small line drawings used around the app, drawn as SVG.
 *
 * Every icon is drawn on a 24 × 24 grid (the `viewBox`) and then scaled to `size` pixels, so the
 * coordinates below are positions on that 24 × 24 grid. Using our own SVGs (instead of an icon
 * font or library) keeps the app small and lets every icon take any colour, which matters for
 * light/dark mode.
 *
 * SVG shapes used:  Circle (cx, cy = centre, r = radius) · Line (x1,y1 → x2,y2)
 *                   Polyline (connected points, open) · Polygon (connected points, closed)
 *                   Rect (x, y, width, height, rx = corner radius)
 */
import Svg, { Circle, Line, Polygon, Polyline, Rect } from 'react-native-svg';

import type { Trend } from '@/data/types';

/** Props shared by every icon: size in pixels (each icon has its own default) and colour. */
type P = { size?: number; color: string };

/** Magnifying glass: a circle plus a short handle line. Used in the search box. */
export function SearchIcon({ size = 20, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Circle cx={11} cy={11} r={7} />
      <Line x1={20} y1={20} x2={16.2} y2={16.2} />
    </Svg>
  );
}

/** Clock face with hands at about 2 o'clock. Used for "Updated X min ago" and the stale banner. */
export function ClockIcon({ size = 14, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Polyline points="12 7 12 12 15 14" />
    </Svg>
  );
}

/** Five-point star. `filled` = a favourite (solid), otherwise just the outline. */
export function StarIcon({ size = 24, color, filled }: P & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Polygon points="12 2.5 15 8.8 21.8 9.6 16.8 14.3 18.1 21.1 12 17.8 5.9 21.1 7.2 14.3 2.2 9.6 9 8.8" />
    </Svg>
  );
}

/** "<" arrow for the Back button. */
export function ChevronLeftIcon({ size = 24, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 5 8 12 15 19" />
    </Svg>
  );
}

/** ">" arrow, e.g. on the map's "View details" button. */
export function ChevronRightIcon({ size = 18, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 6 15 12 9 18" />
    </Svg>
  );
}

/** Three lines with bullet dots — the "List" side of the List | Map switch. */
export function ListIcon({ size = 18, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Line x1={8} y1={6} x2={20} y2={6} />
      <Line x1={8} y1={12} x2={20} y2={12} />
      <Line x1={8} y1={18} x2={20} y2={18} />
      <Circle cx={4} cy={6} r={1} />
      <Circle cx={4} cy={12} r={1} />
      <Circle cx={4} cy={18} r={1} />
    </Svg>
  );
}

/** Folded paper map — the "Map" side of the List | Map switch. */
export function MapIcon({ size = 18, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <Line x1={9} y1={3} x2={9} y2={18} />
      <Line x1={15} y1={6} x2={15} y2={21} />
    </Svg>
  );
}

/**
 * Points for the trend arrows: [the zig-zag line, the arrowhead].
 * up = line rising to the top-right, down = falling to the bottom-right, steady = flat line.
 */
const TREND_POINTS: Record<Trend, [string, string]> = {
  up: ['3 17 9 11 13 15 21 7', '15 7 21 7 21 13'],
  down: ['3 7 9 13 13 9 21 17', '15 17 21 17 21 11'],
  steady: ['3 12 21 12', '17 8 21 12 17 16'],
};

/** Small arrow showing whether a building is getting busier, quieter, or staying steady. */
export function TrendIcon({ size = 14, color, trend }: P & { trend: Trend }) {
  // Pick the two shapes for this trend (a = line, b = arrowhead).
  const [a, b] = TREND_POINTS[trend];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points={a} />
      <Polyline points={b} />
    </Svg>
  );
}

/** The Occupied logo: a rounded square with three rising bars (like the level bars). */
export function LogoMark({ size = 26, bg, fg }: { size?: number; bg: string; fg: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      {/* Background tile */}
      <Rect x={1} y={1} width={24} height={24} rx={8} fill={bg} />
      {/* Three bars, short → tall */}
      <Rect x={7} y={14} width={3} height={5} rx={1.5} fill={fg} />
      <Rect x={11.5} y={10.5} width={3} height={8.5} rx={1.5} fill={fg} />
      <Rect x={16} y={7} width={3} height={12} rx={1.5} fill={fg} />
    </Svg>
  );
}
