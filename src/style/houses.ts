// Houses (Stage 2, Houses owner): every tunable number of the house shell,
// the roofs, the openings and the windmill, and the seeded "personality" a
// structure picks once (design section 10, "Organic variation": town →
// structure → part). Rules and generators both read this file, so a rule
// that says "a window from the structure's family" and the part that draws
// it cannot disagree.

import type { Role } from '@/core/vocab';
import { defineStyle } from '@/core/style';
import { hash, rand } from '@/core/rand';
import { DEPTH } from './depth';
import { PALETTE, RAMPS } from './palette';

export const HOUSE = defineStyle(
  'house',
  {
    /** Walls stand this far inside the cell edge (ART.md section 3). */
    inset: 0.07,
    /** How far plinth and trim bands stand proud of the wall. */
    proud: 0.03,
    plinthH: 0.08,
    trimH: 0.05,
    /** Eaves reach this far past the cell edge (so `inset` more past the wall). */
    eave: 0.06,
    /** Gable-end (rake) overhang past the cell edge. */
    rake: 0.04,
    /** The eave line sits this far below the wall top, like a hat pulled down. */
    eaveDrop: 0.035,
    /** Roof slab thickness shown at eaves and rakes. */
    roofThick: 0.05,
    /** Ridge rise for a half-span of 0.5, 1 and 1.5+ cells. */
    rise1: 0.5,
    rise2: 0.74,
    rise3: 0.95,
    /** Lean-to rise per cell of depth. */
    leanRise: 0.42,
    /** How far the middle of a ridge sags, per cell of ridge length (capped). */
    sag: 0.022,
    sagMax: 0.06,
    /** J03: ridge heights of neighbours differ by up to this much. */
    lift: 0.05,
    /** Flat terrace: parapet height and thickness. */
    parapetH: 0.14,
    /** Stone foundation: how far it stands out past the cell edge. */
    foundationOut: 0.035,
    /** Ridge and hip caps: width across and height proud of the roof. */
    capWidth: 0.06,
    capProud: 0.03,
    /** How far the tile tone of a long roof wanders between bands (0.06 = ±6%). */
    tileTone: 0.06,
    /** Chance of a small round window in a gable end. */
    gableWindow: 0.6,
  },
  {
    inset: [0.03, 0.12, 0.005],
    eave: [0, 0.12, 0.01],
    rake: [0, 0.12, 0.01],
    eaveDrop: [0, 0.1, 0.005],
    roofThick: [0, 0.1, 0.005],
    rise1: [0.3, 0.7, 0.01],
    rise2: [0.4, 1, 0.01],
    rise3: [0.5, 1.3, 0.01],
    sag: [0, 0.06, 0.002],
    lift: [0, 0.1, 0.005],
  },
);

export const WINDMILL = defineStyle('windmill', {
  /** Body radius at the foot and under the cap. */
  footR: 0.4,
  neckR: 0.25,
  /** Sail length from the hub, for a mill one cell tall and for each cell more. */
  sail: 0.78,
  sailPerCell: 0.22,
  sailMax: 1.3,
});

export type WindowFamily = 'square' | 'tall' | 'arched' | 'shuttered';
export type DoorLook = 'plank' | 'panel' | 'arched' | 'glazed';
export type RoofCover = 'shingles' | 'thatch' | 'glass';

/** What a structure decides once about itself. */
export interface Personality {
  /** The window family J09 draws from. */
  family: WindowFamily;
  /** Index into RAMPS.roof, chosen to stand out against the wall colour. */
  roof: number;
  roofColor: string;
  cover: RoofCover;
  /** Trim: frames, bands, bargeboards. */
  trim: string;
  /** Doors, shutters and other painted wood. */
  accent: string;
  /** A second accent for flower boxes and the like. */
  accent2: string;
  door: DoorLook;
  /** A trim band between storeys (some houses are plain). */
  storeyBands: boolean;
  /** The gable triangles are half-timbered. */
  timberGable: boolean;
  /** Storeys above the ground storey are weatherboarded (painted planks). */
  plankUpper: boolean;
  /** −1 … 1: a whole-house bias for small leans and offsets. */
  lean: number;
  /**
   * U12 (edge half): how a rustic house far out from the town is built, or null for a town house.
   * 'timber' half-timbered walls, 'stone' a rough stone ground storey, 'planks' weatherboard.
   */
  rustic: 'timber' | 'stone' | 'planks' | null;
}

