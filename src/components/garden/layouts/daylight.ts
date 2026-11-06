// Light by the time of day: the garden room follows the viewer's own clock. The only light comes from the open
// courtyard on the right, from above. Each part of the day sets the sun's colour, strength and slant, how dark
// the room gets away from the courtyard, how long plant shadows fall, the rim on the leaves and an overall grade.
// Dark mode is its own night (moonlight) and does not use this.
export type DayPart = 'morning' | 'noon' | 'golden' | 'dusk';

export interface Daylight {
  part: DayPart;
  // Sun from the courtyard as "r,g,b", its strength, and its slant: how far left it reaches per unit it drops
  sun: { rgb: string; strength: number; slant: number } | null;
  // The room's far, unlit side multiplies toward this colour
  shade: string;
  // Plant shadows on the wall: opacity and length (1 = the layout's own offset)
  shadow: { alpha: number; length: number } | null;
  // Rim on the leaves facing the light
  rim: string;
  // Laid over the whole room and the plants: multiply colour, or null
  grade: string | null;
  // Warm lamp light switched on indoors after sunset, as "r,g,b"
  lamp?: string;
}

export const DAYLIGHT: Record<DayPart, Daylight> = {
  // Low, cool-white sun reaching far in; soft shadows
  morning: {
    part: 'morning',
    sun: { rgb: '255,248,236', strength: 0.85, slant: 0.95 },
    shade: '#A6A7A8',
    shadow: { alpha: 0.16, length: 0.9 },
    rim: 'rgba(255,250,240,.45)',
    grade: null,
  },
  // Sun high: a steep, bright beam close to the courtyard, short shadows
  noon: {
    part: 'noon',
    sun: { rgb: '255,250,242', strength: 1, slant: 0.45 },
    shade: '#A9A8A6',
    shadow: { alpha: 0.22, length: 0.8 },
    rim: 'rgba(255,248,232,.5)',
    grade: null,
  },
  // Late afternoon: warm amber sun slanting far across the room, long shadows
  golden: {
    part: 'golden',
    sun: { rgb: '255,208,150', strength: 1.1, slant: 1.25 },
    shade: '#9C958C',
    shadow: { alpha: 0.26, length: 1.5 },
    rim: 'rgba(255,200,120,.6)',
    grade: 'rgb(255,244,232)',
  },
  // After sunset: no sun, the courtyard a cool blue, a warm lamp indoors
  dusk: {
    part: 'dusk',
    sun: null,
    shade: '#8F8E9E',
    shadow: null,
    rim: 'rgba(255,214,190,.22)',
    grade: 'rgb(218,218,234)',
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
