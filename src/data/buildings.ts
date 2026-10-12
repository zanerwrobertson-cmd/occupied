/**
 * BUILDINGS — the hand-written campus data. Edit this file to add a building or fix its hours.
 *
 * Contents:
 *   1. Opening hours           (placeholders — TODO-verify against Western's published hours)
 *   2. BUILDINGS               every building the app shows: id, name, map code, search aliases, hours
 *   3. ZONES                   the sensor zones inside each building (floors / areas), shared with
 *                              the server and simulator, so ids must match what ITS reports
 *   4. Mock readings           fake levels, used only when EXPO_PUBLIC_API_URL isn't set
 *
 * To add a building: add it to BUILDINGS, give it zones in ZONES (or it gets one "-main" zone
 * automatically), add its OpenStreetMap id in scripts/build-campus-map.mjs and re-run that
 * script so it appears on the map, and give it a capacity in scripts/sim/core.ts.
 */
import type { BuildingInfo, BuildingReading, DayHours, WeeklyHours, ZoneInfo } from './types';

// --- Mock typical-day curves --------------------------------------------------------------------
// 17 values each, 7 AM → 11 PM, 0–100. Only used when there's no API (see source.ts).
const LIBRARY = [8, 15, 28, 42, 55, 62, 68, 74, 78, 80, 76, 70, 66, 60, 50, 36, 20];
const ACADEMIC = [10, 30, 62, 80, 85, 78, 82, 70, 58, 38, 22, 15, 10, 6, 4, 3, 2];
const GYM = [20, 28, 24, 20, 22, 30, 32, 36, 44, 62, 80, 85, 74, 58, 40, 24, 10];
const UCC = [12, 22, 35, 52, 72, 92, 95, 74, 58, 48, 40, 34, 28, 20, 12, 8, 4];

// --- 1. Opening hours ----------------------------------------------------------------------------

/** Mon–Fri, Saturday, Sunday → a Sunday-first week. */
const weekly = (weekday: DayHours, sat: DayHours, sun: DayHours): WeeklyHours =>
  [sun, weekday, weekday, weekday, weekday, weekday, sat];

// TODO-verify: placeholder opening hours. Replace with each building's published hours.
// Each pair is [open hour, close hour] in 24-hour time, e.g. [8, 23] = 8 AM to 11 PM.
const LIBRARY_HOURS = weekly([8, 23], [10, 22], [10, 22]);
const ACADEMIC_HOURS = weekly([7, 22], [9, 18], [9, 18]);
const GYM_HOURS = weekly([6, 23], [8, 22], [8, 22]);
const UCC_HOURS = weekly([7, 23], [9, 23], [9, 23]);

