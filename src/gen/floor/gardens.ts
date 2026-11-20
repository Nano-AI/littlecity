// What grows in each kind of garden (R-G01). Not a generator file:
// garden.gen.ts lays the region's ground and calls one of these per cell.
//
// Everything is built for the zoom the game is played at, where a cell is
// about 55 pixels: flowers are bold dabs and clumps in a few colours, never
// single petals; each cell's planting shares one ink group, so it is drawn
// as masses with a little outline where one clump stands in front of
// another, not as a hundred outlined dots. Budget: under 400 triangles a cell.

import { CELL_H, keyX, keyY, keyZ, neighbor, type CellKey, type Dir4 } from '@/core/grid';
import { translation, type Vec3 } from '@/core/mat4';
import { hash } from '@/core/rand';
import { EDGE_FAR, PATTERN, type MeshBuilder, type SwayInput } from '@/gen/mesh';
import { dab, groundNoise, lump, mixColor, mound, roundedRect, rngOf, SHADE_SIDE, TONE, tube, vary, type Rgb, type Rng } from '@/parts/ground/kit';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { FLOOR } from '@/style/ground';
import { PALETTE } from '@/style/palette';
import { cellSlab, DIRS, fan, SIDE, type LinkVariant } from './sheet';

export interface GardenCtx {
  b: MeshBuilder;
  plan: ShapePlan;
  s: Structure;
  cells: ReadonlySet<CellKey>;
  links: ReadonlyMap<CellKey, ReadonlyMap<Dir4, LinkVariant>>;
  /** A wheat field's state per cell (life's harvest, src/life/town/chains/harvest.ts); standing ripe when absent. */
  wheat?: (cell: CellKey) => WheatState;
}

/**
 * How a cell of a wheat field stands (L59, the harvest; the seasons):
 *   growth  0 ploughed earth, about 0.3 green shoots, up to 1 ripe and golden, full height
 *   cut     rows mown, 0 to WHEAT_ROWS: the swathe falls row by row from the `from` side (0: the cell's north
 *           edge, 2: its south edge), leaving short stubble on bare earth
 */
export interface WheatState {
  growth: number;
  cut: number;
  from: 0 | 2;
}
/** Half-rows of wheat across a cell (the crests and furrows): what `cut` counts. */
export const WHEAT_ROWS = 10;
export const STANDING: WheatState = Object.freeze({ growth: 1, cut: 0, from: 0 });

type Pt = readonly [number, number];
type Color = string | Rgb;

const BLOOMS: readonly string[] = [PALETTE.pink, PALETTE.red, PALETTE.yellow, PALETTE.white, PALETTE.magic, PALETTE.glass];

/** Three flower colours for a region: its own little palette, so a garden has a character. */
function bloomsOf(seed: number): Color[] {
  const first = Math.floor(rngOf(seed)('bloom') * BLOOMS.length);
  const stepBy = 1 + Math.floor(rngOf(seed)('bloom-step') * 2);
  return [BLOOMS[first]!, BLOOMS[(first + stepBy) % BLOOMS.length]!, BLOOMS[(first + stepBy * 2 + 1) % BLOOMS.length]!];
}

const cellRng = (s: Structure, cell: CellKey): Rng => rngOf(hash(s.seed, cell));
const inRegion = (c: GardenCtx, cell: CellKey) => (d: Dir4): boolean => c.cells.has(neighbor(cell, d));
const groundY = (cell: CellKey): number => keyY(cell) * CELL_H + FLOOR.gardenLift;
/** Something stands in the cell (a tree, a fountain, a stall, a fence piece): plant round it, not through it. */
const occupied = (c: GardenCtx, cell: CellKey): boolean => c.plan.kinds.has(cell);

/** The ground of a garden cell: one low slab for the whole region. */
function ground(c: GardenCtx, cell: CellKey, color: Color, pattern: number): void {
  const y0 = keyY(cell) * CELL_H;
  c.b.with({ color, pattern, ink: 'ground' }, () => cellSlab(c.b, cell, inRegion(c, cell), { y0, y1: y0 + FLOOR.gardenLift, round: FLOOR.gardenRound }));
}

/** A flower: a round head in one flat colour on a dark leafy mound. */
function bloom(b: MeshBuilder, x: number, y: number, z: number, size: number, height: number, color: Color, leaf: Color): void {
  b.with({ color: leaf, pattern: PATTERN.none, sway: 0 }, () => mound(b, x + SHADE_SIDE[0] * size * 0.3, y, z + SHADE_SIDE[1] * size * 0.3, size * 1.15, height * 0.9, size * 1.15, { seg: 6, rings: 2, normal: TONE.shade }));
  b.with({ color, pattern: PATTERN.none, sway: 0.2 }, () => lump(b, x, y + height, z, size, size * 0.8, size, { seg: 6, rings: 3, normal: TONE.lit }));
}

