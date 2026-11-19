// Shared by the path, plaza and garden generators. Not a generator file.
//
// A floor region is drawn cell by cell, but must read as one poured shape:
// the outline is rounded only where the REGION turns a convex corner, the
// faces between cells are never emitted, and one ink group runs through it.

import { CELL_H, columnIndex, inColumnBounds, key, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import type { FeatureVariant } from '@/core/vocab';
import type { MeshBuilder } from '@/gen/mesh';
import type { ShapePlan, Structure } from '@/resolve/plan';

export const DIRS: readonly Dir4[] = [0, 1, 2, 3];
/** Unit step of each side in (x, z): N, E, S, W. */
export const SIDE: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export type LinkVariant = FeatureVariant<'floor-link'>;

/** The `floor-link` features of a region (J21), by cell and side. */
export function linksOf(s: Structure, plan: ShapePlan): Map<CellKey, Map<Dir4, LinkVariant>> {
  const out = new Map<CellKey, Map<Dir4, LinkVariant>>();
  for (const f of plan.featuresByStructure.get(s.id) ?? []) {
    if (f.type !== 'floor-link' || f.cell === undefined || f.dir === undefined) continue;
    let m = out.get(f.cell);
    if (!m) out.set(f.cell, (m = new Map()));
    m.set(f.dir, (f.variant ?? 'path') as LinkVariant);
  }
  return out;
}

/** Terrain height of a column (0 off the map). */
export function groundAt(plan: ShapePlan, x: number, z: number): number {
  return inColumnBounds(x, z) ? plan.terrain.height[columnIndex(x, z)]! : 0;
}
/** The cell lies on the terrain top (not on a block). */
export function onTerrain(plan: ShapePlan, cell: CellKey): boolean {
  return keyY(cell) === groundAt(plan, keyX(cell), keyZ(cell));
}

/**
 * The cell of the same region one terrain step up (+1) or down (−1) on side
 * `d`, or NO_CELL: how a floor climbs a terrace.
 */
export function stepNeighbour(plan: ShapePlan, cells: ReadonlySet<CellKey>, cell: CellKey, d: Dir4, dy: 1 | -1): CellKey {
  if (!onTerrain(plan, cell)) return NO_CELL;
  const n = neighbor(cell, d);
  if (n === NO_CELL) return NO_CELL;
  const y = keyY(n) + dy;
  if (y < 0 || y > 31) return NO_CELL;
  const m = key(keyX(n), y, keyZ(n));
  return cells.has(m) && onTerrain(plan, m) ? m : NO_CELL;
}

/** A triangle that faces up, whatever order its corners come in. */
export function upTri(b: MeshBuilder, p0: Vec3, p1: Vec3, p2: Vec3): void {
  const cross = (p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]);
  if (cross >= 0) b.tri(p0, p1, p2, { normals: [UP, UP, UP] });
  else b.tri(p0, p2, p1, { normals: [UP, UP, UP] });
}
const UP: Vec3 = [0, 1, 0];

/** A fan of up-facing triangles from `centre` round a list of [x, z] points at height y. */
export function fan(b: MeshBuilder, centre: readonly [number, number], pts: readonly (readonly [number, number])[], y: number, closed = false): void {
  const c: Vec3 = [centre[0], y, centre[1]];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    upTri(b, c, [p[0], y, p[1]], [q[0], y, q[1]]);
  }
}

/** An upright quad between two ground points from y0 to y1, facing away from `inside` ([x, z]). */
export function skirt(b: MeshBuilder, p: readonly [number, number], q: readonly [number, number], y0: number, y1: number, inside: readonly [number, number]): void {
  if (y1 - y0 < 1e-6) return;
  const dx = q[0] - p[0], dz = q[1] - p[1];
  // The outward normal is (dz, −dx) or its opposite: whichever points away from `inside`.
  const mx = (p[0] + q[0]) / 2 - inside[0], mz = (p[1] + q[1]) / 2 - inside[1];
  if (dz * mx - dx * mz >= 0) b.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]]);
  else b.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]);
}

export interface SlabOptions {
  /** Height of the underside and of the top, world units. */
  y0: number;
  y1: number;
  /** Radius of the region's convex corners. */
  round: number;
  /** How far the slab stands in from the region's outline on closed sides (0 = to the cell edge). */
  inset?: number;
  /** Draw the top (default true) and the sides on the region's outline (default true). */
  top?: boolean;
  sides?: boolean;
  /** Moves an outline point a little, for a hand-drawn edge. Must be a function of world position only. */
  warp?: (x: number, z: number) => readonly [number, number];
}

/**
 * One cell of a region as a slab: a top, and sides only where the region
 * ends. `inRegion(d)` says whether the cell's neighbour on side d continues
 * the region at this level.
 */
export function cellSlab(b: MeshBuilder, cell: CellKey, inRegion: (d: Dir4) => boolean, o: SlabOptions): void {
  const x = keyX(cell), z = keyZ(cell);
  const open = DIRS.map(inRegion);
  const inset = o.inset ?? 0;
  const x0 = x + (open[3] ? 0 : inset), x1 = x + 1 - (open[1] ? 0 : inset);
  const z0 = z + (open[0] ? 0 : inset), z1 = z + 1 - (open[2] ? 0 : inset);
  const warp = o.warp ?? ((px: number, pz: number) => [px, pz] as const);
  // Corners in order NW, NE, SE, SW; side k runs from corner k to corner k + 1 (N, E, S, W).
  const cornerAt: readonly (readonly [number, number])[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const inward: readonly (readonly [number, number])[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const startAngle = [Math.PI, Math.PI * 1.5, 0, Math.PI * 0.5];
  const steps = 4;
  const outline: { p: readonly [number, number]; arc: boolean }[] = [];
  const first: number[] = [];
  for (let k = 0; k < 4; k++) {
    const convex = !open[(k + 3) % 4] && !open[k];
    const [cx, cz] = cornerAt[k]!;
    first.push(outline.length);
    if (convex && o.round > 0) {
      const ox = cx + inward[k]![0] * o.round, oz = cz + inward[k]![1] * o.round;
      for (let i = 0; i <= steps; i++) {
        const a = startAngle[k]! + (i / steps) * Math.PI * 0.5;
        outline.push({ p: warp(ox + Math.cos(a) * o.round, oz + Math.sin(a) * o.round), arc: i > 0 });
      }
    } else {
      // An open corner stays exactly on the grid, so neighbours meet.
      outline.push({ p: open[(k + 3) % 4] || open[k] ? [cx, cz] : warp(cx, cz), arc: false });
    }
  }
  const centre: readonly [number, number] = [x + 0.5, z + 0.5];
  const pts = outline.map((e) => e.p);
  if (o.top ?? true) fan(b, centre, pts, o.y1, true);
  if (o.sides ?? true) {
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      // The stretch from point i to point j is part of a corner arc, or the straight run of a side.
      let closed = outline[j]!.arc;
      if (!closed) {
        const side = first.findIndex((f) => f === j);
        const k = (side + 3) % 4; // the side that ENDS at corner `side`
        closed = !open[k];
      }
      if (closed) skirt(b, pts[i]!, pts[j]!, o.y0, o.y1, centre);
    }
  }
}

/** World height of a cell's floor. */
export function floorY(cell: CellKey): number {
  return keyY(cell) * CELL_H;
}
