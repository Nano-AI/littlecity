// Targeting (design section 7). Owner: Interface.
//
// The pointer picks a face of terrain, a block or the water surface; the
// target cell is the cell on the other side of that face. Pure: a voxel walk
// along the ray, no renderer needed. Every block fills its whole cell here,
// whatever it is drawn as, so a click always lands on the grid the player
// is building on.
//
// Fences and walls read the top face more finely: faceZone() says whether
// the point lies in the centre (a cell piece) or in one of the four edge
// strips (an edge piece on that boundary).

import { CELL_H, columnIndex, E, inBounds, key, keyX, keyZ, N, NO_CELL, S, SEA_Y, SIZE_X, SIZE_Y, SIZE_Z, W, type CellKey, type Dir4 } from '@/core/grid';
import { INPUT } from '@/style/input';
import type { Vec3 } from '@/core/mat4';
import type { Terrain, World } from '@/core/world';

export interface Pick {
  /** What was hit. */
  hit: 'terrain' | 'block' | 'water';
  /** The cell that was hit (a terrain cell, a block's cell, or the water cell at y = 0). */
  cell: CellKey;
  /** Outward normal of the face that was hit, in grid axes: one of ±x, ±y, ±z. */
  normal: readonly [number, number, number];
  /** The cell on the other side of that face (for water: the water cell itself), or NO_CELL outside the grid. */
  target: CellKey;
  /** The block that was clicked, for Edit.placeBlock.from; null for terrain and water. */
  from: CellKey | null;
  /** World-space point of the hit. */
  point: Vec3;
}

export function pickCell(ray: { origin: Vec3; dir: Vec3 }, world: World, terrain: Terrain): Pick | null {
  // Work in grid space: y is measured in levels.
  const o: [number, number, number] = [ray.origin[0], ray.origin[1] / CELL_H, ray.origin[2]];
  const d: [number, number, number] = [ray.dir[0], ray.dir[1] / CELL_H, ray.dir[2]];
  const size = [SIZE_X, SIZE_Y, SIZE_Z];

  // Clip the ray to the grid's box.
  let t0 = 0;
  let t1 = Infinity;
  let enterAxis = -1;
  for (let a = 0; a < 3; a++) {
    if (d[a] === 0) {
      if (o[a]! < 0 || o[a]! > size[a]!) return null;
      continue;
    }
    let near = (0 - o[a]!) / d[a]!;
    let far = (size[a]! - o[a]!) / d[a]!;
    if (near > far) [near, far] = [far, near];
    if (near > t0) {
      t0 = near;
      enterAxis = a;
    }
    t1 = Math.min(t1, far);
  }
  if (t0 > t1) return null;

  const at = (t: number): [number, number, number] => [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
  const start = at(t0 + 1e-6);
  const cell = [
    Math.min(SIZE_X - 1, Math.max(0, Math.floor(start[0]))),
    Math.min(SIZE_Y - 1, Math.max(0, Math.floor(start[1]))),
    Math.min(SIZE_Z - 1, Math.max(0, Math.floor(start[2]))),
  ];
  const step = d.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
  const tDelta = d.map((v) => (v === 0 ? Infinity : Math.abs(1 / v)));
  const tMax = d.map((v, a) => {
    if (v === 0) return Infinity;
    const edge = v > 0 ? cell[a]! + 1 : cell[a]!;
    return (edge - o[a]!) / v;
  });
  let lastAxis = enterAxis;
  let t = t0;

  const result = (hit: Pick['hit'], tHit: number): Pick => {
    const normal: [number, number, number] = [0, 0, 0];
    if (lastAxis >= 0) normal[lastAxis] = -step[lastAxis]!;
    else normal[1] = 1;
    const k = key(cell[0]!, cell[1]!, cell[2]!);
    const tx = cell[0]! + normal[0], ty = cell[1]! + normal[1], tz = cell[2]! + normal[2];
    const p = at(tHit);
    return {
      hit,
      cell: k,
      normal,
      target: hit === 'water' ? k : inBounds(tx, ty, tz) ? key(tx, ty, tz) : NO_CELL,
      from: hit === 'block' ? k : null,
      point: [p[0], p[1] * CELL_H, p[2]],
    };
  };

  for (let guard = 0; guard < 256; guard++) {
    const [x, y, z] = cell as [number, number, number];
    const h = terrain.height[columnIndex(x, z)]!;
    if (y < h) return result('terrain', t);
    if (world.blocks.has(key(x, y, z))) return result('block', t);
    const exit = Math.min(tMax[0]!, tMax[1]!, tMax[2]!);
    if (y === 0 && h === 0 && d[1] < 0) {
      // Open water: does the ray cross the sea surface inside this cell?
      const tSea = (SEA_Y / CELL_H - o[1]) / d[1];
      if (tSea >= t - 1e-9 && tSea <= exit + 1e-9) {
        lastAxis = 1;
        return result('water', tSea);
      }
    }
    const axis = tMax[0]! <= tMax[1]! && tMax[0]! <= tMax[2]! ? 0 : tMax[1]! <= tMax[2]! ? 1 : 2;
    t = tMax[axis]!;
    tMax[axis]! += tDelta[axis]!;
    cell[axis]! += step[axis]!;
    lastAxis = axis;
    if (cell[axis]! < 0 || cell[axis]! >= size[axis]!) return null;
  }
  return null;
}

/**
 * Fences and walls (design section 7): the top face you point at is split
 * into a centre zone and four edge strips, the outer `strip` (25%) on each
 * side. Returns the side whose strip holds the point, or null for the centre
 * and for anything that is not a top face of terrain or of a block. In a
 * corner the nearer side wins.
 */
export function faceZone(pick: Pick, strip: number = INPUT.edgeStrip): Dir4 | null {
  if (pick.hit === 'water' || pick.normal[1] !== 1) return null;
  const fx = pick.point[0] - keyX(pick.cell);
  const fz = pick.point[2] - keyZ(pick.cell);
  const sides: readonly (readonly [Dir4, number])[] = [
    [N, fz],
    [E, 1 - fx],
    [S, 1 - fz],
    [W, fx],
  ];
  let best: Dir4 | null = null;
  let bestDist = strip;
  for (const [dir, dist] of sides) {
    if (dist < bestDist) {
      best = dir;
      bestDist = dist;
    }
  }
  return best;
}