/** A leafy plant with no flower: a light heap on a shaded one. */
function shrub(b: MeshBuilder, x: number, y: number, z: number, size: number, color: Color): void {
  b.with({ color: mixColor(color, PALETTE.leafDark, 0.3), pattern: PATTERN.leaves, sway: 0 }, () => mound(b, x + SHADE_SIDE[0] * size * 0.3, y, z + SHADE_SIDE[1] * size * 0.3, size * 1.2, size * 0.9, size * 1.2, { seg: 6, rings: 2, normal: TONE.shade }));
  b.with({ color, pattern: PATTERN.leaves, sway: 0.2 }, () => lump(b, x, y + size * 0.7, z, size, size * 0.85, size, { seg: 6, rings: 3, normal: TONE.lit }));
}

// ───────────────────────────────────────────────────────── flower garden ──

/** Flower beds in a lawn: each cell a rounded bed of earth, planted in drifts of the region's three colours. */
export function flowerGarden(c: GardenCtx, cell: CellKey): void {
  const { b, s } = c;
  ground(c, cell, PALETTE.garden, PATTERN.none);
  const x = keyX(cell), z = keyZ(cell), y = groundY(cell);
  const r = cellRng(s, cell);
  const blooms = bloomsOf(s.seed);
  const busy = occupied(c, cell);
  const bed = roundedRect(x + 0.1, z + 0.1, x + 0.9, z + 0.9, 0.24 + r('round') * 0.1, 3).map(([px, pz]): Pt => [px + (groundNoise(s.seed, px * 3, pz * 3) - 0.5) * 0.05, pz + (groundNoise(s.seed ^ 9, px * 3, pz * 3) - 0.5) * 0.05]);
  b.with({ color: PALETTE.dirtDark, pattern: PATTERN.dirt, ink: 'bed' }, () => fan(b, [x + 0.5, z + 0.5], bed, y + 0.004, true));
  b.setInk(`plants${cell}`);
  const leaf = vary(PALETTE.leafDark, r('leaf'), 0.6);
  for (let i = 0; i < 9; i++) {
    const gx = (i % 3) - 1, gz = Math.floor(i / 3) - 1;
    if (busy && gx === 0 && gz === 0) continue;
    if (r('skip', i) < (busy ? 0.4 : 0.2)) continue;
    const px = x + 0.5 + gx * 0.25 + (r('jx', i) - 0.5) * 0.13, pz = z + 0.5 + gz * 0.25 + (r('jz', i) - 0.5) * 0.13;
    // Colour by place, so neighbours agree and the bed is planted in drifts.
    const drift = Math.floor(groundNoise(s.seed ^ 0x51, px * 1.6, pz * 1.6) * 3 + r('d', i) * 0.7) % 3;
    if (r('kind', i) < 0.24) shrub(b, px, y, pz, 0.08 + r('ss', i) * 0.03, vary(PALETTE.bush, r('sc', i), 0.8));
    else bloom(b, px, y, pz, 0.075 + r('bs', i) * 0.035, 0.08 + r('bh', i) * 0.07, blooms[drift]!, leaf);
  }
}

// ──────────────────────────────────────────────────────── kitchen garden ──

const VEG: readonly string[] = [PALETTE.leaf, PALETTE.leafDark, PALETTE.bush];

