import type { BuildingInfo, BuildingReading } from './types';

// Typical-day curves, 7 AM → 11 PM. Placeholder shapes until real history exists.
const LIBRARY = [8, 15, 28, 42, 55, 62, 68, 74, 78, 80, 76, 70, 66, 60, 50, 36, 20];
const ACADEMIC = [10, 30, 62, 80, 85, 78, 82, 70, 58, 38, 22, 15, 10, 6, 4, 3, 2];
const GYM = [20, 28, 24, 20, 22, 30, 32, 36, 44, 62, 80, 85, 74, 58, 40, 24, 10];
const UCC = [12, 22, 35, 52, 72, 92, 95, 74, 58, 48, 40, 34, 28, 20, 12, 8, 4];

export const BUILDINGS: BuildingInfo[] = [
  { id: 'weldon', name: 'D.B. Weldon Library', short: 'WEL', map: { x: 190, y: 430 }, typicalDay: LIBRARY },
  { id: 'taylor', name: 'Allyn & Betty Taylor Library', short: 'TAY', map: { x: 250, y: 165 }, typicalDay: LIBRARY },
  { id: 'rec', name: 'Western Student Recreation Centre', short: 'REC', map: { x: 340, y: 495 }, typicalDay: GYM, areasHeading: 'Areas' },
  { id: 'ucc', name: 'University Community Centre (UCC)', short: 'UCC', map: { x: 240, y: 350 }, typicalDay: UCC, areasHeading: 'Inside the UCC' },
  { id: 'ssc', name: 'Social Science Centre', short: 'SSC', map: { x: 90, y: 175 }, typicalDay: ACADEMIC },
  { id: 'nsc', name: 'Natural Sciences Centre', short: 'NSC', map: { x: 290, y: 100 }, typicalDay: ACADEMIC },
  { id: 'pab', name: 'Physics & Astronomy Building', short: 'PAB', map: { x: 270, y: 280 }, typicalDay: ACADEMIC },
  { id: 'mc', name: 'Middlesex College', short: 'MC', map: { x: 180, y: 305 }, typicalDay: ACADEMIC },
  { id: 'uc', name: 'University College', short: 'UC', map: { x: 110, y: 265 }, typicalDay: ACADEMIC },
  { id: 'tc', name: 'Talbot College', short: 'TC', map: { x: 60, y: 450 }, typicalDay: ACADEMIC },
  { id: 'th', name: 'Thames Hall', short: 'TH', map: { x: 280, y: 445 }, typicalDay: ACADEMIC },
  { id: 'ivey', name: 'Ivey Business School', short: 'IVEY', map: { x: 50, y: 100 }, typicalDay: ACADEMIC },
  { id: 'ahb', name: 'Arts & Humanities Building', short: 'AHB', map: { x: 60, y: 335 }, typicalDay: ACADEMIC },
  { id: 'fims', name: 'FIMS & Nursing Building', short: 'FNB', map: { x: 210, y: 110 }, typicalDay: ACADEMIC },
  { id: 'hsb', name: 'Health Sciences Building', short: 'HSB', map: { x: 320, y: 375 }, typicalDay: ACADEMIC },
  { id: 'msb', name: 'Medical Sciences Building', short: 'MSB', map: { x: 110, y: 400 }, typicalDay: ACADEMIC },
  { id: 'bgs', name: 'Biological & Geological Sciences Building', short: 'BGS', map: { x: 170, y: 170 }, typicalDay: ACADEMIC },
  { id: 'chem', name: 'Chemistry Building', short: 'CHB', map: { x: 210, y: 235 }, typicalDay: ACADEMIC },
  { id: 'seb', name: 'Spencer Engineering Building', short: 'SEB', map: { x: 345, y: 300 }, typicalDay: ACADEMIC },
  { id: 'teb', name: 'Thompson Engineering Building', short: 'TEB', map: { x: 330, y: 225 }, typicalDay: ACADEMIC },
  { id: 'aceb', name: 'Amit Chakma Engineering Building', short: 'ACEB', map: { x: 350, y: 150 }, typicalDay: ACADEMIC },
  { id: 'stevenson', name: 'Stevenson Hall', short: 'STV', map: { x: 40, y: 250 }, typicalDay: ACADEMIC },
  { id: 'ncb', name: 'North Campus Building', short: 'NCB', map: { x: 130, y: 90 }, typicalDay: ACADEMIC },
];

/** Mock readings — replace with the real feed in source.ts. */
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
      { name: 'Floor 4', level: 0 },
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
  { id: 'tc', level: 1, trend: 'down' },
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
  { id: 'stevenson', level: 0, trend: 'steady' },
  { id: 'ncb', level: 1, trend: 'down' },
];
