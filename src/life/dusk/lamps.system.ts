// Lamps at dusk. Any prop of a lamp type in the vocabulary ('lamp',
// 'hanging-lantern') comes on in the evening and goes out at dawn; this
// system needs nothing from the rule that placed it but its type.
//
// Lamps along one street light one after another, LAMP_GAP seconds apart,
// from one end to the other; each street starts at its own seeded moment in
// the first few seconds of the evening. A lamp catches with a flicker.
// At dawn they go out the same way, quickly.
//
// How a lamp is lit: its glass is PATTERN.glow, which the page shows at
// "page glow × the instance's param a"; see glow.ts.
//
// For the lamplighter (L08, People): `lightLamp(stage, propId)` lights one
// lamp now, ahead of its turn.

import { CELL_H, key } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { rand } from '@/core/rand';
import type { PropType } from '@/core/vocab';
import type { DressingPlan, ShapePlan } from '@/resolve/plan';
import { DUSKY, MOTION } from '@/style/animation';
import { defineSystem, type InstanceHandle, type LifeStage } from '../api';
import { dawnProgress, eveningSeconds } from './evening';
import { canGlow, glowOf, litParam } from './glow';

/** The prop types that are lamps. */
export const LAMP_TYPES: ReadonlySet<PropType> = new Set<PropType>(['lamp', 'hanging-lantern']);

interface Lamp {
  id: string;
  handle: InstanceHandle | null;
  /** Seconds into the evening at which it lights. */
  at: number;
  /** Lit early by hand (the lamplighter). */
  early: boolean;
  /** The param last written (NaN: never). */
  shown: number;
}
interface State {
  lamps: Lamp[];
  byId: Map<string, Lamp>;
  dressing: DressingPlan | null;
  /** The evening they were lit early in: forgotten by day. */
  wasDay: boolean;
}

const tables = new WeakMap<LifeStage, State>();

/** Lights one lamp now (if it is evening), ahead of its turn. Returns false if there is no such lamp. */
export function lightLamp(stage: LifeStage, propId: string): boolean {
  const lamp = tables.get(stage)?.byId.get(propId);
  if (!lamp) return false;
  lamp.early = true;
  return true;
}

/**
 * Keeps a lamp dark until `seconds` into the evening, unless lightLamp comes first: it is on the
 * lamplighter's round (L08), and waits for them that long. Call it after every dressing sync (a sync
 * works the timetable out afresh). Added by People. Returns false if there is no such lamp.
 */
export function deferLamp(stage: LifeStage, propId: string, seconds: number): boolean {
  const lamp = tables.get(stage)?.byId.get(propId);
  if (!lamp) return false;
  if (!lamp.early) lamp.at = Math.max(lamp.at, seconds);
  return true;
}

/** When each lamp of a town lights, in seconds into the evening. Pure, for the system and for tests. */
export function lampOrder(shape: ShapePlan, lamps: readonly { id: string; pos: readonly [number, number, number] }[], seed: number): Map<string, number> {
  const streets = new Map<string, { id: string; pos: readonly [number, number, number] }[]>();
  for (const l of lamps) {
    const cell = key(Math.floor(l.pos[0]), Math.max(0, Math.round(l.pos[1] / CELL_H)), Math.floor(l.pos[2]));
    const floor = shape.floorAt.get(cell);
    // Lamps not on a floor (a pier end, a bridge) form little groups by where they are.
    const group = floor !== undefined ? `f${floor}` : `g${Math.floor(l.pos[0] / 6)}:${Math.floor(l.pos[2] / 6)}`;
    const list = streets.get(group);
    if (list) list.push(l);
    else streets.set(group, [l]);
  }
  const out = new Map<string, number>();
  for (const [group, list] of streets) {
    // Along the street: by its longer extent.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const l of list) {
      x0 = Math.min(x0, l.pos[0]); x1 = Math.max(x1, l.pos[0]);
      z0 = Math.min(z0, l.pos[2]); z1 = Math.max(z1, l.pos[2]);
    }
    const alongX = x1 - x0 >= z1 - z0;
    const flip = rand(seed, 'lamps', group, 'end') < 0.5 ? 1 : -1;
    list.sort((a, b) => flip * (alongX ? a.pos[0] - b.pos[0] || a.pos[2] - b.pos[2] : a.pos[2] - b.pos[2] || a.pos[0] - b.pos[0]) || (a.id < b.id ? -1 : 1));
    const start = rand(seed, 'lamps', group, 'start') * DUSKY.lampSpread;
    // A long street does not take all night: its gap shrinks so it is done in about 15 seconds.
    const gap = Math.min(DUSKY.lampGap, 15 / Math.max(1, list.length - 1));
    list.forEach((l, i) => out.set(l.id, start + i * gap));
  }
  return out;
}

/** How bright a lamp is `since` seconds after it was lit: it catches, dips, and burns. Drawn on twos. */
export function catching(since: number): number {
  if (since < 0) return 0;
  const t = DUSKY.lampCatch <= 0 ? 1 : since / DUSKY.lampCatch;
  if (t >= 1) return 1;
  const frame = Math.floor(t * DUSKY.lampCatch * MOTION.poseFps);
  return [0.75, 0.3, 0.9, 0.55, 1][Math.min(4, frame)]!;
}

export default defineSystem<State>({
  id: 'dusk.lamps',
  order: 20,
  create(ctx) {
    const state: State = { lamps: [], byId: new Map(), dressing: null, wasDay: true };
    tables.set(ctx.stage, state);
    return state;
  },
  sync(state, next, _prev, ctx) {
    const dressing = next.dressing;
    if (!dressing || dressing === state.dressing) return;
    state.dressing = dressing;
    const found: { id: string; pos: [number, number, number]; handle: InstanceHandle | null }[] = [];
    for (const p of dressing.props) {
      if (!LAMP_TYPES.has(p.type)) continue;
      const handle = ctx.stage.instance(p.id);
      found.push({ id: p.id, handle, pos: handle ? positionOf(handle.base) : [0, 0, 0] });
    }
    const order = lampOrder(next.shape, found, ctx.seed);
    const byId = new Map<string, Lamp>();
    state.lamps = found.map((f) => {
      const lamp: Lamp = { id: f.id, handle: f.handle, at: order.get(f.id) ?? 0, early: state.byId.get(f.id)?.early ?? false, shown: NaN };
      byId.set(f.id, lamp);
      return lamp;
    });
    state.byId = byId;
  },
  update(state, _dt, signals) {
    if (state.lamps.length === 0) return;
    const time = signals.time;
    const glow = glowOf(time);
    if (!canGlow(glow)) {
      if (state.wasDay) return;
      state.wasDay = true;
      for (const l of state.lamps) {
        l.early = false;
        l.shown = 1;
        l.handle?.setParams(1); // nothing glows by day; leave the default behind
      }
      return;
    }
    state.wasDay = false;
    const evening = eveningSeconds(time);
    const dawn = dawnProgress(time);
    for (let i = 0; i < state.lamps.length; i++) {
      const l = state.lamps[i]!;
      let level: number;
      if (time.isDawn) {
        // Out in the order they came on, over the first third of dawn.
        level = dawn * 3 > (l.at % 15) / 15 ? 0 : 1;
      } else {
        if (l.early && evening < l.at) l.at = evening;
        level = catching(evening - l.at);
      }
      const a = litParam(level, glow);
      if (a !== l.shown) {
        l.shown = a;
        l.handle?.setParams(a);
      }
    }
  },
  dispose(_state, ctx) {
    tables.delete(ctx.stage);
  },
});
