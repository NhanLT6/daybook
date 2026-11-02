import { computed } from 'vue';

import { MAX_STAGE, newSeed, SLOT_COUNT } from '@/components/garden/gardenScene';

import type { GardenPlant, SpeciesKey } from '@/components/garden/gardenScene';

import { useStorage } from '@vueuse/core';

import dayjs from 'dayjs';

import { isoDateFormat } from '@/common/DateFormat';
import { storageKeys } from '@/common/storageKeys';

// Each new log item gives one drop. The can holds at most 5, and at most 5 come in per day, so logging extra
// entries never buys growth. Nothing wilts and skipped days cost nothing.
export const DROP_CAP = 5;
const DAILY_DROPS = 5;

interface GardenState {
  plants: (GardenPlant | null)[];
  drops: number;
  earnedToday: number;
  earnedDay: string; // the day earnedToday counts for
}

// One shared store for every garden on screen (Insights column and drawer) and the places that earn drops
const state = useStorage<GardenState>(
  storageKeys.garden,
  { plants: Array(SLOT_COUNT).fill(null), drops: 0, earnedToday: 0, earnedDay: '' },
  localStorage,
  { mergeDefaults: true },
);

export function useGarden() {
  const plants = computed(() => state.value.plants);
  const drops = computed(() => state.value.drops);

  // New logs (form, bulk form or chat) earn drops; a CSV import does not
  const earnDrops = (count: number) => {
    const today = dayjs().format(isoDateFormat);
    if (state.value.earnedDay !== today) {
      state.value.earnedDay = today;
      state.value.earnedToday = 0;
    }
    const earned = Math.max(0, Math.min(count, DAILY_DROPS - state.value.earnedToday, DROP_CAP - state.value.drops));
    state.value.drops += earned;
    state.value.earnedToday += earned;
  };

  const plant = (index: number, species: SpeciesKey) => {
    state.value.plants[index] = { species, stage: 0, seed: newSeed() };
  };

  const clear = (index: number) => {
    state.value.plants[index] = null;
  };

  // One drop grows the plant one stage. Returns the stage it had before, or null when nothing was poured
  const water = (index: number): number | null => {
    const target = state.value.plants[index];
    if (!target || target.stage >= MAX_STAGE || state.value.drops <= 0) return null;
    const fromStage = target.stage;
    target.stage += 1;
    state.value.drops -= 1;
    return fromStage;
  };

  return { plants, drops, earnDrops, plant, clear, water };
}
