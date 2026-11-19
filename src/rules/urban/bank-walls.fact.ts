// Bank walls: every stretch of terrain bank that U07 faces with a retaining
// wall. A fact, not just U07's own find(), because other rules must know
// where the walls will stand before U07 runs (decoration runs first): a lamp
// must not take the slot a wall needs.
//
// A bank edge is the border between a LOW ground cell and a higher column
// beside it. It gets a wall when a street or a plaza lies on either side of
// it at ground level (the street at the foot of the bank, or the street
// along its top), the rise is 1 to DRESSING.wallMaxRise levels, and nothing
// stands in the way: no block in the low cell, no carved steps on the edge,
// no beach.
//
// The terrain rounds the corners of its terraces (src/gen/terrain), so each
// piece also records how its two ends finish and the corner radius there,
// worked out by the terrain's own rule. The wall part follows that outline.

import { columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import { MAT } from '@/core/world';
import { defineFact, type Facts } from '@/resolve/facts/api';
import { DIRS } from '@/resolve/facts/lib';
import { DRESSING } from '@/style/dressing';
import { TERRAIN } from '@/style/terrain';

/** How one end of a wall piece finishes (the vocabulary's `retaining-wall.from` / `.to`). */
export const WALL_END = {
  /** Runs straight on into the next piece. */
  on: 0,
  /** Ends in a pier at the cell line: the bank goes on without a wall, or the ground does something odd. */
  pier: 1,
  /** Follows half of the terrace's rounded outer corner, to meet the wall round the corner. */
  outHalf: 2,
  /** Follows half of an inner corner's fillet, to meet the wall of the bank that turns toward it. */
  inHalf: 3,
  /** Follows the whole outer corner and ends in a pier: the wall returns into the hillside. */
  outFull: 4,
  /** Follows the whole inner fillet and ends in a pier. */
  inFull: 5,
} as const;

export interface BankWall {
  /** The ground cell at the foot of the bank. */
  low: CellKey;
  /** The side of `low` the bank is on. */
  dir: Dir4;
  /** Levels from the foot to the top. */
  rise: number;
  /** End codes (WALL_END) at the −X and +X ends of the piece's frame, and the corner radius there. */
  from: number;
  to: number;
  r0: number;
  r1: number;
}

export interface BankWalls {
  list: readonly BankWall[];
  at(low: CellKey, dir: Dir4): BankWall | undefined;
  /** The sides of a low cell that carry a wall. */
  sides(low: CellKey): readonly Dir4[];
}

/** The +X direction of a wall piece's frame: the frame faces away from the bank. */
export const wallRight = (dir: Dir4): Dir4 => turn(opposite(dir), 3);

function heightAt(f: Facts, x: number, z: number): number {
  return inColumnBounds(x, z) ? f.terrain.height[columnIndex(x, z)]! : 0;
}

/** The terrain's own rule for squaring a corner (src/gen/terrain/terrain.gen.ts, mustSquare). */
function mustSquare(f: Facts, x: number, z: number, level: number): boolean {
  if (!inColumnBounds(x, z)) return false;
  const here = heightAt(f, x, z);
  const w = f.world;
  if (here === level) return w.blocks.has(key(x, level, z)) || w.floors.has(key(x, level, z));
  if (here < level) {
    for (let y = here; y < level; y++) if (w.blocks.has(key(x, y, z))) return true;
  }
  return false;
}

/** Corner radius of the level-`level` terrace outline at grid vertex (vx, vz), as the terrain draws it. */
export function terraceRadius(f: Facts, vx: number, vz: number, level: number): number {
  if (mustSquare(f, vx - 1, vz - 1, level) || mustSquare(f, vx, vz - 1, level) || mustSquare(f, vx - 1, vz, level) || mustSquare(f, vx, vz, level)) {
    return Math.min(TERRAIN.radiusBuilt, TERRAIN.radius);
  }
  return Math.min(0.5, Math.max(0.05, TERRAIN.radius - TERRAIN.radiusVary * rand(f.terrain.seed, 'r', vx, vz)));
}

export const bankWalls = defineFact<BankWalls>('bankWalls', (f) => {
  const floors = f.world.floors;
  const paved = (c: CellKey): boolean => {
    const k = floors.get(c);
    return k === 'path' || k === 'plaza';
  };
  const steps = new Set<number>();
  for (const ft of f.shape.features) {
    if (ft.type === 'terrain-steps' && ft.cell !== undefined && ft.dir !== undefined) steps.add(ft.cell * 4 + ft.dir);
  }
  const maxRise = DRESSING.wallMaxRise;
  const index = new Map<number, BankWall>();
  const wanted = (low: CellKey, dir: Dir4): number => {
    // Returns the rise if this bank edge gets a wall, else 0.
    const x = keyX(low), yl = keyY(low), z = keyZ(low);
    if (yl < 1 || heightAt(f, x, z) !== yl) return 0;
    const hx = x + DIR4[dir]![0], hz = z + DIR4[dir]![1];
    if (!inColumnBounds(hx, hz)) return 0;
    const yh = heightAt(f, hx, hz);
    const rise = yh - yl;
    if (rise < 1 || rise > maxRise) return 0;
    if (f.terrain.material[columnIndex(hx, hz)] === MAT.sand) return 0;
    if (f.kinds.has(low) || steps.has(low * 4 + dir)) return 0;
    if (!paved(low) && !paved(key(hx, yh, hz))) return 0;
    return rise;
  };

  const lows = new Set<CellKey>();
  for (const [c, k] of floors) {
    if (k !== 'path' && k !== 'plaza') continue;
    const x = keyX(c), y = keyY(c), z = keyZ(c);
    if (heightAt(f, x, z) !== y) continue; // a floor on a roof or a deck
    lows.add(c);
    for (const d of DIRS) {
      const nx = x + DIR4[d]![0], nz = z + DIR4[d]![1];
      const h = heightAt(f, nx, nz);
      if (h >= 1 && h < y) lows.add(key(nx, h, nz));
    }
  }

  const list: BankWall[] = [];
  for (const low of [...lows].sort((a, b) => a - b)) {
    const x = keyX(low), yl = keyY(low), z = keyZ(low);
    for (const dir of DIRS) {
      const rise = wanted(low, dir);
      if (!rise) continue;
      const yh = yl + rise;
      const [dx, dz] = DIR4[dir]!;
      const end = (t: Dir4): { code: number; r: number } => {
        const [tx, tz] = DIR4[t]!;
        // The grid vertex at this end of the edge.
        const vx = x + (dx > 0 || tx > 0 ? 1 : 0), vz = z + (dz > 0 || tz > 0 ? 1 : 0);
        const r = terraceRadius(f, vx, vz, yh);
        const hl = heightAt(f, x + tx, z + tz), hh = heightAt(f, x + dx + tx, z + dz + tz);
        // A column between the foot and the top makes two outlines here: finish plainly.
        const mixed = (h: number): boolean => h > yl && h < yh;
        if (mixed(hl) || mixed(hh)) return { code: WALL_END.pier, r };
        const inL = hl >= yh, inH = hh >= yh;
        if (inH && !inL) {
          const next = key(x + tx, yl, z + tz);
          return { code: heightAt(f, x + tx, z + tz) === yl && wanted(next, dir) === rise ? WALL_END.on : WALL_END.pier, r };
        }
        if (!inH && !inL) {
          // An outer corner of the terrace: the bank turns away round the high cell.
          const round = key(x + dx + tx, heightAt(f, x + dx + tx, z + dz + tz), z + dz + tz);
          const meets = heightAt(f, x + dx + tx, z + dz + tz) === yl && wanted(round, opposite(t)) === rise;
          return { code: meets ? WALL_END.outHalf : WALL_END.outFull, r };
        }
        if (inH && inL) {
          // An inner corner: the bank turns toward the low cell.
          return { code: wanted(low, t) === rise ? WALL_END.inHalf : WALL_END.inFull, r };
        }
        return { code: WALL_END.pier, r };
      };
      const right = wallRight(dir);
      const a = end(opposite(right)), b = end(right);
      const wall: BankWall = { low, dir, rise, from: a.code, to: b.code, r0: a.r, r1: b.r };
      list.push(wall);
      index.set(low * 4 + dir, wall);
    }
  }
  return {
    list,
    at: (low, dir) => index.get(low * 4 + dir),
    sides: (low) => DIRS.filter((d) => index.has(low * 4 + d)),
  };
});
