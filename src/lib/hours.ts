/**
 * OPENING HOURS — is a building open right now, and what are today's hours?
 *
 * Used in three places:
 *   - the app (src/state/occupancy.tsx) marks buildings "Closed" outside their hours,
 *   - the detail screen shows "Hours today: 8 AM – 11 PM",
 *   - the simulator (scripts/sim/core.ts) leaves closed buildings out of its fake readings.
 *
 * All times are the device's local time. The hours themselves are in src/data/buildings.ts.
 */
import type { Building, WeeklyHours } from '@/data/types';

import { formatHourLong } from './levels';

/** True if `at` falls inside that day's [open, close) hours. */
export function isOpen(hours: WeeklyHours, at: Date): boolean {
  const today = hours[at.getDay()]; // getDay(): 0 = Sunday … 6 = Saturday
  if (!today) return false; // null = closed all day
  const h = at.getHours();
  // Open at 8 means 8:00 is open; close at 23 means 23:00 is closed.
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
  // Copy the building but replace its status, and drop the level/trend so nothing shows them.
  return { ...b, status: 'closed', level: undefined, trend: undefined };
}
