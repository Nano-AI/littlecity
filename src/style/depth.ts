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
    // ── D12 weathervane ──
    /** A house taller than every house within this many column steps flies a vane. */
    vaneReach: 6,
    // ── D14 roof life ──
    birdhouse: 0.1,
    /** A stork nests on the tallest chimney once the town has this many houses. */
    storkHouses: 12,
    // ── D18 garden things ──
    beehives: 0.3,
    wheelbarrow: 0.5,
    trellis: 0.5,
    // ── D21 castle dressing ──
    cannon: 0.15,
    // ── D26 fingerposts, D27 post ──
    fingerpost: 0.5,
    mailbox: 0.3,
    /** One pillar box on each street at least this long. */
    postboxStreet: 10,
    // ── D28 terrace furniture, D30 stair pots ──
    terrace: 0.6,
    stairPots: 0.3,
    // ── D32 under the trees, D34 lost kite ──
    swing: 0.2,
    hammock: 0.3,
    picnic: 0.35,
    kite: 0.1,
  },
  {
    vistaStreet: [3, 10, 1],
    cornerOriel: [0, 1, 0.05],
    hallFootprint: [4, 20, 1],
    edgeReach: [4, 20, 1],
    rusticThatch: [0, 1, 0.05],
    vaneReach: [2, 12, 1],
    birdhouse: [0, 1, 0.05],
    storkHouses: [1, 40, 1],
    beehives: [0, 1, 0.05],
    wheelbarrow: [0, 1, 0.05],
    trellis: [0, 1, 0.05],
    cannon: [0, 1, 0.05],
    fingerpost: [0, 1, 0.05],
    mailbox: [0, 1, 0.05],
    postboxStreet: [4, 30, 1],
    terrace: [0, 1, 0.05],
    stairPots: [0, 1, 0.05],
    swing: [0, 1, 0.05],
    hammock: [0, 1, 0.05],
    picnic: [0, 1, 0.05],
    kite: [0, 1, 0.05],
  },
);
