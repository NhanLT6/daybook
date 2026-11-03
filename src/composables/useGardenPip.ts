import { effectScope, ref, watch } from 'vue';

import { useGarden } from '@/composables/useGarden';

import { createGardenScene, MAX_STAGE, NIGHT_MATRIX, SPECIES } from '@/components/garden/gardenScene';
import { singleLayout } from '@/components/garden/layouts/single';

// Document Picture-in-Picture is not in TypeScript's DOM lib yet (Chromium 116+, Firefox 151+, no Safari)
interface DocumentPictureInPicture {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window: Window | null;
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export interface PipTheme {
  dark: boolean;
  primary: string;
  onPrimary: string;
  background: string;
  onBackground: string;
}

const PIP_SIZE = { width: 220, height: 280 };

// The browser allows one floating window at a time, so this state is shared by every garden on screen.
// The window outlives the panel that opened it: closing Insights or changing page keeps the plant floating.
const pipSlot = ref<number | null>(null);
let closePip: (() => void) | null = null;

export function useGardenPip() {
  const supported = typeof window !== 'undefined' && !!window.documentPictureInPicture;
  const { plants, drops, water } = useGarden();

  // Must run inside a click handler: the browser only opens the window on a user gesture
  async function open(index: number, theme: () => PipTheme) {
    if (!window.documentPictureInPicture || !plants.value[index]) return;
    closePip?.();
    const pip = await window.documentPictureInPicture.requestWindow(PIP_SIZE);
    const doc = pip.document;
    doc.title = SPECIES[plants.value[index]!.species].name;

    // The window starts empty: no app styles, so the little it needs is set here
    const style = doc.createElement('style');
    style.textContent = `
      html, body { margin: 0; height: 100%; overflow: hidden; font: 12px Roboto, sans-serif; }
      .wrap { position: relative; width: 100%; height: 100%; }
      canvas { display: block; cursor: pointer; }
      .status { position: absolute; top: 8px; left: 8px; right: 8px; text-align: center; pointer-events: none;
        transition: opacity .25s; opacity: 0; }
      .status.show { opacity: 1; }`;
    doc.head.append(style);
    // The night tint filter has to live in the same document as the canvas
    doc.body.innerHTML = `
      <svg width="0" height="0" style="position:absolute" aria-hidden="true">
        <filter id="garden-night-pip" color-interpolation-filters="sRGB">
          <feColorMatrix type="matrix" values="${NIGHT_MATRIX}" />
        </filter>
      </svg>
      <div class="wrap"><canvas role="img"></canvas><div class="status"></div></div>`;
    const canvas = doc.querySelector('canvas')!;
    const status = doc.querySelector<HTMLDivElement>('.status')!;

    const scene = createGardenScene(canvas, {
      height: () => pip.innerHeight,
      nightFilterId: 'garden-night-pip',
      getPlants: () => plants.value,
      getDrops: () => drops.value,
      layout: singleLayout(index),
      view: pip,
    });
    pip.addEventListener('resize', () => scene.resize());

    let statusTimer: ReturnType<typeof setTimeout> | undefined;
    const say = (message: string) => {
      status.textContent = message;
      status.classList.add('show');
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => status.classList.remove('show'), 2200);
    };

    // Same watering rules as the shelf; replanting stays on the shelf, where the picker is
    canvas.addEventListener('click', () => {
      const target = plants.value[index];
      if (!target) return;
      if (target.stage >= MAX_STAGE) {
        scene.pulse(index);
        say(`${SPECIES[target.species].name} ${SPECIES[target.species].done}.`);
        return;
      }
      if (scene.isPouring()) return;
      const fromStage = water(index);
      if (fromStage === null) {
        scene.pulse(index);
        say('Out of water. Log something to get a drop.');
        return;
      }
      scene.pour(index, fromStage);
    });

    // Theme follows the app; the window closes itself when its plant is dug out on the shelf
    const scope = effectScope(true);
    scope.run(() => {
      watch(
        theme,
        (value) => {
          scene.setTheme(value);
          doc.body.style.background = value.background;
          status.style.color = value.onBackground;
        },
        { immediate: true },
      );
      watch(
        () => plants.value[index],
        (plant) => {
          if (!plant) pip.close();
        },
      );
    });

    // Runs once, whether the user closed the window or a newer one replaced it. pagehide can arrive after the
    // next window opened, so only clear the shared state while it still points at this window.
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      scope.stop();
      scene.destroy();
      clearTimeout(statusTimer);
      if (closePip === closeThis) {
        pipSlot.value = null;
        closePip = null;
      }
    };
    const closeThis = () => {
      cleanup();
      pip.close();
    };
    pip.addEventListener('pagehide', cleanup);
    closePip = closeThis;
    pipSlot.value = index;
  }

  const close = () => closePip?.();

  return { supported, pipSlot, open, close };
}
