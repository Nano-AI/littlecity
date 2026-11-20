// What every bird shares: its two wings, and how a flying body turns to
// face the way it is going. See ../MOTION.md: where a bird IS is smooth
// (every frame); how it is DRAWN (the wing beat) is on twos.

import type { Mat4, Mat4Like, Vec3 } from '@/core/mat4';
import { shoulderOf, type Species } from '@/parts/actors/birds/kit';
import type { InstanceHandle, LifeStage, SpawnSpec } from '../api';
import { angleDelta, glide } from '../motion/ease';

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
