// Every pot a layout can place: add or remove a pot here.
import { bowl } from './bowl';
import { ceramic } from './ceramic';
import { concrete } from './concrete';
import { terracotta } from './terracotta';
import { white } from './white';

export const POTS = { terracotta, white, ceramic, concrete, bowl };

export type PotKey = keyof typeof POTS;