/** Raised beds by a house: cabbages in rows, bean poles, pumpkins, or a bed of flowers, mixed by seed. */
export function kitchenGarden(c: GardenCtx, cell: CellKey): void {
  const { b, s } = c;
  ground(c, cell, PALETTE.garden, PATTERN.none);
  if (occupied(c, cell)) return;
  const x = keyX(cell), z = keyZ(cell), y = groundY(cell);
  const r = cellRng(s, cell);
  const x0 = x + 0.1, x1 = x + 0.9, z0 = z + 0.1, z1 = z + 0.9, h = 0.075;
  // The bed: a timber frame with earth in it. The furrows of the crops pattern run along x.
  b.with({ color: vary(PALETTE.wood, r('wood'), 0.6), pattern: PATTERN.planks, ink: 'frame' }, () => b.box([x0, y, z0], [x1, y + h, z1], { skip: ['bottom'] }));
  b.with({ color: PALETTE.dirtDark, pattern: PATTERN.crops, ink: 'earth' }, () => b.quad([x0 + 0.05, y + h + 0.002, z1 - 0.05], [x1 - 0.05, y + h + 0.002, z1 - 0.05], [x1 - 0.05, y + h + 0.002, z0 + 0.05], [x0 + 0.05, y + h + 0.002, z0 + 0.05]));
  const top = y + h;
  b.setInk(`plants${cell}`);
  const what = Math.floor(r('what') * 4);
  if (what === 0) {
    // Cabbages: three rows of four.
    for (let row = 0; row < 3; row++) {
      const color = vary(VEG[row % VEG.length]!, r('vc', row), 0.6);
      for (let i = 0; i < 4; i++) {
        const px = x + 0.21 + i * 0.193 + (r('vx', row, i) - 0.5) * 0.03, pz = z + 0.27 + row * 0.23;
        b.with({ color, pattern: PATTERN.none }, () => mound(b, px, top, pz, 0.075, 0.07, 0.075, { seg: 6, rings: 2, normal: (row + i) % 2 ? TONE.lit : TONE.mid, twist: i }));
      }
    }
  } else if (what === 1) {
    // Bean poles at the back, pumpkins in front.
    for (let i = 0; i < 3; i++) {
      const px = x + 0.26 + i * 0.24, pz = z + 0.28;
      b.with({ color: PALETTE.wood, pattern: PATTERN.none }, () => tube(b, [[px, top, pz], [px + (r('pl', i) - 0.5) * 0.04, top + 0.42, pz]], 0.014, { seg: 4 }));
      b.with({ color: vary(PALETTE.leaf, r('pc', i), 0.6), pattern: PATTERN.leaves, sway: 0.25 }, () => {
        lump(b, px, top + 0.14, pz, 0.065, 0.08, 0.065, { seg: 6, rings: 3, normal: TONE.lit });
        lump(b, px + 0.01, top + 0.28, pz, 0.05, 0.07, 0.05, { seg: 6, rings: 3, normal: TONE.mid });
      });
    }
    for (let i = 0; i < 3; i++) {
      const px = x + 0.24 + i * 0.25 + (r('ux', i) - 0.5) * 0.06, pz = z + 0.68 + (r('uz', i) - 0.5) * 0.08, rad = 0.06 + r('ur', i) * 0.025;
      b.with({ color: mixColor(PALETTE.brick, PALETTE.yellow, 0.35), pattern: PATTERN.none }, () => lump(b, px, top + rad * 0.7, pz, rad, rad * 0.75, rad, { seg: 6, rings: 3, normal: TONE.lit }));
      b.with({ color: PALETTE.leafDark, pattern: PATTERN.none }, () => mound(b, px + 0.07, top, pz - 0.05, 0.05, 0.03, 0.05, { seg: 5, rings: 1, normal: TONE.shade }));
    }
  } else if (what === 2) {
    // Leafy rows: lettuce and carrot tops, lighter and darker by row.
    for (let row = 0; row < 4; row++) {
      const color = vary(VEG[(row + 1) % VEG.length]!, r('lc', row), 0.7);
      const pz = z + 0.23 + row * 0.18;
      for (let i = 0; i < 3; i++) {
        const px = x + 0.25 + i * 0.25 + (r('lx', row, i) - 0.5) * 0.05;
        b.with({ color, pattern: PATTERN.none }, () => mound(b, px, top, pz, 0.1, 0.045 + (row % 2) * 0.03, 0.06, { seg: 6, rings: 2, normal: row % 2 ? TONE.lit : TONE.mid }));
      }
    }
  } else {
    // A bed of flowers for the table: rows of one colour each.
    const blooms = bloomsOf(s.seed ^ cell);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) {
        const px = x + 0.22 + i * 0.187 + (r('fx', row, i) - 0.5) * 0.03, pz = z + 0.27 + row * 0.23;
        bloom(b, px, top, pz, 0.06, 0.07 + r('fh', row, i) * 0.03, blooms[row]!, PALETTE.leafDark);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────── wheat field ──

/** Rows of wheat to a cell: the furrows of the crops pattern, 0.2 apart. */
const ROWS = 5;

/** Height of the standing wheat at a point: it rolls a little, and the same everywhere it is asked. */
function wheatTop(seed: number, x: number, z: number): number {
  return 0.25 + groundNoise(seed ^ 0x77, x * 1.9, z * 1.9) * 0.07;
}

/**
 * Standing wheat (near a windmill): one golden mass over the region, drawn in
 * rows (a low ridge to each row, so alternate slopes take the light and the
 * half tone), its ears rippling in the wind.
 */
export function wheatField(c: GardenCtx, cell: CellKey): void {
  const { b, s } = c;
  const state = c.wheat?.(cell) ?? STANDING;
  const growth = Math.max(0, Math.min(1, state.growth));
  // Ripe gold; green while it grows.
  const ripe = mixColor(PALETTE.yellow, PALETTE.dirt, 0.28);
  const gold = growth >= 0.85 ? ripe : mixColor('#7fae4e', ripe, Math.max(0, (growth - 0.3) / 0.55));
  ground(c, cell, mixColor(PALETTE.dirt, PALETTE.yellow, growth > 0 ? 0.2 : 0.05), PATTERN.crops);
  if (occupied(c, cell) || growth <= 0) return;
  const x = keyX(cell), z = keyZ(cell), y = groundY(cell);
  // The wheat stands in from the field's edge, and stops round anything that stands in a cell.
  const stands = (d: Dir4): boolean => {
    const n = neighbor(cell, d);
    return c.cells.has(n) && !c.plan.kinds.has(n);
  };
  const open = DIRS.map(stands);
  const inset = 0.07;
  const NX = 2, NZ = ROWS * 2;
  // Grid lines sit at fixed places in the cell, so neighbours share their edge points; only the outer lines stand in.
  const px = (i: number): number => (i === 0 && !open[3] ? x + inset : i === NX && !open[1] ? x + 1 - inset : x + i / NX);
  const pz = (j: number): number => (j === 0 && !open[0] ? z + inset : j === NZ && !open[2] ? z + 1 - inset : z + j / NZ);
  // Mown rows: from the north edge (j counting up) or from the south (counting down).
  const cut = Math.max(0, Math.min(NZ, Math.round(state.cut)));
  const isCut = (j: number): boolean => (state.from === 0 ? j < cut : j >= NZ - cut);
  // Odd lines are the crests of the rows, even lines the furrows between them.
  const height = (i: number, j: number): number => wheatTop(s.seed, px(i), pz(j)) * growth;
  const top = (i: number, j: number): Vec3 => [px(i), y + height(i, j) + (j % 2 === 1 ? 0.013 : -0.013) * growth, pz(j)];
  // Only the ears move: the foot of the wheat is rooted.
  const sway: SwayInput = (_x, yy) => (yy > y + 0.1 ? 0.55 : 0);
  b.with({ color: gold, pattern: PATTERN.crops, ink: 'wheat', sway }, () => {
    for (let j = 0; j < NZ; j++) if (!isCut(j)) for (let i = 0; i < NX; i++) b.quad(top(i, j + 1), top(i + 1, j + 1), top(i + 1, j), top(i, j));
  });
  // Stubble where it is mown: short stalks in rows on the bare earth.
  if (cut > 0) {
    const stub = (i: number, j: number): Vec3 => [px(i), y + (j % 2 === 1 ? 0.045 : 0.012), pz(j)];
    b.with({ color: mixColor(ripe, PALETTE.dirt, 0.35), pattern: PATTERN.crops, ink: 'stubble' }, () => {
      for (let j = 0; j < NZ; j++) if (isCut(j)) for (let i = 0; i < NX; i++) b.quad(stub(i, j + 1), stub(i + 1, j + 1), stub(i + 1, j), stub(i, j));
    });
  }
  b.with({ color: gold, pattern: PATTERN.thatch, ink: 'wheat', sway }, () => {
    const wall = (p: Vec3, q: Vec3): void => {
      const mid: Pt = [x + 0.5, z + 0.5];
      const dx = q[0] - p[0], dz = q[2] - p[2];
      const out = dz * ((p[0] + q[0]) / 2 - mid[0]) - dx * ((p[2] + q[2]) / 2 - mid[1]) >= 0;
      const a: Vec3 = [p[0], y, p[2]], bb: Vec3 = [q[0], y, q[2]];
      if (out) b.quad(bb, a, p, q);
      else b.quad(a, bb, q, p);
    };
    // The standing edge facing where it is mown: the face the next swing takes.
    const facing = (j: number, outward: 1 | -1): void => {
      for (let i = 0; i < NX; i++) {
        const p = top(i, j), q = top(i + 1, j);
        const a: Vec3 = [p[0], y, p[2]], bb: Vec3 = [q[0], y, q[2]];
        if (outward < 0) b.quad(bb, a, p, q);
        else b.quad(a, bb, q, p);
      }
    };
    if (cut > 0 && cut < NZ) {
      if (state.from === 0) facing(cut, -1);
      else facing(NZ - cut, 1);
    }
    for (let i = 0; i < NX; i++) {
      if (!open[0] && !isCut(0)) wall(top(i, 0), top(i + 1, 0));
      if (!open[2] && !isCut(NZ - 1)) wall(top(i, NZ), top(i + 1, NZ));
    }
    for (let j = 0; j < NZ; j++) {
      if (isCut(j)) continue;
      // Sides: at the field's edge, and where the cell beside is mown.
      if (!open[3] || (c.wheat && c.wheat(neighbor(cell, 3)).cut >= NZ)) wall(top(0, j), top(0, j + 1));
      if (!open[1] || (c.wheat && c.wheat(neighbor(cell, 1)).cut >= NZ)) wall(top(NX, j), top(NX, j + 1));
    }
  });
  // Poppies in the ripe corn.
  if (growth < 0.85) return;
  const r = cellRng(s, cell);
  b.with({ color: PALETTE.red, pattern: PATTERN.none, ink: 'wheat', sway: 0.55 }, () => {
    for (let i = 0; i < 2; i++) {
      if (r('poppy', i) < 0.5) continue;
      const fx = x + 0.2 + r('fx', i) * 0.6, fz = z + 0.2 + r('fz', i) * 0.6;
      const j = Math.min(NZ - 1, Math.floor((fz - z) * NZ));
      if (isCut(j)) continue;
      dab(b, fx, y + wheatTop(s.seed, fx, fz) * growth + 0.02, fz, 0.04);
    }
  });
}

/** A scarecrow: a post, a crossbar in a coat, a sack of a head and a hat. Stands a little crooked, head and shoulders above the wheat. */
export function scarecrow(b: MeshBuilder, x: number, y: number, z: number, r: Rng): void {
  const k = 1.4;
  const lean = (r('lean') - 0.5) * 0.1;
  const along = r('turn') < 0.5;
  const ax = along ? 1 : 0, az = along ? 0 : 1;
  const topX = x + lean * 0.6;
  const at = (h: number): number => y + h * k;
  b.with({ color: PALETTE.wood, pattern: PATTERN.bark, ink: 'scarecrow-post' }, () => {
    tube(b, [[x, y, z], [topX, at(0.62), z]], 0.022, { seg: 5 });
    tube(b, [[topX - ax * 0.3, at(0.46), z - az * 0.3], [topX + ax * 0.3, at(0.49), z + az * 0.3]], 0.018, { seg: 5, capEnd: true, capStart: true });
  });
  const coat = [PALETTE.red, PALETTE.glass, PALETTE.brick][Math.floor(r('coat') * 3)]!;
  b.with({ color: coat, pattern: PATTERN.cloth, ink: 'scarecrow-coat', sway: 0.25 }, () => {
    b.box([topX - 0.09 - ax * 0.03, at(0.24), z - 0.09 - az * 0.03], [topX + 0.09 + ax * 0.03, at(0.5), z + 0.09 + az * 0.03]);
    b.box([topX - ax * 0.26 - 0.045, at(0.4), z - az * 0.26 - 0.045], [topX + ax * 0.26 + 0.045, at(0.5) + 0.002, z + az * 0.26 + 0.045]);
  });
  b.with({ color: PALETTE.sand, ink: 'scarecrow-head' }, () => lump(b, topX, at(0.575), z, 0.08, 0.085, 0.08, { seg: 7, rings: 4 }));
  b.with({ color: PALETTE.trunk, ink: 'scarecrow-hat' }, () => {
    lump(b, topX, at(0.635), z, 0.135, 0.016, 0.135, { seg: 8, rings: 2 });
    mound(b, topX, at(0.635), z, 0.07, 0.09, 0.07, { seg: 7, rings: 2 });
  });
}

// ─────────────────────────────────────────────────────────── herb garden ──

const HERBS: readonly { leaf: string; flower?: string }[] = [
  { leaf: PALETTE.leafDark, flower: PALETTE.magic }, // lavender
  { leaf: PALETTE.bush }, //                            sage
  { leaf: PALETTE.leaf, flower: PALETTE.white }, //     chamomile
  { leaf: PALETTE.leafDark, flower: PALETTE.yellow }, // tansy
  { leaf: PALETTE.leaf, flower: PALETTE.pink }, //      thyme in flower
];

/** A courtyard's herb garden: four small clipped beds to a cell on gravel, each a different herb. */
export function herbGarden(c: GardenCtx, cell: CellKey): void {
  const { b, s } = c;
  ground(c, cell, PALETTE.path, PATTERN.sand);
  if (occupied(c, cell)) return;
  const x = keyX(cell), z = keyZ(cell), y = groundY(cell);
  const r = cellRng(s, cell);
  for (let q = 0; q < 4; q++) {
    const qx = x + (q % 2 === 0 ? 0.27 : 0.73), qz = z + (q < 2 ? 0.27 : 0.73);
    const herb = HERBS[Math.floor(r('herb', q) * HERBS.length)]!;
    const half = 0.17, h = 0.1 + r('h', q) * 0.05;
    const leaf = vary(herb.leaf, r('lc', q), 0.7);
    // A clipped box of green: its own outline, tone stepped by the renderer like any block.
    b.with({ color: leaf, pattern: PATTERN.leaves, ink: `herb${cell}:${q}` }, () => b.box([qx - half, y, qz - half], [qx + half, y + h, qz + half], { skip: ['bottom'] }));
    if (herb.flower) {
      b.with({ color: herb.flower, pattern: PATTERN.none, ink: `herb${cell}:${q}` }, () => {
        for (let i = 0; i < 4; i++) dab(b, qx + (r('fx', q, i) - 0.5) * 0.24, y + h + 0.001, qz + (r('fz', q, i) - 0.5) * 0.24, 0.034, TONE.up, 5, 0.03);
      });
    }
  }
}

/** A sundial on a stone pedestal, for the middle of a herb garden. */
export function sundial(b: MeshBuilder, x: number, y: number, z: number): void {
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'sundial' }, () => {
    b.boxAt([x, y, z], [0.12, 0.05, 0.12], { skip: ['bottom'] });
    b.at(translation(x, y + 0.05, z), () => b.lathe([[0.045, 0], [0.035, 0.2], [0.09, 0.24], [0.09, 0.27]], { segments: 8, capTop: true }));
  });
  b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'gnomon' }, () => b.tri([x - 0.06, y + 0.322, z], [x + 0.06, y + 0.322, z], [x + 0.06, y + 0.4, z]).tri([x + 0.06, y + 0.322, z + 0.006], [x - 0.06, y + 0.322, z + 0.006], [x + 0.06, y + 0.4, z + 0.006]));
}

