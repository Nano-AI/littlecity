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
//
// When the town is wrecked: a frightened sparrow flits to a roof that still
// stands and waits there, and does not come back down while a fire burns by
// its street. A bird whose home goes (the stork's tower, the owl's tree, the
// dovecote, the street) flies away off the island (flight.ts, flyOff); one
// whose home stands again, or is new, flies in to it. None ever blinks out.

import { columnIndex, inColumnBounds, key, SEA_Y, SIZE_Y } from '@/core/grid';
import { positionOf, type Mat4 } from '@/core/mat4';
import type { ShapePlan } from '@/resolve/plan';
import { ruinUninhabitable } from '@/world/damage';
import { defineBehaviour, type InstanceHandle, type SpawnSpec } from '../api';
import { arc, easeInOut, lerp } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { arriving, ARRIVE, flyOff } from './flight';
import { scareDistance, scaresOf, type ScareTable } from './scare';
import { columnTops } from './town';

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
  /** A sparrow away: the height it waits at, and whether that is on something (else it hangs in the air). */
  ty: number;
  sits: boolean;
  /** Where its flight away began (its street, or a roof it had to leave), and the town it chose its roof in. */
  ox: number;
  oy: number;
  oz: number;
  town: ShapePlan | null;
  /** Seconds until a sparrow waiting in the air looks again for somewhere to sit. */
  retry: number;
  /** Flying in to its place: seconds left, and the way it comes from. */
  arrive: number;
  from: number;
  seen: number;
  shown: boolean;
  trail: number[];
  ducklings: InstanceHandle[];
  m: Mat4;
}

const TAU = Math.PI * 2;
/** Seconds a sparrow stays away after a fright; seconds a dove wheels and sits. */
export const SPARROW_AWAY = 4;
/** Seconds a sparrow takes to flit in to a new street. */
const SPARROW_ARRIVE = 1.4;

const LOOK: Record<string, SpawnSpec> = {
  sparrow: { actor: 'small-bird', variant: 'sparrow' },
  dove: { actor: 'small-bird', variant: 'dove' },
  stork: { actor: 'small-bird', variant: 'stork' },
  owl: { actor: 'small-bird', variant: 'owl' },
  crow: { actor: 'small-bird', variant: 'crow' },
  duck: { actor: 'small-bird', variant: 'duck' },
  duckling: { actor: 'small-bird', variant: 'duckling' },
};

/** Is anything in this column wrecked (or under scaffolding)? No bird sits there. */
function wreckedColumn(shape: ShapePlan, x: number, z: number): boolean {
  const blocks = shape.world.blocks;
  for (let y = 0; y < SIZE_Y; y++) {
    const b = blocks.get(key(x, y, z));
    if (b && ruinUninhabitable(b.ruin)) return true;
  }
  return false;
}

/**
 * Where a frightened sparrow waits: a roof or wall top a couple of cells away from the fright, higher than
 * its street, standing whole, and not by a fire; failing that, any dry ground or roof a little further off
 * that stands and is clear of fire. Null if there is none at all (it waits in the air).
 */
function sparrowPerch(shape: ShapePlan, scares: ScareTable, now: number, x: number, z: number, y: number, away: number): { x: number; y: number; z: number } | null {
  const tops = columnTops(shape);
  for (const [far, high] of [[2.2, true], [2.2, false], [3.6, false], [5, false], [7, false], [9.5, false]] as const) {
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 2]) {
      const a = away + turn;
      const cx = Math.floor(x + Math.cos(a) * far), cz = Math.floor(z + Math.sin(a) * far);
      if (!inColumnBounds(cx, cz)) continue;
      const top = tops[columnIndex(cx, cz)]!;
      if ((high ? top < y + 0.6 : top <= SEA_Y + 0.05) || wreckedColumn(shape, cx, cz) || scares.danger(cx + 0.5, cz + 0.5, now, high ? 0.5 : 1)) continue;
      return { x: cx + 0.5, y: top, z: cz + 0.5 };
    }
  }
  return null;
}
const spot = { x: 0, y: 0, z: 0 };

/** Sends a frightened sparrow (from ox, oy, oz) to a roof away from the fright, or into the air if there is none. */
function flitTo(state: State, shape: ShapePlan, scares: ScareTable, now: number, away: number, street: number): void {
  const perch = sparrowPerch(shape, scares, now, state.ox, state.oz, street, away);
  state.town = shape;
  state.sits = perch !== null;
  state.tx = perch?.x ?? state.ox + Math.cos(away) * 2.2;
  state.tz = perch?.z ?? state.oz + Math.sin(away) * 2.2;
  state.ty = perch?.y ?? street + 1.1;
}

/** Seconds a sparrow's flit takes: a second for the usual couple of cells, longer for further (never a dart). */
const flit = (dx: number, dz: number): number => Math.min(4, Math.max(SPARROW_AWAY / 4, Math.hypot(dx, dz) / 2.4));
/** Seconds an away sparrow waits on its roof before it comes back (longer while a fire burns by its street). */
const WAIT = SPARROW_AWAY / 2;
const outLen = (state: State): number => flit(state.tx - state.ox, state.tz - state.oz);
const backLen = (state: State): number => flit(state.fx - state.tx, state.fz - state.tz);

