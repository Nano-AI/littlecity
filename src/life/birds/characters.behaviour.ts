// L14 sparrows and L15 characters: each small bird has its own ways.
//
//   sparrow   hops about its street in little two-footed hops, pecks, and
//             flits up and away when a block lands within three cells,
//             coming back down a few seconds later
//   dove      wheels round its dovecote with a few others, then settles on
//             the perch a while; at night it stays on the perch
//   stork     stands on its nest; now and then throws its head back and
//             clatters its bill
//   owl       out at dusk and night only, on its tree or the observatory:
//             turns its head slowly one way, then the other
//   crow      sits on the scarecrow, looks about, and caws now and then
//   duck      paddles slow loops on sheltered water with three ducklings
//             strung out behind, each following where the one ahead went
//
// Travel is smooth; poses (hops, pecks, looks, wing beats) are on twos.
// A bird in flight is drawn squashed across on alternate drawings: its
// folded wings read as beating.

import { SEA_Y } from '@/core/grid';
import { positionOf, type Mat4 } from '@/core/mat4';
import { defineBehaviour, type InstanceHandle } from '../api';
import { arc, easeInOut } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { scareDistance, scaresOf } from './scare';

interface State {
  phase: number;
  n: number;
  t: number;
  mode: 'ground' | 'air' | 'perch';
  modeT: number;
  modeLen: number;
  x: number;
  z: number;
  yaw: number;
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  hopT: number;
  seen: number;
  shown: boolean;
  trail: number[];
  ducklings: InstanceHandle[];
  m: Mat4;
}

const TAU = Math.PI * 2;
/** Seconds a sparrow stays away after a fright; seconds a dove wheels and sits. */
export const SPARROW_AWAY = 4;

