// What every bird shares: its two wings, and how a flying body turns to
// face the way it is going. See ../MOTION.md: where a bird IS is smooth
// (every frame); how it is DRAWN (the wing beat) is on twos.

import type { Mat4, Mat4Like, Vec3 } from '@/core/mat4';
import { shoulderOf, type Species } from '@/parts/actors/birds/kit';
import { SIZE_X, SIZE_Z } from '@/core/grid';
import type { InstanceHandle, LifeStage, SpawnSpec } from '../api';
import { fxOf } from '../fx/fx';
import { angleDelta, easeOut, glide } from '../motion/ease';
import { fly } from '../motion/pose';

const SPECS: Record<Species, readonly [SpawnSpec, SpawnSpec]> = {
  gull: [{ actor: 'bird-wing', variant: 'gull', params: { side: 1 } }, { actor: 'bird-wing', variant: 'gull', params: { side: -1 } }],
  pigeon: [{ actor: 'bird-wing', variant: 'pigeon', params: { side: 1 } }, { actor: 'bird-wing', variant: 'pigeon', params: { side: -1 } }],
  swift: [{ actor: 'bird-wing', variant: 'swift', params: { side: 1 } }, { actor: 'bird-wing', variant: 'swift', params: { side: -1 } }],
};
const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
const scratch: Mat4 = new Array<number>(16).fill(0);

/** A bird's pair of wings: two spawned instances that follow the body and turn about the shoulders. */
export class Wings {
  private left: InstanceHandle;
  private right: InstanceHandle;
  private shown = false;
  private shoulder: Vec3;

  constructor(stage: LifeStage, species: Species) {
    const [l, r] = SPECS[species];
    this.left = stage.spawn(l, HIDDEN);
    this.right = stage.spawn(r, HIDDEN);
    this.left.setVisible(false);
    this.right.setVisible(false);
    this.shoulder = shoulderOf(species);
  }

  /** Cut off at the edge of the map like what they fly with (a ship's escort): see ShipBody.setCut. */
  cutAtEdge(): void {
    this.left.setParams(1, 0, 0, -1);
    this.right.setParams(1, 0, 0, -1);
  }

  /** Folded wings are simply not drawn: the body's own back shows instead. */
  show(visible: boolean): void {
    if (visible === this.shown) return;
    this.shown = visible;
    this.left.setVisible(visible);
    this.right.setVisible(visible);
  }
  get visible(): boolean {
    return this.shown;
  }

  /**
   * Places both wings on a body. `angle` is how far the tips are raised (radians; negative = the
   * down stroke). The wings take the body's scale with them.
   */
  pose(body: Mat4Like, angle: number): void {
    if (!this.shown) return;
    const [sx, sy, sz] = this.shoulder;
    const c = Math.cos(angle);
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? 1 : -1;
      const s = Math.sin(angle) * side;
      const m = scratch;
      // body × T(side·sx, sy, sz) × Rz(side·angle), written out: the body's axes are its columns.
      for (let r = 0; r < 3; r++) {
        const X = body[r]!, Y = body[4 + r]!, Z = body[8 + r]!;
        m[r] = c * X + s * Y;
        m[4 + r] = -s * X + c * Y;
        m[8 + r] = Z;
        m[12 + r] = body[12 + r]! + side * sx * X + sy * Y + sz * Z;
      }
      m[3] = m[7] = m[11] = 0;
      m[15] = 1;
      (k === 0 ? this.left : this.right).setMatrix(m);
    }
  }

  release(): void {
    this.left.release();
    this.right.release();
  }
}

/** Where a flying body is and how it is turned. */
export interface Attitude {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** False until it has been somewhere (the first step has no velocity to read). */
  moving: boolean;
}

export function attitude(yaw = 0): Attitude {
  return { x: 0, y: 0, z: 0, yaw, pitch: 0, roll: 0, moving: false };
}

/**
 * Moves the body to (x, y, z) and turns it to suit: nose along the way it went, rolled into the
 * turn, tipped up in a climb. `bank` is radians of roll per radian-a-second of turn.
 */
export function steer(a: Attitude, x: number, y: number, z: number, dt: number, bank = 0.7, maxBank = 0.6): void {
  if (a.moving && dt > 0) {
    const vx = (x - a.x) / dt, vy = (y - a.y) / dt, vz = (z - a.z) / dt;
    const ground = Math.hypot(vx, vz);
    let turn = 0;
    if (ground > 0.15) {
      const d = angleDelta(a.yaw, Math.atan2(vx, vz));
      const step = d * glide(9, dt);
      a.yaw += step;
      turn = step / dt;
    }
    const wantRoll = Math.max(-maxBank, Math.min(maxBank, -turn * bank));
    a.roll += (wantRoll - a.roll) * glide(5, dt);
    const wantPitch = ground > 0.15 ? Math.max(-0.6, Math.min(0.6, Math.atan2(vy, ground) * 0.8)) : 0;
    a.pitch += (wantPitch - a.pitch) * glide(5, dt);
  }
  a.x = x;
  a.y = y;
  a.z = z;
  a.moving = true;
}