/** Where an away sparrow is: out to its roof, waiting there, and back down to its street (fx, fz). */
function sparrowAt(state: State, street: number): [number, number, number] {
  const o = outLen(state);
  if (state.modeT <= o + WAIT) {
    const out = easeInOut(Math.min(1, state.modeT / o));
    return [lerp(state.ox, state.tx, out), lerp(state.oy, state.ty, out) + 0.05 * out + arc(out) * (state.sits ? 0.3 : 0), lerp(state.oz, state.tz, out)];
  }
  const back = easeInOut(Math.min(1, (state.modeT - o - WAIT) / backLen(state)));
  return [lerp(state.tx, state.fx, back), lerp(state.ty + 0.05, street, back) + arc(back) * (state.sits ? 0.3 : 0), lerp(state.tz, state.fz, back)];
}

export default defineBehaviour({
  actor: 'small-bird',
  create(item, ctx): State {
    const [x, , z] = positionOf(ctx.instance.base);
    const ducklings: InstanceHandle[] = [];
    if (item.variant === 'duck') for (let i = 0; i < 3; i++) ducklings.push(ctx.stage.spawn({ actor: 'small-bird', variant: 'duckling' }, ctx.instance.base));
    return {
      phase: ctx.rand('phase'), n: 0, t: ctx.rand('t') * 20, mode: item.variant === 'dove' ? 'perch' : 'ground', modeT: 0, modeLen: 3 + 8 * ctx.rand('len'),
      x, z, yaw: ctx.rand('yaw') * TAU, fx: x, fz: z, tx: x, tz: z, hopT: 1, ty: 0, sits: false, ox: x, oy: 0, oz: z, town: null, retry: 0,
      // Made after the town opened: its home is new, or stands again. It flies in.
      arrive: scaresOf(ctx.stage).towns > 1 && item.variant !== 'duck' ? (item.variant === 'sparrow' ? SPARROW_ARRIVE : ARRIVE.time) : 0,
      from: ctx.rand('from') * TAU,
      seen: scaresOf(ctx.stage).seq, shown: true,
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

    if (state.arrive > 0) {
      // Flying in to its place (an owl only once it is out).
      const owlIn = v === 'owl' && !(signals.time.isNight || (signals.time.isDusk && signals.time.light < 0.4));
      if (owlIn) state.arrive = 0;
      else {
        const len = v === 'sparrow' ? SPARROW_ARRIVE : ARRIVE.time;
        state.arrive = Math.max(0, state.arrive - dt);
        const u = 1 - state.arrive / len;
        const yaw = arriving(u, bx, by + h, bz, state.from, spot);
        fly(spot.x, spot.y, spot.z, yaw, 0, 0, 1, m);
        if (u < 0.9 && frame % 2 === 1) {
          m[0]! *= 0.45; m[1]! *= 0.45; m[2]! *= 0.45;
        }
        ctx.instance.setMatrix(m);
        if (!state.shown) {
          state.shown = true;
          ctx.instance.setVisible(true);
        }
        state.modeT = 0;
        return;
      }
    }

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
        state.ox = state.x;
        state.oy = by;
        state.oz = state.z;
        flitTo(state, ctx.shape, scares, s, Math.atan2(state.z - e.z, state.x - e.x), by);
      }
      state.seen = scares.seq;
    }
    if (state.mode === 'air') {
      // Its roof was wrecked under it (the blast goes on hitting the town): on to another. Waiting in the air
      // (there was nowhere to go when it took off): somewhere to sit, once there is.
      const o = outLen(state);
      const waiting = state.modeT > o && state.modeT < o + WAIT;
      const lost = state.sits ? ctx.shape !== state.town && state.modeT < o + WAIT && wreckedColumn(ctx.shape, Math.floor(state.tx), Math.floor(state.tz)) : waiting && (state.retry -= dt) <= 0;
      if (lost) {
        state.retry = 1;
        const fright = scares.latest();
        const [px, py, pz] = sparrowAt(state, by);
        const away = fright ? Math.atan2(pz - fright.z, px - fright.x) : state.yaw;
        if (state.sits || sparrowPerch(ctx.shape, scares, s, px, pz, by, away)) {
          state.ox = px;
          state.oy = py;
          state.oz = pz;
          state.modeT = 0;
          flitTo(state, ctx.shape, scares, s, away, by);
        }
      }
      // Up and away to a roof that stands (or, with none, a wait in the air), and back down to its street, but
      // not while a fire burns by it: it waits on.
      const hold = outLen(state) + WAIT;
      if (state.modeT > hold - 0.04 && state.modeT < hold && scares.danger(state.fx, state.fz, s, 1)) state.modeT = hold - 0.04;
      const [x, y, z] = sparrowAt(state, by);
      const flying = !state.sits || state.modeT < outLen(state) || state.modeT > hold;
      const beat = flying && frame % 2 === 1 ? 0.4 : 1;
      const yaw = state.modeT <= outLen(state) + WAIT / 2 ? Math.atan2(state.tx - state.ox, state.tz - state.oz) : Math.atan2(state.fx - state.tx, state.fz - state.tz);
      fly(x, y, z, yaw, 0, 0, 1, m);
      m[0]! *= beat; m[1]! *= beat; m[2]! *= beat;
      ctx.instance.setMatrix(m);
      if (state.modeT >= hold + backLen(state)) {
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
  dispose(state, ctx) {
    // Its home has gone (or the town has): it flies off, unless it is not out to be seen.
    const v = ctx.item.variant ?? 'sparrow';
    const table = scaresOf(ctx.stage);
    if (state.shown && table.towns > 0) {
      const fright = table.latest() ?? undefined;
      const from = state.m[15] === 1 ? state.m : ctx.instance.base;
      flyOff(ctx.stage, LOOK[v] ?? LOOK.sparrow!, from, ctx.seed, fright);
      state.ducklings.forEach((_, i) => flyOff(ctx.stage, LOOK.duckling!, from, ctx.seed + i + 1, fright));
    }
    for (const d of state.ducklings) d.release();
  },
});
