import type { Building, WeeklyHours } from '@/data/types';

import { formatHourLong } from './levels';

export function isOpen(hours: WeeklyHours, at: Date): boolean {
  const today = hours[at.getDay()];
  if (!today) return false;
  const h = at.getHours();
  return h >= today[0] && h < today[1];
}

/** "8 AM – 11 PM" or "Closed today". */
export function todaysHours(hours: WeeklyHours, at: Date): string {
  const today = hours[at.getDay()];
  if (!today) return 'Closed today';
  return `${formatHourLong(today[0])} – ${formatHourLong(today[1])}`;
}

/** Outside opening hours a building is "closed", whatever the feed said — never "Quiet". */
export function withOpeningHours(b: Building, at: Date): Building {
  if (isOpen(b.hours, at)) return b;
  return { ...b, status: 'closed', level: undefined, trend: undefined };
}
