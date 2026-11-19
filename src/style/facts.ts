// The numbers in the core facts (design section 10, catalogue terms). Owner: Logic.

import { defineStyle } from '@/core/style';

export const FACTS = defineStyle(
  'facts',
  {
    /** How far a facade looks out ("faces X within n"), in cells. */
    facadeReach: 3,
    /** A courtyard has at most this many cells. */
    courtyardMax: 16,
    /** An alley is at least this long. */
    alleyMin: 2,
    /** The fixed light direction in the ground plane, [x, z] (the renderer's sun is 0.35, 1, 0.6). */
    sun: [0.35, 0.6] as [number, number],
  },
  { facadeReach: [1, 6, 1], courtyardMax: [4, 40, 1], alleyMin: [1, 6, 1] },
);
