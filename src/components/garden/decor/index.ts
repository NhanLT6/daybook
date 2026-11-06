// What stands on the cabinet beside the plant shelf. Each item lives in its own file.
import type { Ctx } from '../creatures/kit';

import { espresso } from './espresso';
import { monitor } from './monitor';

export interface Decor {
  // Drawn with the rest of the room; at night the room is darkened over it
  paint: (c: Ctx, dark: boolean) => void;
  // Drawn after the night darkening: screens and lights that stay bright
  lit?: (c: Ctx, dark: boolean) => void;
}

export const DECOR = { espresso, monitor } satisfies Record<string, Decor>;

export type DecorKey = keyof typeof DECOR;