/** Roof ramp indices that sit badly on each wall ramp index (too close in hue or value). */
const ROOF_CLASH: readonly (readonly number[])[] = [
  [2], //       yellow walls: not the orange roof
  [4], //       lilac: not the slate roof
  [], //        pink
  [3], //       mint: not the green roof
  [1], //       blue: not the blue roof
  [], //        cream
  [2], //       peach: not the orange roof
  [3], //       lime: not the green roof
];
/** Painted-wood accents (doors, shutters). Value and hue both differ from every wall pastel. */
const ACCENTS = ['redDark', 'glass', 'leafDark', 'wood', 'metal'] as const;
const ACCENT_CLASH: readonly (readonly string[])[] = [[], ['glass'], ['redDark'], ['leafDark'], ['glass'], [], ['wood'], ['leafDark']];

/**
 * A structure's personality, from its seed, wall colour, role and size in
 * cells (only small cottages are thatched). Pure: the same structure always
 * gets the same answers.
 */
export function personalityOf(seed: number, color: number, role?: Role, size = 1, rustic = false): Personality {
  const r = (...p: (number | string)[]): number => rand(seed, 'persona', ...p);
  const c = ((color % 8) + 8) % 8;
  const roofs = RAMPS.roof.map((_, i) => i).filter((i) => !ROOF_CLASH[c]!.includes(i));
  let roof = roofs[Math.floor(r('roof') * roofs.length)]!;
  const accents = ACCENTS.filter((a) => !ACCENT_CLASH[c]!.includes(a));
  let accent: string = PALETTE[accents[Math.floor(r('accent') * accents.length)]!];
  const families: WindowFamily[] = ['square', 'square', 'tall', 'arched', 'shuttered', 'shuttered'];
  let family = families[Math.floor(r('family') * families.length)]!;
  const doors: DoorLook[] = ['plank', 'panel', 'panel', 'arched', 'glazed'];
  let door = doors[Math.floor(r('door') * doors.length)]!;
  let cover: RoofCover = 'shingles';
  let trim: string = PALETTE.white;
  if (role === 'chapel') {
    family = 'arched';
    door = 'arched';
    roof = c === 4 ? 4 : 1; // a slate-blue roof reads as "church"
    accent = PALETTE.wood;
  } else if (role === 'stilt-house') {
    family = 'square';
    door = 'plank';
  } else if (role === 'greenhouse') {
    cover = 'glass';
    door = 'glazed';
  } else if (role === 'manor') {
    family = r('family') < 0.5 ? 'tall' : 'arched';
    door = 'panel';
  } else if (role === 'boathouse') {
    family = 'square';
  } else if (role === 'keepers-cottage') {
    roof = 0;
    accent = PALETTE.redDark;
    trim = PALETTE.red;
  } else if (role === 'town-hall') {
    // U11: a civic front: tall windows, a panelled double door, bands between the storeys.
    family = 'tall';
    door = 'panel';
  } else if (role === 'cottage' && size <= 4 && r('thatch') < 0.16) {
    cover = 'thatch';
  }
  // U12 (edge half): out at the edge of town a small house is often thatched, and its walls are
  // timber, rough stone or boards.
  let rusticWalls: Personality['rustic'] = null;
  if (rustic) {
    if (size <= 6 && r('rustic-thatch') < DEPTH.rusticThatch) cover = 'thatch';
    rusticWalls = (['timber', 'timber', 'stone', 'planks'] as const)[Math.floor(r('rustic-walls') * 4)]!;
  }
  const accent2 = [PALETTE.yellow, PALETTE.pink, PALETTE.red, PALETTE.white][hash(seed, 'accent2') % 4]!;
  return {
    family,
    roof,
    roofColor: cover === 'thatch' ? PALETTE.sand : cover === 'glass' ? PALETTE.glass : RAMPS.roof[roof]!,
    cover,
    trim,
    accent,
    accent2,
    door,
    storeyBands: role === 'town-hall' || (rusticWalls !== 'timber' && r('bands') < 0.7),
    timberGable: role !== 'chapel' && role !== 'stilt-house' && r('timber-gable') < 0.22,
    plankUpper: role !== 'chapel' && r('plank-upper') < 0.18,
    lean: r('lean') * 2 - 1,
    rustic: rusticWalls,
  };
}

/** Mixes two '#rrggbb' colours (t = 0 gives a, 1 gives b). For trims derived from palette colours. */
export function mixColor(a: string, b: string, t: number): [number, number, number] {
  const p = (s: string, i: number): number => Number.parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)) as [number, number, number];
}
