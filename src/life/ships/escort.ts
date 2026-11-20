// Gulls round a big ship (L38): three gulls keep company with a ship from the
// moment it comes in through the edge of the map to the moment it leaves
// through it, wheeling round its mastheads. They fly like the town's gulls
// (../birds/flight.ts): the place is smooth, the wing beat is drawn on twos.
// They are cut off at the edge of the map with the ship (params.w −1), so
// they come and go with it and never vanish in the air.

import type { Mat4, Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import type { InstanceHandle, LifeStage, Signals } from '../api';
import { attitude, steer, Wings, type Attitude } from '../birds/flight';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
const GULLS = 3;

interface Gull {
  body: InstanceHandle;
  wings: Wings;
  at: Attitude;
  /** Where on its circle (radians), how fast round, how high above the masthead, how far out. */
  angle: number;
  rate: number;
  lift: number;
  reach: number;
  /** 0 away, 1 with the ship. */
  near: number;
  shown: boolean;
  phase: number;
  m: Mat4;
}

export class Escort {
  private gulls: Gull[] = [];
  private x = 0;
  private y = 0;
  private z = 0;

  constructor(private stage: LifeStage, seed: number, id: string) {
    for (let i = 0; i < GULLS; i++) {
      const r = (k: string): number => rand(seed, 'escort', id, i, k);
      const body = stage.spawn({ actor: 'gull' }, HIDDEN);
      body.setParams(1, 0, 0, -1);
      body.setVisible(false);
      const wings = new Wings(stage, 'gull');
      wings.cutAtEdge();
      this.gulls.push({ body, wings, at: attitude(), angle: r('a') * Math.PI * 2, rate: (0.45 + r('r') * 0.35) * (r('d') < 0.3 ? -1 : 1), lift: -0.2 + r('h') * 1.2, reach: 0.8 + r('o') * 1.6, near: 0, shown: false, phase: r('p'), m: new Array<number>(16).fill(0) });
    }
  }

  /** Moves the gulls toward (`with`) or away from the masthead `at`; circles `radius` wide. */
  update(dt: number, signals: Signals, wanted: boolean, at: Vec3, radius: number): void {
    this.x = at[0];
    this.y = at[1];
    this.z = at[2];
    for (const g of this.gulls) {
      void wanted;
      g.near = 1;
      if (!g.shown) {
        g.shown = true;
        g.body.setVisible(true);
        g.wings.show(true);
      }
      g.angle += g.rate * dt;
      // Far off and high when away; on the circle round the masthead when near.
      const far = (1 - g.near) * 18;
      const r = radius * g.reach * 0.6 + far;
      const x = this.x + Math.cos(g.angle) * r, z = this.z + Math.sin(g.angle) * r;
      const y = this.y + g.lift + (1 - g.near) * 6 + 0.25 * Math.sin(signals.time.seconds * 0.7 + g.phase * 6);
      steer(g.at, x, y, z, dt);
      fly(g.at.x, g.at.y, g.at.z, g.at.yaw, g.at.pitch, g.at.roll, 1, g.m);
      g.body.setMatrix(g.m);
      // The beat on twos: mostly gliding, a few flaps now and then.
      const t = onTwos(signals.time.seconds, g.phase);
      const k = Math.floor(t * 12) % 24;
      const flap = k < 6 ? [0.6, 0.1, -0.4, 0.1, 0.6, 0.1][k]! : 0.16;
      g.wings.pose(g.m, flap);
    }
  }

  release(): void {
    for (const g of this.gulls) {
      g.body.release();
      g.wings.release();
    }
    this.gulls = [];
  }
}
