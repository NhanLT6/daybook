// Light by the time of day: the garden room follows the viewer's own clock. Each part of the day sets the sky in
// the window, the sun's colour and reach, how long plant shadows fall, the rim on the leaves and an overall grade.
// Dark mode is its own night and does not use this.
export type DayPart = 'morning' | 'noon' | 'golden' | 'dusk';

export interface Daylight {
  part: DayPart;
  // Window sky, top to horizon
  sky: [string, string, string];
  // Far trees and rooftops in the window
  far: { trees: [string, string]; roofs: string; clouds: string };
  // Sun through the window as "r,g,b" and its strength (0 = no sun); reach: how far the floor patch runs left
  sun: { rgb: string; strength: number; reach: number } | null;
  // Plant shadows on the wall: opacity and length (1 = the layout's own offset)
  shadow: { alpha: number; length: number } | null;
  // Rim on the leaves facing the window
  rim: string;
  // Laid over the whole room and the plants: multiply colour, or null
  grade: string | null;
  // Warm lamp light switched on indoors after sunset, as "r,g,b"
  lamp?: string;
}

export const DAYLIGHT: Record<DayPart, Daylight> = {
  // Low, cool-white sun; a short patch and soft shadows
  morning: {
    part: 'morning',
    sky: ['#BFD9EA', '#DCEBF1', '#F4F1E6'],
    far: { trees: ['#A9C6B4', '#BDD4C3'], roofs: '#D2DCE0', clouds: 'rgba(255,255,255,.6)' },
    sun: { rgb: '255,240,214', strength: 0.85, reach: 0.8 },
    shadow: { alpha: 0.16, length: 0.8 },
    rim: 'rgba(255,246,222,.45)',
    grade: null,
  },
  // Sun high: bright, neutral, short shadows
  noon: {
    part: 'noon',
    sky: ['#CFE2EC', '#E6F0F0', '#F3F2E8'],
    far: { trees: ['#AFC8B1', '#C2D6C1'], roofs: '#D6DEDE', clouds: 'rgba(255,255,255,.55)' },
    sun: { rgb: '255,236,200', strength: 1, reach: 1 },
    shadow: { alpha: 0.22, length: 1 },
    rim: 'rgba(255,238,190,.5)',
    grade: null,
  },
  // Late afternoon: warm amber sun reaching far across the floor, long shadows
  golden: {
    part: 'golden',
    sky: ['#E9CDA8', '#F3D9B5', '#F8E6C8'],
    far: { trees: ['#B9BE98', '#C9C7A3'], roofs: '#E2D2BC', clouds: 'rgba(255,236,205,.6)' },
    sun: { rgb: '255,196,120', strength: 1.25, reach: 1.35 },
    shadow: { alpha: 0.26, length: 1.6 },
    rim: 'rgba(255,200,120,.6)',
    grade: 'rgb(255,236,214)',
  },
  // After sunset: violet-blue sky with an afterglow, no sun, the room a little dim and cool
  dusk: {
    part: 'dusk',
    sky: ['#55618F', '#9A8AAE', '#E9B394'],
    far: { trees: ['#6E7A86', '#7E8994'], roofs: '#8E93A6', clouds: 'rgba(240,190,180,.45)' },
    sun: null,
    shadow: null,
    rim: 'rgba(255,214,190,.22)',
    grade: 'rgb(214,214,232)',
    lamp: '255,196,130',
  },
};

// Preview another part of the day by setting localStorage `gardenDayPart` (morning, noon, golden, dusk)
export function dayPartAt(date: Date): DayPart {
  try {
    const forced = localStorage.getItem('gardenDayPart');
    if (forced && forced in DAYLIGHT) return forced as DayPart;
  } catch {
    // No storage: follow the clock
  }
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 15) return 'noon';
  if (hour >= 15 && hour < 18.5) return 'golden';
  return 'dusk';
}
