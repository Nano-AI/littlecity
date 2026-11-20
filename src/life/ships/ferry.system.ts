// Small boats never vanish ("Boats and ships": nothing ever vanishes). When
// the plan loses a rowboat, sailboat, fishing boat or rower (its dock was
// taken away, the water it lay in was filled, its lane was walled off), a
// stand-in takes its exact place on the same frame and makes for the edge of
// the map along open water, and out through it (the renderer cuts it off at
// the edge, so it goes bow first and never shrinks):
//
//   rowboat   someone rows it away (it is drawn as the rower, L20)
//   rower     rows away
//   sailboat  sails away, its sails trimmed to the wind
//   fishing   motors away
//
// If something now stands on the water it floats in, it is nudged aside to
// the nearest open water first. Shut into a pool with no way out, it stays
// there afloat, a resident, until a way opens. Only with no water left at
// all does it go, in the removal puff (puff.ts).
//
// The behaviours tell this system where each boat is drawn (notePose).

import { columnIndex, SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import type { Mat4, Mat4Like } from '@/core/mat4';
import type { Actor } from '@/resolve/plan';
import { mapEdge } from '@/rules/life/ship-routes';
import { routeLength, alongRoute, waterMask, waterRoute, type Pt } from '@/rules/life/waterway';
import { TERRAIN } from '@/style/terrain';
import { defineSystem, type InstanceHandle, type LifeStage, type Signals } from '../api';
import { Sails } from '../boats/sails';
import { swellAt, wakeRing, type Swell } from '../boats/afloat';
import { angleDelta, easeInOut, glide } from '../motion/ease';
import { fly, yawOf } from '../motion/pose';
import { removalPuff } from './puff';

const TYPES = new Set(['rowboat', 'sailboat', 'fishing-boat', 'rower']);
const poses = new WeakMap<LifeStage, Map<string, Mat4>>();

/** A small boat's behaviour says where it drew the boat (so a stand-in can take its place if it goes). */
export function notePose(stage: LifeStage, id: string, m: Mat4Like): void {
  let map = poses.get(stage);
  if (!map) poses.set(stage, (map = new Map()));
  let at = map.get(id);
  if (!at) map.set(id, (at = new Array<number>(16).fill(0)));
  for (let i = 0; i < 16; i++) at[i] = m[i]!;
}

interface Leaver {
  type: string;
  hull: InstanceHandle;
  sails: Sails | null;
  /** 'nudge' to free water, then 'away' along the route, or 'resident' (no way out). */
  mode: 'nudge' | 'away' | 'resident';
  route: Pt[];
  len: number;
  s: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
  from: [number, number];
  to: [number, number];
  t: number;
  swell: Swell;
  phase: number;
  wake: number;
  gone: boolean;
  m: Mat4;
}

interface State {
  leavers: Leaver[];
  water: Uint8Array | null;
  n: number;
}

const free = (m: Uint8Array, x: number, z: number): boolean => x >= 0 && z >= 0 && x < SIZE_X && z < SIZE_Z && m[columnIndex(Math.floor(x), Math.floor(z))] === 1;

/** The way from (x, z) out through the nearest straight side of the map's edge, beyond it; null if shut in. */
function wayOut(water: Uint8Array, x: number, z: number): Pt[] | null {
  const keep = Math.ceil(TERRAIN.slabRadius + 1.5);
  let best: Pt[] | null = null, bestLen = Infinity;
  const tries: [number, number, number, number][] = [];
  for (let v = keep; v <= SIZE_X - keep; v += 3) tries.push([v + 0.5, 0.5, 0, -1], [v + 0.5, SIZE_Z - 0.5, 0, 1], [0.5, v + 0.5, -1, 0], [SIZE_X - 0.5, v + 0.5, 1, 0]);
  // Nearest sides first, so only a few routes are worked out.
  tries.sort((a, b) => Math.hypot(a[0] - x, a[1] - z) - Math.hypot(b[0] - x, b[1] - z));
  for (const [ex, ez, ox, oz] of tries.slice(0, 16)) {
    if (!free(water, ex, ez)) continue;
    const r = waterRoute(water, [x, z], [ex, ez], 0.2);
    if (!r) continue;
    const len = routeLength(r);
    if (len < bestLen) {
      bestLen = len;
      best = [...r, [ex + ox * 3, ez + oz * 3]];
    }
    if (best && bestLen < Math.hypot(ex - x, ez - z) * 1.3) break;
  }
  return best;
}

function nearestWater(water: Uint8Array, x: number, z: number): [number, number] | null {
  for (let r = 0; r <= 6; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz;
        if (free(water, cx, cz)) return [cx + 0.5, cz + 0.5];
      }
    }
  }
  return null;
}

function spawnLeaver(stage: LifeStage, actor: Actor, m: Mat4, water: Uint8Array, seed: number): Leaver | null {
  const look = Math.abs(Math.round((actor.params as { look?: number } | undefined)?.look ?? 0));
  const x = m[12]!, z = m[14]!;
  // A moored rowboat is rowed away: drawn with someone at the oars.
  const type = actor.type === 'rowboat' ? 'rower' : actor.type;
  const hull = stage.spawn({ actor: type as 'rower', params: { look } }, m);
  const sails = actor.type === 'sailboat' ? new Sails(stage, look, m) : null;
  const l: Leaver = {
    type, hull, sails, mode: 'away', route: [], len: 0, s: 0, speed: 0, x, z, yaw: yawOf(m), from: [x, z], to: [x, z], t: 0,
    swell: { heave: 0, roll: 0, pitch: 0 }, phase: (look * 0.29) % 1, wake: 0, gone: false, m: Array.from(m),
  };
  if (!free(water, x, z)) {
    const to = nearestWater(water, x, z);
    if (!to) {
      removalPuff(stage, seed, x, SEA_Y + 0.3, z, 0.8, look);
      hull.release();
      sails?.release();
      return null;
    }
    l.mode = 'nudge';
    l.to = to;
    return l;
  }
  plan(l, water);
  return l;
}