// ────────────────────────────────────────────────────────────── reed bed ──

/** By the water: wet ground, pools, stands of reeds and cattails, and flag irises. */
export function reedBed(c: GardenCtx, cell: CellKey): void {
  const { b, s } = c;
  ground(c, cell, mixColor(PALETTE.garden, PALETTE.dirt, 0.3), PATTERN.dirt);
  const x = keyX(cell), z = keyZ(cell), y = groundY(cell);
  const r = cellRng(s, cell);
  const busy = occupied(c, cell);
  // A pool or two of standing water.
  const pools = busy ? 0 : 1 + Math.floor(r('pools') * 2);
  const taken: Pt[] = [];
  for (let i = 0; i < pools; i++) {
    const cx = x + 0.3 + r('px', i) * 0.4, cz = z + 0.3 + r('pz', i) * 0.4, rx = 0.14 + r('prx', i) * 0.1, rz = 0.1 + r('prz', i) * 0.08;
    const pts: Pt[] = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, wob = 0.85 + r('pw', i, k) * 0.3;
      pts.push([cx + Math.cos(a) * rx * wob, cz + Math.sin(a) * rz * wob]);
    }
    b.with({ color: PALETTE.shallow, pattern: PATTERN.water, ink: 'pool', edge: EDGE_FAR }, () => fan(b, [cx, cz], pts, y + 0.004, true));
    taken.push([cx, cz]);
  }
  const clear = (px: number, pz: number): boolean => taken.every(([tx, tz]) => Math.hypot(px - tx, pz - tz) > 0.2) && (!busy || Math.hypot(px - x - 0.5, pz - z - 0.5) > 0.3);
  const reed = mixColor(PALETTE.leafDark, PALETTE.bush, 0.5);
  b.setInk(`reeds${cell}`);
  // Stands of reeds: each a few tall, narrow tongues of leaf from one foot, drawn as one clump in two
  // tones (bold enough to read at playing zoom; single blades turn to ink). Their tips ride the wind.
  for (let i = 0; i < 3; i++) {
    const fx = x + 0.16 + r('rx', i) * 0.68, fz = z + 0.16 + r('rz', i) * 0.68;
    if (!clear(fx, fz)) continue;
    const tall = 0.32 + r('rh', i) * 0.16;
    const sway: SwayInput = (_x, yy) => Math.max(0, Math.min(1, (yy - y) / tall)) * 0.7;
    b.with({ color: vary(reed, r('rc', i), 0.8), pattern: PATTERN.none, sway }, () => {
      for (let k = 0; k < 3; k++) {
        const a = r('ra', i) * 6.28 + k * 2.1, out = 0.035 + r('ro', i, k) * 0.02, h = tall * (k === 0 ? 1 : 0.62 + r('rk', i, k) * 0.25);
        lump(b, fx + Math.cos(a) * out, y + h * 0.5, fz + Math.sin(a) * out, 0.04, h * 0.5, 0.04, { seg: 5, rings: 3, normal: k === 1 ? TONE.mid : TONE.lit, twist: a });
      }
    });
    // A cattail in most stands: a brown head standing clear of the leaves.
    if (r('cat', i) < 0.75) {
      const hx = fx + (r('cx', i) - 0.5) * 0.05, hz = fz + (r('cz', i) - 0.5) * 0.05, hy = y + tall + 0.07;
      b.with({ color: PALETTE.trunk, pattern: PATTERN.none, sway }, () => {
        tube(b, [[hx, y + tall * 0.6, hz], [hx, hy, hz]], 0.008, { seg: 3 });
        lump(b, hx, hy, hz, 0.028, 0.065, 0.028, { seg: 5, rings: 3, normal: TONE.lit });
      });
    }
  }
  // Flag irises: a fan of leaves and a head of purple or yellow.
  for (let i = 0; i < 2; i++) {
    const fx = x + 0.15 + r('ix', i) * 0.7, fz = z + 0.15 + r('iz', i) * 0.7;
    if (!clear(fx, fz)) continue;
    const h = 0.16 + r('ih', i) * 0.07;
    b.with({ color: PALETTE.leaf, pattern: PATTERN.none, sway: 0.2 }, () => mound(b, fx, y, fz, 0.06, h * 0.85, 0.06, { seg: 5, rings: 2, normal: TONE.mid }));
    b.with({ color: r('ic', i) < 0.65 ? PALETTE.magic : PALETTE.yellow, pattern: PATTERN.none, sway: 0.3 }, () => lump(b, fx, y + h, fz, 0.05, 0.05, 0.05, { seg: 5, rings: 3, normal: TONE.lit }));
  }
}

