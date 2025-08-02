import { useLocalStorage } from '@vueuse/core';

import { storageKeys } from '@/common/storageKeys';

const chartPalette = [
  '#A3D8F4', // pastel blue
  '#B0EACD', // pastel mint green
  '#FDE2A8', // pastel yellow
  '#D0C7F6', // pastel lavender
  '#87CEEB', // pastel sky blue
  '#98FB98', // pastel light green
  '#E6E6FA', // pastel light purple
  '#AFEEEE', // pastel turquoise
  '#F0E68C', // pastel khaki
  '#B19CD9', // pastel medium purple
];

export const useProjectColors = () => {
  const projectColorMaps = useLocalStorage<Map<string, string>>(
    storageKeys.settings.projectColorMaps,
    new Map<string, string>(),
  );

  const setProjectColor = (project: string, color?: string) => {
    if (projectColorMaps.value.has(project)) return;

    const projectColor = color || chartPalette[projectColorMaps.value.size % chartPalette.length];
    projectColorMaps.value.set(project, projectColor);
  };

  const getProjectColor = (project: string): string => {
    if (!projectColorMaps.value.has(project)) setProjectColor(project);

    return <string>projectColorMaps.value.get(project);
  };

  return {
    chartPalette,
    remainingDataColor: '#E8F5E9',
    invalidDataColor: '#FFCDD2',
    getProjectColor,
    setProjectColor,
  };
};
