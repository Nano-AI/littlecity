// What a flying eye may not pass through (fly mode, design section 7). Pure.
//
// Per column of the map, a bit per level for each cell that is in the way:
//
//   solid    buildings, towers, marble, pillars, windmills, docks, the
//            terrain, fence and wall pieces in a cell (not where they are a
//            gate), arches (an open arch only by its piers and the stone over
//            the opening)
//   view     trees (the trunk's level and the crown's above it), stalls,
//            fountains
//
// and besides those: the roof over a building's top storey (a box over the
// cell as high as the tallest roof that kind can have), fences and walls on
// a cell's side (a thin sheet, gates excepted), props standing in a cell
// (lamps, signposts, benches as posts; parasols and awnings only up at their
// canopy), and everything below the sea's surface. People, birds, boats,
// flower beds and the flat things on the ground are flown through.
//
// Ported from the walk experiment (swarm/walk, src/walk/solid.ts) with the
// walking parts (floors, stairs, landing, stepping up) left behind.

import { CELL_H, columnIndex, edgeOf, key, keyX, keyY, keyZ, SEA_Y, SIZE_X, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { DressingPlan, ShapePlan } from '@/resolve/plan';

const SOLID_KINDS: ReadonlySet<Kind> = new Set<Kind>(['house', 'tower', 'lighthouse', 'marble', 'pillar', 'windmill', 'dock', 'fence', 'wall', 'arch']);
/**
 * How high a roof may rise over the top of a building's highest storey, world units (the steepest
 * house roof is about 0.95 over a wide house; a spire 1.5; a windmill's cap and a lighthouse's lantern
 * a little over a storey).
 */
const ROOF_RISE: Partial<Record<Kind, number>> = { house: 1.0, tower: 1.55, lighthouse: 1.3, windmill: 1.1 };
/** Half the thickness of a fence or wall on a cell's side, and how high it stands (a share of a level). */
const SHEET = 0.07;
const SHEET_TALL = 0.95;

interface Post {
  x: number;
  z: number;
  r: number;
  level: number;
}

export interface SolidMap {
  /** Is a world point inside something solid (a building, the ground) or under the sea? */
  inside(x: number, y: number, z: number): boolean;
  /** Is a world point inside anything an eye must not pass through (see the top of this file)? */
  hidden(x: number, y: number, z: number): boolean;
  /** The top of the highest thing in the way, roofs included, world units. */
  readonly top: number;
}

export function createSolidMap(shape: ShapePlan, dressing: DressingPlan | null): SolidMap {
  const { world, terrain, kinds } = shape;
  const N = SIZE_X * SIZE_Z;
  const solidBits = new Uint32Array(N);
  /** Solid as seen from the side: an arch that opens is not (its piers and crown are, below). */
  const openBits = new Uint32Array(N);
  /** Trees (and the level over them), stalls, fountains. */
  const viewBits = new Uint32Array(N);
  /** Roofs: per column, [from, to] in world units. */
  const roofs: [number, number][][] = Array.from({ length: N }, () => []);
  const posts: Post[][] = Array.from({ length: N }, () => []);
  const col = (x: number, z: number): number => x + z * SIZE_X;
  const inMap = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < SIZE_X && z < SIZE_Z;

  const gateCells = new Set<CellKey>();
  const gateEdges = new Set<number>();
  /** Open arches, and the axes they open along: bit 1 north–south, bit 2 east–west. */
  const openArches = new Map<CellKey, number>();
  for (const f of shape.features) {
    if (f.type === 'gate') {
      if (f.cell !== undefined) gateCells.add(f.cell);
      if (f.edge !== undefined) gateEdges.add(f.edge);
    } else if (f.type === 'arch-opening' && f.cell !== undefined) {
      openArches.set(f.cell, (openArches.get(f.cell) ?? 0) | (f.dir === undefined ? 3 : (f.dir & 1) === 0 ? 1 : 2));
    }
  }

  let top = SEA_Y;
  for (let z = 0; z < SIZE_Z; z++) {
    for (let x = 0; x < SIZE_X; x++) {
      const h = terrain.height[columnIndex(x, z)]!;
      if (h > 0) {
        solidBits[col(x, z)]! |= (1 << h) - 1;
        top = Math.max(top, h * CELL_H);
      }
    }
  }
  for (const [c, k] of kinds) {
    const x = keyX(c), y = keyY(c), z = keyZ(c);
    if (!inMap(x, z) || y >= 31) continue;
    const i = col(x, z);
    if (k === 'tree') viewBits[i]! |= (3 << y) >>> 0;
    else if (k === 'fountain' || k === 'stall') viewBits[i]! |= 1 << y;
    if (!SOLID_KINDS.has(k) || gateCells.has(c)) continue;
    solidBits[i]! |= 1 << y;
    if (k === 'arch' && openArches.has(c)) openBits[i]! |= 1 << y;
    top = Math.max(top, (y + 1) * CELL_H);
  }
  // Roofs: over every building cell with nothing of its own kind on top.
  for (const [c, k] of kinds) {
    const rise = ROOF_RISE[k];
    if (rise === undefined) continue;
    const x = keyX(c), y = keyY(c), z = keyZ(c);
    if (!inMap(x, z) || kinds.get(key(x, y + 1, z)) === k) continue;
    const from = (y + 1) * CELL_H;
    roofs[col(x, z)]!.push([from, from + rise]);
    top = Math.max(top, from + rise);
  }
  // Props standing in a cell (lamps, signposts, benches, carts): posts, or canopies up high.
  const FLAT = /tuft|beach-find|worn-track|dirt-trail|reeds|lily|creeper|doorstep|bunting|line|laundry/;
  const SLOT: Record<string, [number, number]> = { c: [0.5, 0.5], n: [0.5, 0.1], e: [0.9, 0.5], s: [0.5, 0.9], w: [0.1, 0.5], ne: [0.9, 0.1], se: [0.9, 0.9], sw: [0.1, 0.9], nw: [0.1, 0.1] };
  for (const pr of dressing?.props ?? []) {
    if (!('cell' in pr.at) || FLAT.test(pr.type)) continue;
    const c = pr.at.cell, x = keyX(c), z = keyZ(c);
    const at = SLOT[pr.at.pos];
    if (!inMap(x, z) || !at) continue;
    const wide = /parasol|umbrella|table|cafe|awning|canopy|kiosk|cart|market|stall|tent|terrace-set/.test(pr.type);
    posts[col(x, z)]!.push({ x: x + at[0], z: z + at[1], r: wide ? 0.5 : 0.16, level: keyY(c) });
  }

  const hard = (i: number, level: number): boolean => level >= 0 && level < 32 && (solidBits[i]! & ~openBits[i]! & (1 << level)) !== 0;
  /** Is side d of this open arch one of its piers (the sides it does not open through)? */
  const archSide = (c: CellKey, d: Dir4): boolean => {
    const axes = openArches.get(c);
    if (axes === undefined || kinds.get(c) !== 'arch') return false;
    return (axes & ((d & 1) === 0 ? 1 : 2)) === 0;
  };
  /** A fence or wall standing on side d of the cell (gates excepted). */
  const sheet = (c: CellKey, d: Dir4): boolean => {
    const e = edgeOf(c, d);
    return e >= 0 && world.edges.has(e) && !gateEdges.has(e);
  };

  const map: SolidMap = {
    top,
    inside(x, y, z) {
      if (y < SEA_Y) return true;
      const cx = Math.floor(x), cz = Math.floor(z);
      if (!inMap(cx, cz)) return false;
      return hard(col(cx, cz), Math.floor(y / CELL_H));
    },
    hidden(x, y, z) {
      if (map.inside(x, y, z)) return true;
      const cx = Math.floor(x), cz = Math.floor(z), level = Math.floor(y / CELL_H);
      if (!inMap(cx, cz) || level < 0 || level >= 32) return false;
      const i = col(cx, cz);
      if ((viewBits[i]! & (1 << level)) !== 0) return true;
      for (const [from, to] of roofs[i]!) if (y >= from && y < to) return true;
      const c = key(cx, level, cz);
      const fx = x - cx, fz = z - cz, fy = y / CELL_H - level;
      // Inside an open arch: its piers, and the stone over the opening, are in the way.
      if (openArches.has(c) && kinds.get(c) === 'arch') {
        if (fy > 0.7) return true;
        if (archSide(c, 1) && fx > 0.82) return true;
        if (archSide(c, 3) && fx < 0.18) return true;
        if (archSide(c, 2) && fz > 0.82) return true;
        if (archSide(c, 0) && fz < 0.18) return true;
      }
      // Fences and walls on the cell's sides.
      if (fy < SHEET_TALL) {
        if (fz < SHEET && sheet(c, 0)) return true;
        if (fx > 1 - SHEET && sheet(c, 1)) return true;
        if (fz > 1 - SHEET && sheet(c, 2)) return true;
        if (fx < SHEET && sheet(c, 3)) return true;
      }
      // A post is in the way at any height; a wide thing (a parasol, an awning) only up at its canopy.
      for (const q of posts[i]!) if (q.level === level && (q.r < 0.3 || fy > 0.66) && Math.hypot(x - q.x, z - q.z) < q.r) return true;
      return false;
    },
  };
  return map;
}
