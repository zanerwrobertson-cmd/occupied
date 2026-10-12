import type { BuildingInfo, BuildingReading, DayHours, WeeklyHours } from './types';

// Typical-day curves, 7 AM → 11 PM. Placeholder shapes until real history exists.
const LIBRARY = [8, 15, 28, 42, 55, 62, 68, 74, 78, 80, 76, 70, 66, 60, 50, 36, 20];
const ACADEMIC = [10, 30, 62, 80, 85, 78, 82, 70, 58, 38, 22, 15, 10, 6, 4, 3, 2];
const GYM = [20, 28, 24, 20, 22, 30, 32, 36, 44, 62, 80, 85, 74, 58, 40, 24, 10];
const UCC = [12, 22, 35, 52, 72, 92, 95, 74, 58, 48, 40, 34, 28, 20, 12, 8, 4];

/** Mon–Fri, Saturday, Sunday → a Sunday-first week. */
const weekly = (weekday: DayHours, sat: DayHours, sun: DayHours): WeeklyHours =>
  [sun, weekday, weekday, weekday, weekday, weekday, sat];

// TODO-verify: placeholder opening hours. Replace with each building's published hours.
const LIBRARY_HOURS = weekly([8, 23], [10, 22], [10, 22]);
const ACADEMIC_HOURS = weekly([7, 22], [9, 18], [9, 18]);
const GYM_HOURS = weekly([6, 23], [8, 22], [8, 22]);
const UCC_HOURS = weekly([7, 23], [9, 23], [9, 23]);

export const BUILDINGS: BuildingInfo[] = [
  { id: 'weldon', name: 'D.B. Weldon Library', short: 'WEL', aliases: ['library', 'weldon'], hours: LIBRARY_HOURS, typicalDay: LIBRARY },
  { id: 'taylor', name: 'Allyn & Betty Taylor Library', short: 'TAY', aliases: ['library', 'science library'], hours: LIBRARY_HOURS, typicalDay: LIBRARY },
  { id: 'rec', name: 'Western Student Recreation Centre', short: 'REC', aliases: ['rec centre', 'rec center', 'gym', 'src'], hours: GYM_HOURS, typicalDay: GYM, areasHeading: 'Areas' },
  { id: 'ucc', name: 'University Community Centre (UCC)', short: 'UCC', aliases: ['spoke', 'food court'], hours: UCC_HOURS, typicalDay: UCC, areasHeading: 'Inside the UCC' },
  { id: 'ssc', name: 'Social Science Centre', short: 'SSC', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'nsc', name: 'Natural Sciences Centre', short: 'NSC', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'pab', name: 'Physics & Astronomy Building', short: 'PAB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'mc', name: 'Middlesex College', short: 'MC', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'uc', name: 'University College', short: 'UC', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'tc', name: 'Talbot College', short: 'TC', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'th', name: 'Thames Hall', short: 'TH', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'ivey', name: 'Ivey Business School', short: 'IVEY', aliases: ['business'], hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'ahb', name: 'Arts & Humanities Building', short: 'AHB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'fims', name: 'FIMS & Nursing Building', short: 'FNB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'hsb', name: 'Health Sciences Building', short: 'HSB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'msb', name: 'Medical Sciences Building', short: 'MSB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'bgs', name: 'Biological & Geological Sciences Building', short: 'BGS', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'chem', name: 'Chemistry Building', short: 'CHB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'seb', name: 'Spencer Engineering Building', short: 'SEB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'teb', name: 'Thompson Engineering Building', short: 'TEB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'aceb', name: 'Amit Chakma Engineering Building', short: 'ACEB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'stevenson', name: 'Stevenson Hall', short: 'STV', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
  { id: 'ncb', name: 'North Campus Building', short: 'NCB', hours: ACADEMIC_HOURS, typicalDay: ACADEMIC },
];

/**
 * Mock readings — replace with the real feed in source.ts.
 * Talbot College, Stevenson Hall and North Campus Building are left out on purpose to show "No data yet".
 */
export const MOCK_READINGS: BuildingReading[] = [
  {
    id: 'weldon', level: 2, trend: 'up',
    floors: [
      { name: 'Floor 1', level: 3 },
      { name: 'Floor 2', level: 2 },
      { name: 'Floor 3', level: 2 },
      { name: 'Floor 4', level: 1 },
      { name: 'Floor 5', level: 1 },
    ],
  },
  {
    id: 'taylor', level: 1, trend: 'down',
    floors: [
      { name: 'Floor 1', level: 2 },
      { name: 'Floor 2', level: 1 },
      { name: 'Floor 3', level: 1 },
      { name: 'Floor 4', status: 'low' },
    ],
  },
  {
    id: 'rec', level: 0, trend: 'up',
    areas: [
      { name: 'Weight room', level: 1 },
      { name: 'Cardio area', level: 0 },
      { name: 'Gym courts', level: 0 },
      { name: 'Pool', level: 0 },
    ],
  },
  {
    id: 'ucc', level: 3, trend: 'down',
    areas: [
      { name: 'The Spoke', level: 3 },
      { name: 'Food court', level: 3 },
      { name: 'Lounges & study space', level: 2 },
    ],
  },
  { id: 'ssc', level: 2, trend: 'steady' },
  { id: 'nsc', level: 1, trend: 'up' },
  { id: 'pab', level: 0, trend: 'steady' },
  { id: 'mc', level: 1, trend: 'steady' },
  { id: 'uc', level: 2, trend: 'up' },
  { id: 'th', level: 0, trend: 'down' },
  { id: 'ivey', level: 2, trend: 'steady' },
  { id: 'ahb', level: 1, trend: 'up' },
  { id: 'fims', level: 2, trend: 'up' },
  { id: 'hsb', level: 1, trend: 'steady' },
  { id: 'msb', level: 2, trend: 'down' },
  { id: 'bgs', level: 1, trend: 'steady' },
  { id: 'chem', level: 3, trend: 'up' },
  { id: 'seb', level: 2, trend: 'steady' },
  { id: 'teb', level: 1, trend: 'down' },
  { id: 'aceb', level: 2, trend: 'up' },
];
