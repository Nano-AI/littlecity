// Animals (and anything else with one drawn body) that mischief can throw
// and the Hand can pick up (design section 13b, "blown about"). Owner:
// Mischief.
//
// What a thing has to do to be throwable, in its own behaviour's update:
//
//   const held = critterPose(ctx.stage, ctx.item.id, 'sheep', x, y, z, yaw, 0.3);
//   if (held) { ctx.instance.setMatrix(held); return; }
//
// that is: say each frame where it stands (its feet), which way it faces and
// how tall it is; and while it gets a matrix back, draw that instead of its
// own motion and leave its own state alone. The thrower flings it, lets it
// lie on its back with its legs in the air (dizzy), turns it back over and
// walks (or bounds) it back to where it was taken from, and then lets go:
// the next update gets null, and it carries on from exactly where it was.
// Nothing about it is saved.

import type { Mat4Like } from '@/core/mat4';
import type { LifeStage } from '../api';
import type { Body } from './thrown';

export interface Critter {
  readonly id: string;
  readonly kind: string;
  /** Where it stands now (its feet), which way it faces (radians, 0 = +z), how tall it is (world units), its drawing's scale. */
  x: number;
  y: number;
  z: number;
  heading: number;
  height: number;
  scale: number;
  /** Frames since it last said where it is (it is dropped when its behaviour has gone). */
  quiet: number;
  /** While thrown: the body, where it was taken from, and the matrix to draw. */
  body: Body | null;
  home: { x: number; y: number; z: number; heading: number } | null;
  m: number[];
}

const registry = new WeakMap<LifeStage, Map<string, Critter>>();

/** Every throwable thing on a stage that has said where it is lately. */
export function crittersOf(stage: LifeStage): Map<string, Critter> {
  let m = registry.get(stage);
  if (!m) registry.set(stage, (m = new Map()));
  return m;
}

/**
 * A throwable thing's own update says where it is; while it is thrown or held, the matrix to draw it with
 * is returned (else null: it carries on itself).
 */
export function critterPose(stage: LifeStage, id: string, kind: string, x: number, y: number, z: number, heading: number, height: number, scale = 1): Mat4Like | null {
  const all = crittersOf(stage);
  let c = all.get(id);
  if (!c) all.set(id, (c = { id, kind, x, y, z, heading, height, scale, quiet: 0, body: null, home: null, m: new Array<number>(16).fill(0) }));
  c.quiet = 0;
  if (c.body) return c.m;
  c.x = x;
  c.y = y;
  c.z = z;
  c.heading = heading;
  c.height = height;
  c.scale = scale;
  return null;
}

/** The same, for a thing whose drawing is a world matrix `m` (its feet at the origin, +Z ahead): where it stands is read from it. */
export function critterPoseOf(stage: LifeStage, id: string, kind: string, m: Mat4Like, height: number): Mat4Like | null {
  const scale = Math.hypot(m[0]!, m[1]!, m[2]!) || 1;
  return critterPose(stage, id, kind, m[12]!, m[13]!, m[14]!, Math.atan2(m[8]!, m[10]!), height, scale);
}
