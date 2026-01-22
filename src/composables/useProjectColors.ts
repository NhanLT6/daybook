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

// Adjust color for dark theme - moderate saturation with comfortable lightness
const adjustColorForDarkTheme = (hexColor: string): string => {
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

  // For dark theme: moderate saturation (50-60%), comfortable lightness (55-65%)
  const newS = Math.min(Math.max(s * 0.9, 0.4), 0.6);
  const newL = 0.6; // Fixed comfortable lightness for dark backgrounds

  const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const [newR, newG, newB] = hslToRgb(h, newS, newL);
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
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

  // Theme-aware utility colors
  // Remaining: subtle placeholder color (very muted on dark theme)
  const remainingDataColor = () => (isDark() ? '#2E3B2E' : '#E8F5E9');
  const invalidDataColor = () => (isDark() ? '#4A2C2C' : '#FFCDD2');

  return {
    chartPalette,
    remainingDataColor,
    invalidDataColor,
    getProjectColor,
    setProjectColor,
  };
};
