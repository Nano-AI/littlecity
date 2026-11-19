// L09: the lighthouse beam sweeps at night, with a soft pool of light that
// runs over the water under it. Both are one behaviour each on the same
// turning: a pure function of life time and the lighthouse's seed, so beam
// and pool never drift apart.
//
// The sweep is travel (MOTION.md): smooth, every frame. It comes up over a
// few seconds once night falls and dies away as dawn begins.

import { SEA_Y } from '@/core/grid';
import { positionOf, type Mat4 } from '@/core/mat4';
import { hash, rand } from '@/core/rand';
import type { Actor } from '@/resolve/plan';
import { DUSKY } from '@/style/animation';
import { TIME } from '@/style/time';
import { defineBehaviour, type LifeContext, type Signals, type TimeSignal } from '../api';
import { place } from '../motion/pose';
import { partPhases } from '../signals';

/** How strongly the beam shows, 0–1: up over the first seconds of night, down over the first of dawn. */
export function beamLevel(time: TimeSignal): number {
  const loop = TIME.day + TIME.dusk + TIME.night + TIME.dawn;
  const fade = Math.max(0.01, DUSKY.beamFade);
  const p = partPhases();
  if (time.isNight) return Math.min(1, ((time.phase - p.night.start) * loop) / fade);
  if (time.isDawn) return Math.max(0, 1 - ((time.phase - p.dawn.start) * loop) / fade);
  return 0;
}

/** The beam's heading at a life time, for the lighthouse at this cell-anchored seed. */
export function beamYaw(seconds: number, seed: number): number {
  return ((seconds / DUSKY.beamTurn + rand(seed, 'beam')) % 1) * Math.PI * 2;
}

const scratch: Mat4 = new Array<number>(16).fill(0);

function turn(state: { shown: boolean }, signals: Signals, ctx: LifeContext, y: number | null): void {
  const level = beamLevel(signals.time);
  if (level <= 0) {
    if (state.shown) {
      state.shown = false;
      ctx.instance.setVisible(false);
    }
    return;
  }
  // Beam and pool share a seed: the lighthouse's structure, not the actor's own id.
  const seed = hash(ctx.shape.world.seed, 'lighthouse', (ctx.item as Actor).home ?? 0);
  const [x, by, z] = positionOf(ctx.instance.base);
  place(x, y ?? by, z, beamYaw(signals.time.seconds, seed), 1, 1, 1, scratch);
  ctx.instance.setMatrix(scratch);
  ctx.instance.setParams(level);
  if (!state.shown) {
    state.shown = true;
    ctx.instance.setVisible(true);
  }
}

export const beam = defineBehaviour({
  actor: 'lighthouse-beam',
  create(_item, ctx) {
    ctx.instance.setVisible(false);
    return { shown: false };
  },
  update(state, _dt, signals, ctx) {
    turn(state, signals, ctx, null);
  },
});

export const glow = defineBehaviour({
  actor: 'beam-glow',
  create(_item, ctx) {
    ctx.instance.setVisible(false);
    return { shown: false };
  },
  update(state, _dt, signals, ctx) {
    turn(state, signals, ctx, SEA_Y + 0.02);
  },
});
