import { useTheme } from 'vuetify';

import { useLocalStorage } from '@vueuse/core';

import { storageKeys } from '@/common/storageKeys';

// Uniform pastel palette - all colors have similar lightness (~80%) and saturation (~50%)
// Avoiding red, orange, yellow to not conflict with error/warning colors
const chartPalette = [
  '#A8D4F0', // soft blue (hsl 205, 65%, 80%)
  '#A8E6CF', // soft mint (hsl 155, 55%, 78%)
  '#C4B8E8', // soft lavender (hsl 260, 50%, 81%)
  '#A8E0E6', // soft cyan (hsl 185, 55%, 78%)
  '#B8D4A8', // soft sage (hsl 95, 35%, 75%)
  '#D4A8D4', // soft mauve (hsl 300, 35%, 75%)
  '#A8C8E6', // soft steel blue (hsl 210, 55%, 78%)
  '#C8E6D4', // soft seafoam (hsl 150, 40%, 85%)
  '#B8B8E8', // soft periwinkle (hsl 240, 50%, 81%)
  '#E6D4E8', // soft thistle (hsl 290, 35%, 87%)
];

// Pure hex↔HSL helpers (h, s, l in 0..1)
const hexToHsl = (hexColor: string): [number, number, number] => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h, s, l];
};

const hslToHex = (h: number, s: number, l: number): string => {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Dark-theme saturation model: moderate saturation (40–60%)
const darkSaturation = (s: number): number => Math.min(Math.max(s * 0.9, 0.4), 0.6);

// Adjust color for dark theme - moderate saturation with comfortable lightness
const adjustColorForDarkTheme = (hexColor: string): string => {
  const [h, s] = hexToHsl(hexColor);
  const newL = 0.6; // Fixed comfortable lightness for dark backgrounds
  return hslToHex(h, darkSaturation(s), newL);
};

/**
 * Derive `count` shades of a base color by stepping lightness across the base
 * hue/saturation. Used to color a project's task segments so they read as tones
 * of the one project color. Theme-aware: darker, less-saturated ramp on dark.
 */
export const deriveTaskShades = (baseHex: string, count: number, isDark: boolean): string[] => {
  if (count <= 0) return [];

  const [h, s] = hexToHsl(baseHex);
  const lStart = isDark ? 0.68 : 0.86;
  const lEnd = isDark ? 0.44 : 0.6;
  const sat = isDark ? darkSaturation(s) : s;

  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const l = lStart + (lEnd - lStart) * t;
    return hslToHex(h, sat, l);
  });
};

export const useProjectColors = () => {
  const theme = useTheme();
  const projectColorMaps = useLocalStorage<Map<string, string>>(
    storageKeys.settings.projectColorMaps,
    new Map<string, string>(),
  );

  const isDark = () => theme.global.name.value === 'dark';

  const setProjectColor = (project: string, color?: string) => {
    if (projectColorMaps.value.has(project)) return;

    const projectColor = color || chartPalette[projectColorMaps.value.size % chartPalette.length];
    projectColorMaps.value.set(project, projectColor);
  };

  // Get project color, adjusted for current theme
  const getProjectColor = (project: string): string => {
    if (!projectColorMaps.value.has(project)) setProjectColor(project);

    const baseColor = projectColorMaps.value.get(project) as string;
    return isDark() ? adjustColorForDarkTheme(baseColor) : baseColor;
  };

  // Map each task of a project to a distinct shade of the project's base color
  const getTaskColors = (project: string, tasks: string[]): Record<string, string> => {
    if (!projectColorMaps.value.has(project)) setProjectColor(project);
    const base = projectColorMaps.value.get(project) as string;
    const shades = deriveTaskShades(base, tasks.length, isDark());
    return Object.fromEntries(tasks.map((task, i) => [task, shades[i]]));
  };

  // Theme-aware utility colors
  // Remaining: neutral grey placeholder (Vuetify grey-darken-3 / grey-lighten-3)
  const remainingDataColor = () => (isDark() ? '#424242' : '#EEEEEE');
  // Weekend: muted red base for the weekend-work flag (not an error — just flagged)
  const weekendDataColor = () => (isDark() ? '#4A2C2C' : '#FFCDD2');

  return {
    chartPalette,
    remainingDataColor,
    weekendDataColor,
    getProjectColor,
    getTaskColors,
    setProjectColor,
  };
};