// --- 2. Buildings --------------------------------------------------------------------------------
// id: used in URLs, zone ids and the map · short: code on map pins · aliases: extra search words
export const BUILDINGS: BuildingInfo[] = [
  { id: 'weldon', name: 'D.B. Weldon Library', short: 'WEL', aliases: ['library', 'weldon'], hours: LIBRARY_HOURS },
  { id: 'taylor', name: 'Allyn & Betty Taylor Library', short: 'TAY', aliases: ['library', 'science library'], hours: LIBRARY_HOURS },
  { id: 'rec', name: 'Western Student Recreation Centre', short: 'REC', aliases: ['rec centre', 'rec center', 'gym', 'src'], hours: GYM_HOURS, areasHeading: 'Areas' },
  { id: 'ucc', name: 'University Community Centre (UCC)', short: 'UCC', aliases: ['spoke', 'food court'], hours: UCC_HOURS, areasHeading: 'Inside the UCC' },
  { id: 'ssc', name: 'Social Science Centre', short: 'SSC', hours: ACADEMIC_HOURS },
  { id: 'nsc', name: 'Natural Sciences Centre', short: 'NSC', hours: ACADEMIC_HOURS },
  { id: 'pab', name: 'Physics & Astronomy Building', short: 'PAB', hours: ACADEMIC_HOURS },
  { id: 'mc', name: 'Middlesex College', short: 'MC', hours: ACADEMIC_HOURS },
  { id: 'uc', name: 'University College', short: 'UC', hours: ACADEMIC_HOURS },
  { id: 'tc', name: 'Talbot College', short: 'TC', hours: ACADEMIC_HOURS },
  { id: 'th', name: 'Thames Hall', short: 'TH', hours: ACADEMIC_HOURS },
  { id: 'ivey', name: 'Ivey Business School', short: 'IVEY', aliases: ['business'], hours: ACADEMIC_HOURS },
  { id: 'ahb', name: 'Arts & Humanities Building', short: 'AHB', hours: ACADEMIC_HOURS },
  { id: 'fims', name: 'FIMS & Nursing Building', short: 'FNB', hours: ACADEMIC_HOURS },
  { id: 'hsb', name: 'Health Sciences Building', short: 'HSB', hours: ACADEMIC_HOURS },
  { id: 'msb', name: 'Medical Sciences Building', short: 'MSB', hours: ACADEMIC_HOURS },
  { id: 'bgs', name: 'Biological & Geological Sciences Building', short: 'BGS', hours: ACADEMIC_HOURS },
  { id: 'chem', name: 'Chemistry Building', short: 'CHB', hours: ACADEMIC_HOURS },
  { id: 'seb', name: 'Spencer Engineering Building', short: 'SEB', hours: ACADEMIC_HOURS },
  { id: 'teb', name: 'Thompson Engineering Building', short: 'TEB', hours: ACADEMIC_HOURS },
  { id: 'aceb', name: 'Amit Chakma Engineering Building', short: 'ACEB', hours: ACADEMIC_HOURS },
  { id: 'stevenson', name: 'Stevenson Hall', short: 'STV', hours: ACADEMIC_HOURS },
  { id: 'ncb', name: 'North Campus Building', short: 'NCB', hours: ACADEMIC_HOURS },
];

// --- 3. Sensor zones ----------------------------------------------------------------------------
// Small helpers that build zone lists, so we don't type out every floor by hand:
//   floors('weldon', 5)  → weldon-f1 … weldon-f5 ("Floor 1" … "Floor 5")
//   areas('ucc', [...])  → ucc-spoke, ucc-food-court, … with their display names
//   main('ssc')          → ssc-main, one zone for the whole building
const floors = (building: string, n: number): ZoneInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${building}-f${i + 1}`, building, name: `Floor ${i + 1}`, kind: 'floor' }));
const areas = (building: string, list: [slug: string, name: string][]): ZoneInfo[] =>
  list.map(([slug, name]) => ({ id: `${building}-${slug}`, building, name, kind: 'area' }));
const main = (building: string): ZoneInfo => ({ id: `${building}-main`, building, name: 'Whole building', kind: 'main' });

/**
 * Sensor zones as the feed reports them. A building's level is the sum of its zones.
 * Shared by the app, the local server and the simulator — keep ids stable.
 */
export const ZONES: ZoneInfo[] = [
  ...floors('weldon', 5),
  ...floors('taylor', 4),
  ...areas('rec', [['weights', 'Weight room'], ['cardio', 'Cardio area'], ['courts', 'Gym courts'], ['pool', 'Pool']]),
  ...areas('ucc', [['spoke', 'The Spoke'], ['food-court', 'Food court'], ['lounges', 'Lounges & study space']]),
  // Every other building is one whole-building zone for now.
  ...BUILDINGS.filter((b) => !['weldon', 'taylor', 'rec', 'ucc'].includes(b.id)).map((b) => main(b.id)),
];

// --- 4. Mock readings ----------------------------------------------------------------------------

/** Which mock curve each building uses (anything not listed uses ACADEMIC). */
const MOCK_CURVES: Record<string, number[]> = { weldon: LIBRARY, taylor: LIBRARY, rec: GYM, ucc: UCC };

/**
 * Mock readings — used when EXPO_PUBLIC_API_URL isn't set (see source.ts).
 * Talbot College, Stevenson Hall and North Campus Building are left out on purpose to show "No data yet".
 */
const READINGS: BuildingReading[] = [
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

/** The mock readings with a typical-day curve attached. */
export const MOCK_READINGS: BuildingReading[] = READINGS.map((r) => ({ ...r, typicalDay: MOCK_CURVES[r.id] ?? ACADEMIC }));
