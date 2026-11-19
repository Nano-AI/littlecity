// Short-lived drawn things: a dust puff, a sparkle, a ring on the water, a
// puff of smoke. One small service per stage, shared by every system and
// behaviour, so nothing else has to keep lists of spawned instances.
//
//   fxOf(stage).play({ actor: 'puff', variant: 'dust' }, 0.4, (t, m) => place(x, y + t, z, 0, 1 - t, 1 - t, 1 - t, m));
//
// `pose(t, out)` is called with t running 0 → 1 over the effect's life and
// writes the instance's world matrix into `out`. Instances are pooled by
// what they draw: a finished effect's instance is hidden and reused by the
// next one, so a click never uploads geometry after the first time.
//
// The fx system (fx.system.ts) advances it once a frame, before behaviours.

import type { Mat4 } from '@/core/mat4';
import { MOTION } from '@/style/animation';
import type { InstanceHandle, LifeStage, SpawnSpec } from '../api';

export interface FxOptions {
  /** Seconds before it appears. */
  delay?: number;
  /** Redraw on twos (default) or every frame (things the player just caused). */
  smooth?: boolean;
  /** The instance's glow (param a) over its life; default 1. */
  glow?(t: number): number;
  /** Called once when it ends (or is cut short by dispose). */
  done?(): void;
}

export type FxPose = (t: number, out: Mat4) => void;

interface Playing {
  key: string;
  handle: InstanceHandle;
  age: number;
  life: number;
  pose: FxPose;
  smooth: boolean;
  /** Seconds since its last drawing. */
  since: number;
  shown: boolean;
  glow: FxOptions['glow'];
  done: FxOptions['done'];
}

/** Idle instances kept per kind of effect; beyond this they are released. */
const KEEP_IDLE = 48;

export class Fx {
  private playing: Playing[] = [];
  private idle = new Map<string, InstanceHandle[]>();
  private scratch: Mat4 = new Array<number>(16).fill(0);
  /** Callers pass the same spec object each time (a module constant), so its key is worked out once. */
  private keys = new WeakMap<SpawnSpec, string>();

  constructor(private stage: LifeStage) {}

  /** Effects now playing or waiting to start. */
  get live(): number {
    return this.playing.length;
  }

  play(spec: SpawnSpec, seconds: number, pose: FxPose, opts: FxOptions = {}): void {
    let key = this.keys.get(spec);
    if (key === undefined) this.keys.set(spec, (key = JSON.stringify(spec)));
    let handle = this.idle.get(key)?.pop();
    if (!handle) {
      handle = this.stage.spawn(spec, this.scratch.fill(0));
      handle.setVisible(false);
    }
    this.playing.push({
      key,
      handle,
      age: -(opts.delay ?? 0),
      life: Math.max(1e-3, seconds),
      pose,
      smooth: opts.smooth ?? false,
      since: Infinity,
      shown: false,
      glow: opts.glow,
      done: opts.done,
    });
  }

  update(dt: number): void {
    const list = this.playing;
    const frame = 1 / MOTION.poseFps - 1e-4;
    let kept = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      p.age += dt;
      if (p.age >= p.life) {
        this.retire(p);
        continue;
      }
      list[kept++] = p;
      if (p.age < 0) continue;
      p.since += dt;
      if (!p.smooth && p.since < frame) continue;
      p.since = 0;
      const t = p.age / p.life;
      p.pose(t, this.scratch);
      p.handle.setMatrix(this.scratch);
      if (p.glow) p.handle.setParams(p.glow(t));
      if (!p.shown) {
        p.shown = true;
        p.handle.setVisible(true);
      }
    }
    list.length = kept;
  }

  private retire(p: Playing): void {
    p.handle.setVisible(false);
    if (p.glow) p.handle.setParams(1);
    let pool = this.idle.get(p.key);
    if (!pool) this.idle.set(p.key, (pool = []));
    if (pool.length < KEEP_IDLE) pool.push(p.handle);
    else p.handle.release();
    p.done?.();
  }

  /** Ends everything and releases every instance. */
  dispose(): void {
    for (const p of this.playing) {
      p.handle.release();
      p.done?.();
    }
    this.playing = [];
    for (const pool of this.idle.values()) for (const h of pool) h.release();
    this.idle.clear();
  }
}

const byStage = new WeakMap<LifeStage, Fx>();

/** The effects service of a stage (made on first use). */
export function fxOf(stage: LifeStage): Fx {
  let fx = byStage.get(stage);
  if (!fx) byStage.set(stage, (fx = new Fx(stage)));
  return fx;
}
