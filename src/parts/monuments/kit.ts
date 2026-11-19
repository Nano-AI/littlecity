// Small shape and placement helpers shared by the monument generators and
// parts (towers, lighthouses, arches, supports, marble, pillars).

import { CELL_H, DIR4, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { compose, multiply, rotationY, scaling, translation, type Mat4, type Mat4Like } from '@/core/mat4';
import { facingFrame } from '@/gen/frames';
import type { MeshBuilder } from '@/gen/mesh';
import type { ShapePlan } from '@/resolve/plan';

export const TAU = Math.PI * 2;

/** World position of the bottom centre of a cell. */
export function cellOrigin(cell: CellKey): [number, number, number] {
  return [keyX(cell) + 0.5, keyY(cell) * CELL_H, keyZ(cell) + 0.5];
}

/**
 * A frame on a wall that stands `r` from the column's axis on side `dir`, at
 * height `y`: +Z out of the wall, +X to the viewer's right. In the column's
 * local space (origin on the axis).
 */
export function wallFrame(dir: Dir4, r: number, y: number): Mat4 {
  const [dx, dz] = DIR4[dir]!;
  return facingFrame([dx * r, y, dz * r], dx, dz);
}

/** The yaw that turns +Z toward side `dir`. */
export function yawOf(dir: Dir4): Mat4 {
  const [dx, dz] = DIR4[dir]!;
  return rotationY(Math.atan2(dx, dz));
}

function ballProfile(rings: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= rings; i++) {
    const a = (i / rings) * Math.PI;
    out.push([i === 0 || i === rings ? 0 : Math.sin(a), -Math.cos(a)]);
  }
  return out;
}
const BALL = ballProfile(6);
const SMALL_BALL = ballProfile(4);

/** A ball (or an egg, with ry) centred on (x, y, z). */
export function ball(b: MeshBuilder, x: number, y: number, z: number, r: number, ry = r, segments = 8): void {
  b.at(compose(translation(x, y, z), scaling(r, ry, r)), () => b.lathe(segments <= 6 ? SMALL_BALL : BALL, { segments }));
}

/** `n` copies of `draw` spaced evenly round the axis; each is drawn facing out along its own +Z at `radius`. */
export function around(b: MeshBuilder, n: number, radius: number, phase: number, draw: (i: number) => void): void {
  for (let i = 0; i < n; i++) {
    b.at(compose(rotationY(phase + (i / n) * TAU), translation(0, 0, radius)), () => draw(i));
  }
}

/** A ring: a rail round the axis with a square section (`w` wide, `h` high) centred on radius `r` at height `y`. */
export function ring(b: MeshBuilder, r: number, y: number, w: number, h: number, segments = 16): void {
  b.lathe(
    [
      [r - w / 2, y],
      [r + w / 2, y],
      [r + w / 2, y + h],
      [r - w / 2, y + h],
      [r - w / 2, y],
    ],
    { segments },
  );
}

/**
 * Records the world frames of the sockets a feature owns. `frames` are in
 * the same local space `world` maps from, keyed by socket name (or type).
 */
export function ownSockets(
  plan: ShapePlan,
  anchors: Record<string, Mat4Like>,
  owner: string,
  world: Mat4Like,
  frames: Record<string, Mat4Like>,
): void {
  for (const s of plan.socketsByOwner.get(owner) ?? []) {
    const local = frames[s.name ?? s.type];
    if (local) anchors[s.id] = multiply(world, local);
  }
}

/** Points of a half ellipse over [lo, hi] rising `rise` from `base`, left to right; `n` segments. */
export function halfEllipse(lo: number, hi: number, base: number, rise: number, n: number): [number, number][] {
  const c = (lo + hi) / 2, a = (hi - lo) / 2;
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.PI * (1 - i / n);
    out.push([c + a * Math.cos(t), base + rise * Math.sin(t)]);
  }
  return out;
}
