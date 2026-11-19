// Dressing depth (Stage 4): the numbers behind the urban-fill rules that
// change how a house is drawn (U09 to U12) and the rest of part D. Densities
// are chances per candidate; lengths are world units (a cell is 1 wide, 0.8
// tall). Read by src/rules/{roles,joinery,decoration,urban} and the parts
// they place. Read values inside find()/build(), never at module load.

import { defineStyle } from '@/core/style';

export const DEPTH = defineStyle(
  'depth',
  {
    // ── U09 vista end ──
    /** A straight street at least this long makes a vista of the facade it runs into. */
    vistaStreet: 5,
    // ── U10 corners ──
    /** Share of corner houses (2+ storeys at a street junction) that grow a corner turret. */
    cornerOriel: 1,
    // ── U11 civic hall ──
    /** A house on a square with a footprint of at least this many cells is the town hall. */
    hallFootprint: 8,
    // ── U12 edge half ──
    /** Houses farther than this many column steps from every floor of the town are rustic. */
    edgeReach: 10,
    /** Share of small rustic houses (footprint up to 6) that are thatched. */
    rusticThatch: 0.6,
  },
  {
    vistaStreet: [3, 10, 1],
    cornerOriel: [0, 1, 0.05],
    hallFootprint: [4, 20, 1],
    edgeReach: [4, 20, 1],
    rusticThatch: [0, 1, 0.05],
  },
);
