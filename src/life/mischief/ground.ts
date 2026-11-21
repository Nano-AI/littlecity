// What a thrown body (thrown.ts) lands on and bounces off (design section
// 13b, "blown about"). Owner: Mischief. Pure.
//
// Per column of the map, the solid things in it as spans of height: the
// terrain (or the sea, where the terrain is at 0), and the blocks a body
// cannot pass through (buildings, towers, marble, docks, walls, arches,
// stairs, stalls and fountains), each with the roof over a building's top
// storey as a low pyramid on the cell (so a body landing on a roof lies on
// a slope, and slides off it). A building flattened by a blast is a low
// heap; trees and flower beds are flown through. Off the map is the sea.

import { CELL_H, columnIndex, key, keyX, keyY, keyZ, SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { NavGraph, ShapePlan } from '@/resolve/plan';
import { ruinStage } from '@/world/damage';

const SOLID: ReadonlySet<Kind> = new Set<Kind>(['house', 'tower', 'lighthouse', 'marble', 'pillar', 'windmill', 'dock', 'wall', 'arch', 'stairs', 'stall', 'fountain']);
/** How high a building's roof rises over its top storey at the middle of the cell (world units). */
const ROOF: Partial<Record<Kind, number>> = { house: 0.55, tower: 0.7, lighthouse: 0.5, windmill: 0.5 };

export interface Surface {
  /** The height of the top (world units). */
  h: number;
  /** It is the sea (or a pond): a body splashes in. */
  water: boolean;
  /** A roof (a body slides off it). */
  roof: boolean;
}

export interface Ground {
  /** The top of the highest solid thing in the column at (x, z) that is at or below `below` (the sea where nothing is). */
  surface(x: number, z: number, below: number, out?: Surface): Surface;
  /** Is (x, y, z) inside something solid (the terrain, a building, a roof)? Off the map nothing is. */
  blocked(x: number, y: number, z: number): boolean;
  /** The lowest height at or above `y` in the column at (x, z) that is not inside anything (out of the ground, over a heap). */
  freeAbove(x: number, y: number, z: number): number;
  /** Is the column at (x, z) open water at the sea's level (or off the map)? */
  wet(x: number, z: number): boolean;
}

/** One solid span of a column: [bottom, top) and the roof's rise over the top (0: flat). */
type Span = [number, number, number];

export function createGround(shape: ShapePlan, nav: NavGraph | null): Ground {
  const N = SIZE_X * SIZE_Z;
  const land = new Float32Array(N);
  const spans: (Span[] | null)[] = new Array<Span[] | null>(N).fill(null);
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) land[x + z * SIZE_X] = shape.terrain.height[columnIndex(x, z)]! * CELL_H;
  for (const [c, k] of shape.kinds) {
    if (!SOLID.has(k)) continue;
    // Somewhere people walk (stairs, a stall's or a fountain's cell): its floor is what the walking graph says.
    if (nav?.nodeAt.has(c)) continue;
    const x = keyX(c), y = keyY(c), z = keyZ(c);
    if (x < 0 || z < 0 || x >= SIZE_X || z >= SIZE_Z) continue;
    const stage = ruinStage(shape.world.blocks.get(c)?.ruin);
    const bottom = y * CELL_H;
    let top = bottom + CELL_H;
    if (stage >= 3) top = bottom + 0.2;
    else if (k === 'stairs') top = bottom + CELL_H * 0.5;
    else if (k === 'stall' || k === 'fountain') top = bottom + 0.45;
    let rise = 0;
    const r = ROOF[k];
    if (r !== undefined && stage < 2 && shape.kinds.get(key(x, y + 1, z)) !== k && !nav?.nodeAt.has(key(x, y + 1, z))) rise = r;
    const i = x + z * SIZE_X;
    (spans[i] ??= []).push([bottom, top, rise]);
  }
  for (const l of spans) l?.sort((a, b) => a[0] - b[0]);

  const roofAt = (x: number, z: number, rise: number): number => {
    if (rise === 0) return 0;
    const fx = x - Math.floor(x) - 0.5, fz = z - Math.floor(z) - 0.5;
    return rise * Math.max(0, 1 - 2 * Math.max(Math.abs(fx), Math.abs(fz)));
  };
  const inMap = (cx: number, cz: number): boolean => cx >= 0 && cz >= 0 && cx < SIZE_X && cz < SIZE_Z;

  const ground: Ground = {
    surface(x, z, below, out = { h: 0, water: false, roof: false }) {
      const cx = Math.floor(x), cz = Math.floor(z);
      out.h = SEA_Y;
      out.water = true;
      out.roof = false;
      if (!inMap(cx, cz)) return out;
      const i = cx + cz * SIZE_X;
      const t = land[i]!;
      if (t > 0 && t <= below + 1e-3) {
        out.h = t;
        out.water = false;
      } else if (t > 0) {
        // Under the ground (a body pushed into a cliff): its top.
        out.h = t;
        out.water = false;
      }
      const list = spans[i];
      if (list) {
        for (const s of list) {
          const top = s[1] + roofAt(x, z, s[2]);
          if (top > below + 1e-3 || top < out.h) continue;
          out.h = top;
          out.water = false;
          out.roof = s[2] > 0;
        }
      }
      return out;
    },
    blocked(x, y, z) {
      const cx = Math.floor(x), cz = Math.floor(z);
      if (!inMap(cx, cz)) return false;
      const i = cx + cz * SIZE_X;
      if (y < land[i]!) return true;
      const list = spans[i];
      if (!list) return false;
      for (const s of list) if (y >= s[0] && y < s[1] + roofAt(x, z, s[2])) return true;
      return false;
    },
    freeAbove(x, y, z) {
      const cx = Math.floor(x), cz = Math.floor(z);
      if (!inMap(cx, cz)) return y;
      const i = cx + cz * SIZE_X;
      let h = Math.max(y, land[i]!);
      const list = spans[i];
      if (list) for (const s of list) if (h >= s[0] && h < s[1] + roofAt(x, z, s[2])) h = s[1] + roofAt(x, z, s[2]);
      return h;
    },
    wet(x, z) {
      const cx = Math.floor(x), cz = Math.floor(z);
      if (!inMap(cx, cz)) return true;
      const i = cx + cz * SIZE_X;
      return land[i]! <= 0 && !(spans[i]?.some((s) => s[0] <= SEA_Y + 0.05) ?? false);
    },
  };
  return ground;
}