function plan(l: Leaver, water: Uint8Array): void {
  const r = wayOut(water, l.x, l.z);
  if (!r) {
    l.mode = 'resident';
    return;
  }
  l.mode = 'away';
  l.route = r;
  l.len = routeLength(r);
  l.s = 0;
}

function step(l: Leaver, dt: number, signals: Signals, stage: LifeStage, water: Uint8Array | null): void {
  l.t += dt;
  const fast = l.type === 'sailboat' || l.type === 'fishing-boat' ? 0.9 : 0.5;
  if (l.mode === 'nudge') {
    const k = easeInOut(Math.min(1, l.t / 1.5));
    l.x = l.from[0] + (l.to[0] - l.from[0]) * k;
    l.z = l.from[1] + (l.to[1] - l.from[1]) * k;
    if (l.t >= 1.5 && water) plan(l, water);
  } else if (l.mode === 'away') {
    l.speed += (fast - l.speed) * glide(0.8, dt);
    l.s = Math.min(l.len, l.s + l.speed * dt);
    const p = alongRoute(l.route, l.s);
    const px = l.x, pz = l.z;
    l.x = p.x;
    l.z = p.z;
    l.yaw += angleDelta(l.yaw, Math.atan2(p.dx, p.dz)) * glide(2.5, dt);
    l.wake += Math.hypot(l.x - px, l.z - pz);
    if (l.wake > 0.8) {
      l.wake = 0;
      wakeRing(stage, l.x - Math.sin(l.yaw) * 0.35, l.z - Math.cos(l.yaw) * 0.35, 0.12, 2.6, 1.6);
    }
    if (l.s >= l.len - 1e-6) l.gone = true;
  }
  const wind = signals.wind(l.x, l.z);
  swellAt(signals.time.seconds, l.phase, 0.8, wind.strength, l.swell);
  fly(l.x, SEA_Y + l.swell.heave, l.z, l.yaw, l.swell.pitch, l.swell.roll, 1, l.m);
  l.hull.setMatrix(l.m);
  // Cut off at the edge of the map as it goes out through it (its open hull's inside filled).
  const near = mapEdge(l.x + Math.sin(l.yaw) * 0.8, l.z + Math.cos(l.yaw) * 0.8) > -1.5;
  l.hull.setParams(1, 0, 0, near ? -2 : 0);
  if (l.sails) {
    const sin = Math.sin(l.yaw), cos = Math.cos(l.yaw);
    l.sails.trim(dt, wind.dirX * cos - wind.dirZ * sin, wind.dirX * sin + wind.dirZ * cos, wind.strength);
    l.sails.pose(l.m);
    l.sails.cutAtEdge(near);
  }
}

export default defineSystem<State>({
  id: 'ferry',
  order: 45,
  create(ctx) {
    const state: State = { leavers: [], water: null, n: 0 };
    onStage.set(ctx.stage, state);
    return state;
  },
  sync(state, next, prev, ctx) {
    state.water = waterMask(next.shape.facts);
    if (prev?.dressing && next.dressing) {
      const now = new Set(next.dressing.actors.map((a) => a.id));
      const at = poses.get(ctx.stage);
      for (const a of prev.dressing.actors) {
        // (A boat anchored to a cell is a still life for the gallery: it never sails off.)
        if (!TYPES.has(a.type) || now.has(a.id) || (a.at !== null && 'cell' in a.at)) continue;
        const m = at?.get(a.id);
        if (!m) continue;
        at!.delete(a.id);
        const l = spawnLeaver(ctx.stage, a, m, state.water, ctx.seed + state.n++);
        if (l) state.leavers.push(l);
      }
    }
    // Residents (shut in) try again; boats whose water was just filled are nudged aside.
    for (const l of state.leavers) {
      if (l.mode === 'resident') plan(l, state.water);
      else if (!free(state.water, l.x, l.z) && l.mode !== 'nudge') {
        const to = nearestWater(state.water, l.x, l.z);
        if (!to) {
          removalPuff(ctx.stage, ctx.seed, l.x, SEA_Y + 0.3, l.z, 0.8, state.n++);
          l.gone = true;
          continue;
        }
        l.mode = 'nudge';
        l.from = [l.x, l.z];
        l.to = to;
        l.t = 0;
      } else if (l.mode === 'away') plan(l, state.water);
    }
  },
  update(state, dt, signals, ctx) {
    for (const l of state.leavers) step(l, dt, signals, ctx.stage, state.water);
    for (let i = state.leavers.length - 1; i >= 0; i--) {
      const l = state.leavers[i]!;
      if (!l.gone) continue;
      l.hull.release();
      l.sails?.release();
      state.leavers.splice(i, 1);
    }
  },
  dispose(state) {
    for (const l of state.leavers) {
      l.hull.release();
      l.sails?.release();
    }
    state.leavers = [];
  },
});

const onStage = new WeakMap<LifeStage, State>();
/** For tests: the small boats on their way out (and the residents) on a stage, where each is. */
export function leaversOf(stage: LifeStage): readonly { type: string; x: number; z: number; mode: string }[] {
  return onStage.get(stage)?.leavers ?? [];
}