export default defineBehaviour({
  actor: 'small-bird',
  create(item, ctx): State {
    const [x, , z] = positionOf(ctx.instance.base);
    const ducklings: InstanceHandle[] = [];
    if (item.variant === 'duck') for (let i = 0; i < 3; i++) ducklings.push(ctx.stage.spawn({ actor: 'small-bird', variant: 'duckling' }, ctx.instance.base));
    return {
      phase: ctx.rand('phase'), n: 0, t: ctx.rand('t') * 20, mode: item.variant === 'dove' ? 'perch' : 'ground', modeT: 0, modeLen: 3 + 8 * ctx.rand('len'),
      x, z, yaw: ctx.rand('yaw') * TAU, fx: x, fz: z, tx: x, tz: z, hopT: 1, seen: scaresOf(ctx.stage).seq, shown: true,
      trail: [], ducklings, m: new Array<number>(16).fill(0),
    };
  },
  update(state, dt, signals, ctx) {
    const v = ctx.item.variant ?? 'sparrow';
    const [bx, by, bz] = positionOf(ctx.instance.base);
    const h = ctx.item.params?.height ?? 0;
    const s = signals.time.seconds;
    const p = onTwos(s, state.phase);
    const frame = Math.floor(p * 12 + state.phase * 12);
    state.t += dt;
    state.modeT += dt;
    const m = state.m;

    if (v === 'owl') {
      const out = signals.time.isNight || (signals.time.isDusk && signals.time.light < 0.4);
      if (out !== state.shown) {
        state.shown = out;
        ctx.instance.setVisible(out);
      }
      if (!out) return;
      // The head (the whole small round bird) turns slowly to one side, holds, and turns back.
      const look = Math.sin(p * 0.35 + state.phase * TAU) * 0.9;
      fly(bx, by + h, bz, state.yaw + look, 0, 0, 1, m);
      ctx.instance.setMatrix(m);
      return;
    }
    if (v === 'stork' || v === 'crow') {
      // Now and then: the stork throws its head back and clatters; the crow leans in and caws.
      const beat = Math.floor((p + state.phase * 13) / (v === 'stork' ? 9 : 6));
      const within = (p + state.phase * 13) % (v === 'stork' ? 9 : 6);
      const call = within < 0.9 ? (frame % 2 === 0 ? 1 : 0.4) : 0;
      const look = Math.sin(beat * 2.3 + state.phase * 7) * 0.8;
      fly(bx, by + h, bz, state.yaw + look, v === 'stork' ? -0.35 * call : 0.3 * call, 0, 1, m);
      ctx.instance.setMatrix(m);
      return;
    }
    if (v === 'duck') {
      // Slow loops on the water; the ducklings follow the duck's own wake.
      const a = state.t * 0.12 + state.phase * TAU;
      // Small loops, within its own cell of sheltered water (an inlet may be one cell wide).
      state.x = bx + Math.sin(a) * 0.24 + 0.06 * Math.sin(a * 2.3);
      state.z = bz + Math.cos(a * 0.8) * 0.26;
      const yaw = Math.atan2(Math.cos(a) * 0.24 + 0.06 * 2.3 * Math.cos(a * 2.3), -Math.sin(a * 0.8) * 0.26 * 0.8);
      const bob = 0.006 * Math.sin(p * 2 + state.phase * 9);
      fly(state.x, SEA_Y + bob, state.z, yaw, 0, 0, 1, m);
      ctx.instance.setMatrix(m);
      const tr = state.trail;
      tr.push(state.x, state.z, yaw);
      const spacing = 22; // frames between one bird and the next along the wake
      while (tr.length > 3 * spacing * (state.ducklings.length + 1)) tr.splice(0, 3);
      state.ducklings.forEach((d, i) => {
        const k = Math.max(0, tr.length - 3 * spacing * (i + 1));
        fly(tr[k] ?? state.x, SEA_Y + 0.004 * Math.sin(p * 2.4 + i), tr[k + 1] ?? state.z, tr[k + 2] ?? yaw, 0, 0, 1, m);
        d.setMatrix(m);
      });
      return;
    }
    if (v === 'dove') {
      const night = signals.time.isNight;
      if (state.modeT >= state.modeLen && !night) {
        state.mode = state.mode === 'perch' ? 'air' : 'perch';
        state.modeT = 0;
        state.modeLen = state.mode === 'air' ? 7 + 6 * ctx.rand('air', state.n++) : 6 + 10 * ctx.rand('sit', state.n++);
      }
      if (state.mode === 'perch' || night) {
        const look = Math.sin(Math.floor(p * 0.7) * 1.7 + state.phase * 9) * 0.6;
        fly(bx, by, bz, state.yaw + look, 0, 0, 1, m);
        ctx.instance.setMatrix(m);
        return;
      }
      // Wheeling round the dovecote, out from the perch and back.
      const r = 1.1 + 0.3 * state.phase;
      const a = state.t * (0.9 + 0.3 * state.phase) + state.phase * TAU;
      const away = Math.min(1, state.modeT / 1, (state.modeLen - state.modeT) / 1);
      const w = easeInOut(Math.max(0, away));
      const cx = bx + Math.cos(a) * r, cz = bz + Math.sin(a) * r, cy = by + 0.4 + 0.15 * Math.sin(a * 2);
      const x = bx + (cx - bx) * w, y = by + (cy - by) * w, z = bz + (cz - bz) * w;
      const beat = frame % 2 === 0 ? 1 : 0.45;
      fly(x, y, z, Math.atan2(-Math.sin(a), Math.cos(a)), 0, 0, 1, m);
      m[0]! *= beat; m[1]! *= beat; m[2]! *= beat;
      ctx.instance.setMatrix(m);
      return;
    }

    // Sparrow.
    const scares = scaresOf(ctx.stage);
    if (scares.seq !== state.seen) {
      for (const e of scares.since(state.seen)) if (scareDistance(e, state.x, state.z) <= e.radius && state.mode === 'ground') {
        state.mode = 'air';
        state.modeT = 0;
        state.fx = state.x;
        state.fz = state.z;
        const a = Math.atan2(state.z - e.z, state.x - e.x);
        state.tx = state.x + Math.cos(a) * 2.2;
        state.tz = state.z + Math.sin(a) * 2.2;
      }
      state.seen = scares.seq;
    }
    if (state.mode === 'air') {
      // Up and away, a wait out of sight on a roof or fence (held aloft here), and back down to its street.
      const u = state.modeT / SPARROW_AWAY;
      const out = u < 0.25 ? easeInOut(u / 0.25) : u > 0.75 ? 1 - easeInOut((u - 0.75) / 0.25) : 1;
      const x = state.fx + (state.tx - state.fx) * out, z = state.fz + (state.tz - state.fz) * out;
      const beat = frame % 2 === 0 ? 1 : 0.4;
      fly(x, by + 1.1 * out + 0.05, z, Math.atan2(state.tx - state.fx, state.tz - state.fz) + (u > 0.5 ? Math.PI : 0), 0, 0, 1, m);
      m[0]! *= beat; m[1]! *= beat; m[2]! *= beat;
      ctx.instance.setMatrix(m);
      if (u >= 1) {
        state.mode = 'ground';
        state.modeT = 0;
      }
      return;
    }
    // Hopping: a little two-footed hop (on twos) to a spot near home, then pecking a while.
    if (state.hopT >= 1 && state.modeT >= state.modeLen) {
      const k = state.n++;
      const a = ctx.rand('hop', k) * TAU, d = 0.12 + 0.16 * ctx.rand('far', k);
      let tx = state.x + Math.cos(a) * d, tz = state.z + Math.sin(a) * d;
      if (Math.hypot(tx - bx, tz - bz) > 0.42) {
        tx = state.x + (bx - state.x) * 0.5;
        tz = state.z + (bz - state.z) * 0.5;
      }
      state.fx = state.x;
      state.fz = state.z;
      state.tx = tx;
      state.tz = tz;
      state.hopT = 0;
      state.yaw = Math.atan2(tx - state.x, tz - state.z);
      state.modeT = 0;
      state.modeLen = 0.4 + 1.6 * ctx.rand('stay', k);
    }
    let lift = 0;
    if (state.hopT < 1) {
      state.hopT = Math.min(1, state.hopT + dt / 0.18);
      state.x = state.fx + (state.tx - state.fx) * state.hopT;
      state.z = state.fz + (state.tz - state.fz) * state.hopT;
      lift = arc(state.hopT) * 0.05;
    }
    const peck = state.hopT >= 1 && frame % 5 === 0 ? 0.6 : 0;
    fly(state.x, by + lift, state.z, state.yaw, peck, 0, 1, m);
    ctx.instance.setMatrix(m);
  },
  dispose(state) {
    for (const d of state.ducklings) d.release();
  },
});
