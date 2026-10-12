import Svg, { Circle, Line, Polygon, Polyline, Rect } from 'react-native-svg';

import type { Trend } from '@/data/types';

type P = { size?: number; color: string };

export function SearchIcon({ size = 20, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Circle cx={11} cy={11} r={7} />
      <Line x1={20} y1={20} x2={16.2} y2={16.2} />
    </Svg>
  );
}

export function ClockIcon({ size = 14, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Polyline points="12 7 12 12 15 14" />
    </Svg>
  );
}

export function StarIcon({ size = 24, color, filled }: P & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Polygon points="12 2.5 15 8.8 21.8 9.6 16.8 14.3 18.1 21.1 12 17.8 5.9 21.1 7.2 14.3 2.2 9.6 9 8.8" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 24, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 5 8 12 15 19" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 18, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 6 15 12 9 18" />
    </Svg>
  );
}

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

export function MapIcon({ size = 18, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <Line x1={9} y1={3} x2={9} y2={18} />
      <Line x1={15} y1={6} x2={15} y2={21} />
    </Svg>
  );
}

const TREND_POINTS: Record<Trend, [string, string]> = {
  up: ['3 17 9 11 13 15 21 7', '15 7 21 7 21 13'],
  down: ['3 7 9 13 13 9 21 17', '15 17 21 17 21 11'],
  steady: ['3 12 21 12', '17 8 21 12 17 16'],
};

export function TrendIcon({ size = 14, color, trend }: P & { trend: Trend }) {
  const [a, b] = TREND_POINTS[trend];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points={a} />
      <Polyline points={b} />
    </Svg>
  );
}

export function LogoMark({ size = 26, bg, fg }: { size?: number; bg: string; fg: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <Rect x={1} y={1} width={24} height={24} rx={8} fill={bg} />
      <Rect x={7} y={14} width={3} height={5} rx={1.5} fill={fg} />
      <Rect x={11.5} y={10.5} width={3} height={8.5} rx={1.5} fill={fg} />
      <Rect x={16} y={7} width={3} height={12} rx={1.5} fill={fg} />
    </Svg>
  );
}