// ───────────────────────────────────────────────────────────── park lawn ──

/** A park: mown lawn inside a clipped hedge, which opens where a path arrives. */
export function parkLawn(c: GardenCtx, cell: CellKey): void {
  const { b, s } = c;
  ground(c, cell, PALETTE.garden, PATTERN.grass);
  const x = keyX(cell), z = keyZ(cell), y = groundY(cell);
  const here = inRegion(c, cell);
  const link = c.links.get(cell);
  const hw = FLOOR.hedgeWidth, hh = FLOOR.hedgeHeight, off = 0.035;
  const color = vary(PALETTE.leafDark, rngOf(s.seed)('hedge'), 0.6);
  // Mown stripes: every other row of cells a shade lighter (colour only, no line).
  const stripe = rngOf(s.seed)('stripe') < 0.5;
  const band = stripe ? Math.floor(x) % 2 === 0 : Math.floor(z) % 2 === 0;
  if (band) {
    const a = DIRS.map((d) => (here(d) ? 0 : FLOOR.gardenRound + 0.02));
    b.with({ color: mixColor(PALETTE.garden, PALETTE.white, 0.16), pattern: PATTERN.grass, ink: 'ground' }, () =>
      b.quad([x + a[3]!, y + 0.002, z + 1 - a[2]!], [x + 1 - a[1]!, y + 0.002, z + 1 - a[2]!], [x + 1 - a[1]!, y + 0.002, z + a[0]!], [x + a[3]!, y + 0.002, z + a[0]!]),
    );
  }
  const balls: Pt[] = [];
  b.with({ color, pattern: PATTERN.leaves, ink: 'hedge' }, () => {
    for (const d of DIRS) {
      if (here(d)) continue;
      const [dx, dz] = SIDE[d]!;
      const tx = -dz, tz = dx;
      const cx = x + 0.5, cz = z + 0.5;
      const leftSide = ((d + 3) % 4) as Dir4, rightSide = ((d + 1) % 4) as Dir4;
      // Where the next side is hedged too, the corner belongs to the north and south hedges.
      const mine = d === 0 || d === 2;
      // Where the region turns an inner corner the hedge runs on past the cell to meet the one coming the other way.
      const joinsLeft = here(leftSide) && !c.cells.has(neighbor(neighbor(cell, leftSide), d));
      const joinsRight = here(rightSide) && !c.cells.has(neighbor(neighbor(cell, rightSide), d));
      const a = -0.5 + (here(leftSide) ? (joinsLeft ? 0 : -(off + hw)) : mine ? off : off + hw);
      const e = 0.5 - (here(rightSide) ? (joinsRight ? 0 : -(off + hw)) : mine ? off : off + hw);
      const piece = (from: number, to: number, capFrom: boolean, capTo: boolean): void => {
        if (to - from < 0.02) return;
        const p0: Pt = [cx + tx * from + dx * (0.5 - off - hw), cz + tz * from + dz * (0.5 - off - hw)];
        const p1: Pt = [cx + tx * to + dx * (0.5 - off), cz + tz * to + dz * (0.5 - off)];
        const lo: Vec3 = [Math.min(p0[0], p1[0]), y, Math.min(p0[1], p1[1])], hi: Vec3 = [Math.max(p0[0], p1[0]), y + hh, Math.max(p0[1], p1[1])];
        // Leave out the end faces that meet the next cell's stretch of the same hedge.
        const ends: ('n' | 'e' | 's' | 'w')[] = [];
        const faceAt = (sign: number): 'n' | 'e' | 's' | 'w' => (tx * sign > 0.5 ? 'e' : tx * sign < -0.5 ? 'w' : tz * sign > 0.5 ? 's' : 'n');
        if (!capFrom) ends.push(faceAt(-1));
        if (!capTo) ends.push(faceAt(1));
        b.box(lo, hi, { skip: ['bottom', ...ends] });
      };
      if (link?.get(d) === 'path') {
        // A gap for the path, with the hedge finished square either side.
        const gap = 0.5 - FLOOR.pathMargin + 0.04;
        piece(a, -gap, !joinsLeft, true);
        piece(gap, e, true, !joinsRight);
        balls.push([cx + tx * -(gap + 0.07) + dx * (0.5 - off - hw / 2), cz + tz * -(gap + 0.07) + dz * (0.5 - off - hw / 2)]);
        balls.push([cx + tx * (gap + 0.07) + dx * (0.5 - off - hw / 2), cz + tz * (gap + 0.07) + dz * (0.5 - off - hw / 2)]);
      } else {
        piece(a, e, !joinsLeft, !joinsRight);
      }
      // Each outer corner of the hedge is clipped into a ball (the north and south hedges own the corners).
      if (mine) {
        if (!here(leftSide)) balls.push([cx + tx * -(0.5 - off - hw / 2) + dx * (0.5 - off - hw / 2), cz + tz * -(0.5 - off - hw / 2) + dz * (0.5 - off - hw / 2)]);
        if (!here(rightSide)) balls.push([cx + tx * (0.5 - off - hw / 2) + dx * (0.5 - off - hw / 2), cz + tz * (0.5 - off - hw / 2) + dz * (0.5 - off - hw / 2)]);
      }
    }
  });
  for (const [bx, bz] of balls) {
    const rad = hw * 0.78, by = y + hh + rad * 0.45;
    b.with({ color, pattern: PATTERN.leaves, ink: 'topiary' }, () => lump(b, bx, by, bz, rad, rad * 0.95, rad, { seg: 8, rings: 4, normal: TONE.lit, facing: [0, 1, 0], cut: -0.55 }));
    b.with({ color: mixColor(color, PALETTE.leafDark, 0.25), pattern: PATTERN.leaves, ink: 'topiary' }, () =>
      lump(b, bx + SHADE_SIDE[0] * rad * 0.22, by - rad * 0.2, bz + SHADE_SIDE[1] * rad * 0.22, rad * 0.96, rad * 0.9, rad * 0.96, { seg: 8, rings: 4, normal: TONE.shade, facing: [SHADE_SIDE[0] * 0.6, -0.5, SHADE_SIDE[1] * 0.6], cut: -0.2 }),
    );
  }
  // Daisies in the grass: a few white dabs, not in every cell.
  const r = cellRng(s, cell);
  if (!occupied(c, cell) && r('daisies') < 0.45) {
    b.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'ground' }, () => {
      for (let i = 0; i < 3; i++) dab(b, x + 0.25 + r('dx', i) * 0.5, y + 0.003, z + 0.25 + r('dz', i) * 0.5, 0.028, TONE.up, 5, 0.012);
    });
  }
}

