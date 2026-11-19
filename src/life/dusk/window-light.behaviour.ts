// L07: windows at dusk. One 'window-light' actor stands for a whole house.
//
// The page lights window panes itself, pane by pane in seeded order, as its
// glow rises through dusk (src/render/shaders/surface.ts), at brightness
// "page glow × the structure's param a". This behaviour owns that param for
// its house:
//
//   shops and inns   a = 1 from the start: their panes are the first to show
//   a home           a = 0 until its turn (a seeded moment in the 20 s after
//                    lights can first be lit), then it fades up: houses come
//                    on one after another down the street
//   nobody home      a = 0 (see occupancy.ts; default: everyone is home)
//   late at night    most homes go to bed at a seeded hour; a few stay up
//
// To hold a param on a baked structure it keeps the structure lifted
// (LifeStage.liftStructure: no geometry is rebuilt) for as long as the
// param is not the default, and lets go by day.

import { DUSKY } from '@/style/animation';
import { defineBehaviour, type InstanceHandle } from '../api';
import { approach } from '../motion/ease';
import { dawnProgress, eveningSeconds, nightProgress } from './evening';
import { canGlow, glowOf } from './glow';
import { isOccupied } from './occupancy';
import type { TimeSignal } from '../api';

/** Seconds over which the homes of a town come on (catalogue L07). */
export const RAMP = 20;

export interface HouseLight {
  /** 0–1: when in the ramp it lights. */
  order: number;
  shop: boolean;
  /** 0–1 through the night; above 1 = up all night. */
  bedtime: number;
}

/** Whether a house wants its lights on at this time (0 or 1). Pure. */
export function wantsLight(h: HouseLight, time: TimeSignal, occupied: boolean): number {
  if (!occupied) return 0;
  if (time.isDay) return 0;
  // Whoever went to bed stays in bed through dawn; whoever stayed up puts the light out as day comes.
  if (time.isDawn) return h.bedtime > 1 && dawnProgress(time) < 0.5 ? 1 : 0;
  if (nightProgress(time) > h.bedtime) return 0;
  if (h.shop) return 1;
  return eveningSeconds(time) >= h.order * RAMP ? 1 : 0;
}

interface State {
  house: HouseLight;
  level: number;
  lift: InstanceHandle | null;
  /** The structure the lift holds. */
  held: number;
}

export default defineBehaviour({
  actor: 'window-light',
  create(item): State {
    const p = item.params ?? {};
    return { house: { order: p.order ?? 0, shop: p.shop === 1, bedtime: p.bedtime ?? 2 }, level: -1, lift: null, held: -1 };
  },
  changed(state, ctx) {
    const p = ctx.item.params ?? {};
    state.house = { order: p.order ?? 0, shop: p.shop === 1, bedtime: p.bedtime ?? 2 };
  },
  update(state, dt, signals, ctx) {
    const time = signals.time;
    const home = ctx.item.home;
    if (home === undefined) return;
    if (!canGlow(glowOf(time))) {
      // Day: nothing can glow, so the house needs no param of its own.
      if (state.lift) {
        state.lift.setParams(1);
        state.lift.release();
        state.lift = null;
      }
      state.level = -1;
      return;
    }
    const want = wantsLight(state.house, time, isOccupied(ctx.stage, home));
    // The first drawing of an evening (or of a town opened at night) starts where it should be.
    state.level = state.level < 0 ? want : approach(state.level, want, DUSKY.houseFade > 0 ? dt / DUSKY.houseFade : 1);
    if (state.level >= 1 && !state.lift) return; // fully lit is the default: nothing to hold
    if (!state.lift || state.held !== home) {
      state.lift?.release();
      state.lift = ctx.stage.liftStructure(home);
      state.held = home;
    }
    state.lift?.setParams(state.level);
  },
  dispose(state) {
    if (state.lift) {
      state.lift.setParams(1);
      state.lift.release();
    }
  },
});
