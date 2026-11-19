// Shared drawing helpers for the things attached to houses (Houses owner).
//
// Everything here draws on a WALL PLANE: the part's frame has its origin on
// the wall surface (not on the cell line), +X to the viewer's right, +Y up
// and +Z out of the wall. The house generator supplies that frame; another
// generator that wants these parts on its own walls (a tower, a windmill)
// passes the frame of its wall surface to placeFeatures in the same way.

import { compose, rotationX, scaling, translation, type Vec3 } from '@/core/mat4';
import type { PartContext } from '@/gen/api';
import type { MeshBuilder } from '@/gen/mesh';
import { personalityOf, type Personality } from '@/style/houses';

export type P2 = readonly [number, number];

/** The personality of the structure a feature belongs to (a neutral one for free-standing use). */
export function personaOf(ctx: PartContext): Personality {
  const s = ctx.structure;
  if (!s) return personalityOf(ctx.seed, 5);
  return personalityOf(s.seed, s.color, ctx.plan.roles.get(s.id)?.role, s.cells.length);
}

/** A rectangle w × h standing on y0, centred on x = cx. Counter-clockwise seen from +Z. */
export function rectPts(w: number, h: number, y0 = 0, cx = 0): P2[] {
  return [[cx - w / 2, y0], [cx + w / 2, y0], [cx + w / 2, y0 + h], [cx - w / 2, y0 + h]];
}

/** A round-headed opening: straight sides `straight` high, then a half circle. */
export function archPts(w: number, straight: number, y0 = 0, cx = 0, segments = 8): P2[] {
  const r = w / 2;
  const pts: P2[] = [[cx - r, y0], [cx + r, y0]];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI;
    pts.push([cx + r * Math.cos(a), y0 + straight + r * Math.sin(a)]);
  }
  return pts;
}

/** A pointed (lancet) opening: straight sides, then two arcs meeting at a point `peak` above them. */
export function pointedPts(w: number, straight: number, peak: number, y0 = 0, cx = 0, segments = 4): P2[] {
  const r = w / 2;
  const pts: P2[] = [[cx - r, y0], [cx + r, y0]];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push([cx + r * (1 - t) * (1 - t * 0.25), y0 + straight + peak * Math.sin((t * Math.PI) / 2)]);
  }
  for (let i = segments - 1; i >= 0; i--) {
    const t = i / segments;
    pts.push([cx - r * (1 - t) * (1 - t * 0.25), y0 + straight + peak * Math.sin((t * Math.PI) / 2)]);
  }
  return pts;
}

export function circlePts(r: number, cx = 0, cy = 0, segments = 14): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** The outline shrunk toward (cx, cy) by `by` on every side (good enough for convex window shapes). */
export function shrink(pts: readonly P2[], by: number): P2[] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sx = (x1 - x0 - 2 * by) / (x1 - x0), sy = (y1 - y0 - 2 * by) / (y1 - y0);
  return pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
}

/** A plate: the outline (in the wall plane) standing out of the wall from z0 to z1, with its front face. */
export function plate(b: MeshBuilder, pts: readonly P2[], z0: number, z1: number): void {
  b.at(rotationX(Math.PI / 2), () => b.extrude(pts.map(([x, y]) => [x, -y] as const), z0, z1, { cap: 'top' }));
}

/** Just the face of an outline, at depth z, looking out of the wall. */
export function face(b: MeshBuilder, pts: readonly P2[], z: number): void {
  b.polygon(pts.map(([x, y]): Vec3 => [x, y, z]));
}

/** A flat bar on the wall plane from (x0, y0) to (x1, y1), `w` wide, at depth z. */
export function bar(b: MeshBuilder, x0: number, y0: number, x1: number, y1: number, w: number, z: number): void {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
  b.quad([x0 - nx, y0 - ny, z], [x1 - nx, y1 - ny, z], [x1 + nx, y1 + ny, z], [x0 + nx, y0 + ny, z]);
}

/** A box given by x range, y range and z range (a shorthand that reads like the drawing). */
export function slab(b: MeshBuilder, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, skip: readonly ('top' | 'bottom' | 'n' | 'e' | 's' | 'w')[] = ['n']): void {
  b.box([x0, y0, z0], [x1, y1, z1], { skip });
}

const BALL: [number, number][] = [[0, -1], [0.71, -0.71], [1, 0], [0.71, 0.71], [0, 1]];
/** A small low-poly ball: a knob, a flower head, a pot. */
export function bead(b: MeshBuilder, x: number, y: number, z: number, r: number, squash = 1): void {
  b.at(compose(translation(x, y, z), scaling(r, r * squash, r)), () => b.lathe(BALL, { segments: 6 }));
}