/** A round flower bed in a lawn: a ring of one colour round a taller middle. */
export function roundBed(b: MeshBuilder, x: number, y: number, z: number, seed: number): void {
  const r = rngOf(seed);
  const blooms = bloomsOf(seed);
  const R = 0.34;
  const pts: Pt[] = [];
  for (let i = 0; i < 14; i++) pts.push([x + Math.cos((i / 14) * 6.2832) * R, z + Math.sin((i / 14) * 6.2832) * R]);
  b.with({ color: PALETTE.dirtDark, pattern: PATTERN.dirt, ink: 'round-bed' }, () => fan(b, [x, z], pts, y + 0.004, true));
  b.setInk('round-bed-plants');
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.2832 + r('a') * 6;
    bloom(b, x + Math.cos(a) * R * 0.66, y, z + Math.sin(a) * R * 0.66, 0.07, 0.07 + r('h', i) * 0.03, blooms[0]!, PALETTE.leafDark);
  }
  bloom(b, x, y, z, 0.1, 0.15, blooms[1]!, PALETTE.leafDark);
}

/** R-G02: a churchyard's mown grass: the lawn, with every other row of cells a shade lighter (no hedge). */
export function churchyardLawn(c: GardenCtx, cell: CellKey): void {
  const { b } = c;
  ground(c, cell, PALETTE.garden, PATTERN.grass);
  const x = keyX(cell), z = keyZ(cell), y = groundY(cell);
  const here = inRegion(c, cell);
  if (Math.floor(z) % 2 === 0) {
    const a = DIRS.map((d) => (here(d) ? 0 : FLOOR.gardenRound + 0.02));
    b.with({ color: mixColor(PALETTE.garden, PALETTE.white, 0.12), pattern: PATTERN.grass, ink: 'ground' }, () =>
      b.quad([x + a[3]!, y + 0.002, z + 1 - a[2]!], [x + 1 - a[1]!, y + 0.002, z + 1 - a[2]!], [x + 1 - a[1]!, y + 0.002, z + a[0]!], [x + a[3]!, y + 0.002, z + a[0]!]),
    );
  }
}
