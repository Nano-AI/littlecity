// Monuments: towers, lighthouses, arches and bridges, generated supports,
// marble and pillars. Owner: Monuments (Stage 2). All lengths are world units
// (a cell is 1 wide, 0.8 tall); read by src/gen/{tower,lighthouse,arch,
// support,marble,pillar} and src/parts/monuments.

import { defineStyle } from '@/core/style';

export const MONUMENTS = defineStyle(
  'monuments',
  {
    // ── towers ──
    /** Radius of a round tower at its foot, and how much it narrows per storey. */
    towerRadius: 0.4,
    towerBatter: 0.008,
    /** Half-width of a square tower. */
    towerHalf: 0.4,
    /** The whole tower leans by up to this many radians (seeded), when nothing stands on it. */
    towerLean: 0.014,
    /** A band course every this many storeys. */
    bandEvery: 2,
    /** Rise of the cone roof, the spire and the pyramid roof above the top storey. */
    coneRise: 0.78,
    spireRise: 1.5,
    pyramidRise: 0.62,
    /** How far a roof's eave stands out from the wall. */
    towerEave: 0.12,

    // ── lighthouse ──
    lightRadiusFoot: 0.4,
    lightRadiusTop: 0.27,
    galleryOut: 0.11,
    railHeight: 0.17,

    // ── arches and bridges ──
    /** Half-width of the leg of a standing arch (two neighbours make one pier). */
    archLeg: 0.2,
    /** Height at which a standing arch starts to curve. */
    archSpring: 0.3,
    /** Stone left above the crown of an opening. */
    archCrown: 0.15,
    /** Half-width of a pier under a span, along the run. */
    pierHalf: 0.2,
    /** The parapet's height and thickness; the cornice's height and overhang. */
    parapet: 0.15,
    parapetThick: 0.09,
    cornice: 0.06,
    corniceOut: 0.035,
    /** How much a stone bridge's parapet line rises at mid-span. */
    hump: 0.13,
    /** The voussoir ring round every opening: how wide, and how far it stands proud of the face. */
    archRing: 0.09,
    archRingOut: 0.02,
    /** Arches are built of a warmer stone than their palette index: this many places along the stone ramp. */
    archTint: 3,
    /** Longest single arch, in cells; longer spans get piers. */
    archMax: 3,
    /** A hanging run this long (or shorter) is a half arch with no pier. */
    hangMax: 2,

    // ── pillars and generated supports ──
    pillarRadius: 0.15,
    pillarBase: 0.5,
    pillarFlare: 0.66,
    supportRadius: 0.17,
    stiltWidth: 0.08,
    /** How far above the sea a footing shows. */
    footingRise: 0.13,

    // ── marble ──
    /** The base course of a marble mass: height and how far it stands out. */
    marbleBase: 0.1,
    marbleBaseOut: 0.03,
    /** The cornice under its top edges (0 for none: then the shader's bevel line is used instead). */
    marbleCornice: 0.13,
    marbleCorniceOut: 0.025,
    /** The string course at each storey line of a marble wall: height and how far it stands out. */
    marbleCourse: 0.05,
    marbleCourseOut: 0.03,
  },
  {
    towerRadius: [0.28, 0.45, 0.01],
    towerBatter: [0, 0.03, 0.001],
    towerHalf: [0.3, 0.45, 0.01],
    towerLean: [0, 0.04, 0.001],
    bandEvery: [1, 4, 1],
    coneRise: [0.3, 1.4, 0.02],
    spireRise: [0.6, 2.4, 0.05],
    pyramidRise: [0.2, 1.2, 0.02],
    towerEave: [0.04, 0.2, 0.01],
    lightRadiusFoot: [0.3, 0.48, 0.01],
    lightRadiusTop: [0.18, 0.36, 0.01],
    galleryOut: [0.04, 0.2, 0.01],
    railHeight: [0.1, 0.3, 0.01],
    archLeg: [0.1, 0.3, 0.01],
    archSpring: [0, 0.5, 0.01],
    archCrown: [0.08, 0.3, 0.01],
    pierHalf: [0.1, 0.35, 0.01],
    parapet: [0.05, 0.3, 0.01],
    parapetThick: [0.04, 0.16, 0.01],
    cornice: [0.02, 0.12, 0.005],
    corniceOut: [0, 0.08, 0.005],
    hump: [0, 0.3, 0.01],
    archRing: [0, 0.14, 0.01],
    archRingOut: [0, 0.05, 0.005],
    archTint: [0, 7, 1],
    archMax: [1, 6, 1],
    hangMax: [1, 4, 1],
    pillarRadius: [0.08, 0.25, 0.005],
    pillarBase: [0.3, 0.7, 0.01],
    pillarFlare: [0.4, 0.9, 0.01],
    supportRadius: [0.08, 0.3, 0.005],
    stiltWidth: [0.04, 0.16, 0.005],
    footingRise: [0.04, 0.3, 0.01],
    marbleBase: [0, 0.2, 0.01],
    marbleBaseOut: [0, 0.08, 0.005],
    marbleCornice: [0, 0.2, 0.005],
    marbleCorniceOut: [0, 0.08, 0.005],
    marbleCourse: [0, 0.12, 0.005],
    marbleCourseOut: [0, 0.08, 0.005],
  },
);