// ── leaving and coming back ─────────────────────────────────────────────
//
// A bird whose home goes (its tower wrecked, its tree blown down, the nest
// gone with the roof) does not blink out: it takes off and flies away over
// the edge of the island. One made later (its home stands again, or was just
// built) flies in to it. Neither is ever drawn smaller.

/** World units a second a leaving bird flies at, and how far past the island's edge it goes. */
const LEAVE_SPEED = 3.4;
const LEAVE_PAST = 6;
/** Seconds an arriving bird takes, and how far out and how high it comes from. */
export const ARRIVE = { time: 2.6, far: 7, up: 3 };

const ISLAND_MIDDLE = SIZE_X / 2;

/** How far from (x, z) along (dx, dz) the island's edge is (dx, dz a unit vector). */
function toEdge(x: number, z: number, dx: number, dz: number): number {
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (SIZE_X - x) / dx);
  if (dx < -1e-6) t = Math.min(t, -x / dx);
  if (dz > 1e-6) t = Math.min(t, (SIZE_Z - z) / dz);
  if (dz < -1e-6) t = Math.min(t, -z / dz);
  return Number.isFinite(t) ? Math.max(0, t) : 0;
}

/** Eases in over the first fifth, then flies on at an even pace: 0 → 1. */
function cruise(t: number): number {
  return (t < 0.2 ? (t * t) / 0.4 : t - 0.1) / 0.9;
}

/**
 * A bird (drawn by `spec`, a module constant) takes off from `from` and flies away off the island, away
 * from (awayX, awayZ) if given and outward from the middle of the island. `beat` squashes it across on
 * alternate drawings (the small birds' wing beat). Played as an effect, so it outlives the item.
 */
export function flyOff(stage: LifeStage, spec: SpawnSpec, from: Mat4Like, seed: number, away?: { x: number; z: number }, beat = true): void {
  const x0 = from[12]!, y0 = from[13]!, z0 = from[14]!;
  const out0 = Math.hypot(x0 - ISLAND_MIDDLE, z0 - ISLAND_MIDDLE) || 1;
  let dx = (x0 - ISLAND_MIDDLE) / out0, dz = (z0 - ISLAND_MIDDLE) / out0;
  if (away) {
    const ax = x0 - away.x, az = z0 - away.z, d = Math.hypot(ax, az);
    if (d > 1e-3) {
      dx += (2 * ax) / d;
      dz += (2 * az) / d;
    }
  }
  const turn = (((seed >>> 0) % 1000) / 1000 - 0.5) * 0.8;
  let len = Math.hypot(dx, dz);
  if (len < 1e-3) {
    dx = Math.cos(seed);
    dz = Math.sin(seed);
    len = 1;
  }
  const c = Math.cos(turn), s = Math.sin(turn);
  const ux = (dx / len) * c - (dz / len) * s, uz = (dx / len) * s + (dz / len) * c;
  const dist = toEdge(x0, z0, ux, uz) + LEAVE_PAST;
  const yaw = Math.atan2(ux, uz);
  const climb = Math.min(5, 1.5 + dist * 0.2);
  fxOf(stage).play(
    spec,
    dist / LEAVE_SPEED,
    (t, out) => {
      const along = dist * cruise(t);
      const up = climb * Math.min(1, t * 3) * (2 - Math.min(1, t * 3));
      fly(x0 + ux * along, y0 + up, z0 + uz * along, yaw, t < 0.2 ? 0.35 : 0.05, 0, 1, out);
      if (beat && Math.floor(t * dist * 3) % 2 === 1) {
        out[0]! *= 0.45;
        out[1]! *= 0.45;
        out[2]! *= 0.45;
      }
    },
    { smooth: true },
  );
}

/**
 * Where a bird arriving at (x, y, z) is, `u` (0 → 1) of the way in from the direction `from` (radians),
 * into `out`: in from a few cells out and above, gliding down to settle. Returns its heading.
 */
export function arriving(u: number, x: number, y: number, z: number, from: number, out: { x: number; y: number; z: number }): number {
  const k = 1 - easeOut(Math.max(0, Math.min(1, u)));
  out.x = x + Math.cos(from) * ARRIVE.far * k;
  out.z = z + Math.sin(from) * ARRIVE.far * k;
  out.y = y + ARRIVE.up * k * k;
  return Math.atan2(-Math.cos(from), -Math.sin(from));
}
