// Every plant in the picker, in picker order: add or remove a plant here.
import { bocongan } from './bocongan';
import { cachua } from './cachua';
import { cuc } from './cuc';
import { dayenthao } from './dayenthao';
import { duongxi } from './duongxi';
import { hacam } from './hacam';
import { hoagiay } from './hoagiay';
import { hongmon } from './hongmon';
import { lanhodiep } from './lanhodiep';
import { luoiho } from './luoiho';
import { moison } from './moison';
import { monstera } from './monstera';
import { napam } from './napam';
import { senda } from './senda';
import { suthai } from './suthai';
import { tocien } from './tocien';
import { trauba } from './trauba';
import { xuongrong } from './xuongrong';

export const PLANTS = {
  trauba,
  cachua,
  duongxi,
  cuc,
  senda,
  xuongrong,
  hacam,
  lanhodiep,
  hongmon,
  monstera,
  luoiho,
  suthai,
  hoagiay,
  dayenthao,
  moison,
  bocongan,
  tocien,
  napam,
};

export type PlantKey = keyof typeof PLANTS;
