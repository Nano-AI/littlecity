// L07: windows through the night. One 'window-light' actor stands for a
// whole house.
//
// The page lights window panes itself as its glow rises through dusk
// (src/render/shaders/surface.ts), at brightness "page glow × the
// structure's param a"; param c brings a shop's panes forward; param d is a
// height below which the house's panes are dark (downstairs gone to bed).
// This behaviour owns those params for its house:
//
//   dusk        homes come on one after another over 20 s (seeded); shops
//               and inns first, at once
//   the night   inns stay lit. Shops go dark when they shut. Through the
//               first half of the night the other homes go to bed one at a
//               time, downstairs first, upstairs a little later, until only
//               the owls (about one house in six) are lit. An owl's light
//               goes out for a while now and then; a sleeper's comes on for
//               a while: spells of DUSKY.nightSpell seconds of life time, so
//               a night held still (the sun button) still changes a little
//   before dawn the bakery lights first; at dawn early risers light up and
//               the owls put out their lights
//   nobody home dark (see occupancy.ts; default: everyone is home)
//
// To hold a param on a baked structure it keeps the structure lifted
// (LifeStage.liftStructure: no geometry is rebuilt) for as long as the
// params are not the default, and lets go by day.

import { CELL_H } from '@/core/grid';
import { rand } from '@/core/rand';
import { DUSKY } from '@/style/animation';
import { defineBehaviour, type InstanceHandle } from '../api';
import { approach } from '../motion/ease';
import { dawnProgress, eveningSeconds, nightProgress } from './evening';
import { canGlow, glowOf } from './glow';
import { isOccupied, setHouseGlow } from './occupancy';
import type { TimeSignal } from '../api';

/** Seconds over which the homes of a town come on (catalogue L07). */
export const RAMP = 20;
/** How far through the night the bakery lights. */
export const BAKER_AT = 0.8;

export interface HouseLight {
  /** 0–1: when in the ramp it lights. */
  order: number;
  shop: boolean;
  inn: boolean;
  baker: boolean;
  owl: boolean;
  /** 0–1 through the night: when it goes to bed. */
  bedtime: number;
  /** 0–1 through dawn when it lights up again; above 1 = sleeps in. */
  early: number;
  storeys: number;
  /** The house's own seed: which spells of the night it is up or down. */
  seed: number;
}

/** What a house's windows are doing: lit or not, and how many storeys from the ground are dark. */
export interface Lit {
  on: 0 | 1;
  dark: number;
}

const OFF: Lit = { on: 0, dark: 0 };
const ON: Lit = { on: 1, dark: 0 };

/** Which spell of the night it is, for a house (spells start at a different moment for each). */
const spell = (h: HouseLight, seconds: number): number => Math.floor(seconds / DUSKY.nightSpell + rand(h.seed, 'spell-phase'));

/** Whether a house wants its lights on at this time, and which storeys. Pure. */
export function windowLight(h: HouseLight, time: TimeSignal, occupied: boolean): Lit {
  if (time.isDay) return OFF;
  if (h.inn) return ON; // the inn is open, whoever is in
  if (!occupied) return OFF;
  if (time.isDawn) {
    const dp = dawnProgress(time);
    if (h.baker) return dp < 0.7 ? ON : OFF;
    if (h.owl) return dp < 0.5 ? ON : OFF;
    return dp >= h.early ? ON : OFF;
  }
  const np = nightProgress(time);
  if (h.baker && np >= BAKER_AT) return ON;
  if (h.shop) return np > 0 ? OFF : ON; // shut for the night
  if (eveningSeconds(time) < h.order * RAMP) return OFF;
  if (np === 0) return ON;
  const s = spell(h, time.seconds);
  if (h.owl) return np > 0.15 && rand(h.seed, 'owl-off', s) < DUSKY.owlOff ? OFF : ON;
  if (np <= h.bedtime) return ON;
  if (np <= h.bedtime + DUSKY.upstairsLater && h.storeys > 1) return { on: 1, dark: h.storeys - 1 };
  // Asleep; now and then somebody is up for a while, upstairs.
  if (np > 0.5 && rand(h.seed, 'wake', s) < DUSKY.wakeUp) return { on: 1, dark: Math.max(0, h.storeys - 1) };
  return OFF;
}

/** The old question, for callers that only want on or off. */
export function wantsLight(h: HouseLight, time: TimeSignal, occupied: boolean): number {
  return windowLight(h, time, occupied).on;
}

/** How far a shop's panes lead the page's own order (param c of the structure): grows over DUSKY.shopRamp. */
export const SHOP_LEAD = 0.75;
export function shopLead(h: HouseLight, time: TimeSignal): number {
  if (!(h.shop || h.inn) || time.isDay) return 0;
  return DUSKY.shopRamp > 0 ? SHOP_LEAD * Math.min(1, eveningSeconds(time) / DUSKY.shopRamp) : SHOP_LEAD;
}

/** A house's light plan from its actor's params. */
export function houseOf(p: Record<string, unknown>, seed: number): HouseLight {
  const n = (k: string, d: number): number => (typeof p[k] === 'number' ? (p[k] as number) : d);
  return {
    order: n('order', 0),
    shop: n('shop', 0) === 1,
    inn: n('inn', 0) === 1,
    baker: n('baker', 0) === 1,
    owl: n('owl', 0) === 1,
    bedtime: n('bedtime', 2),
    early: n('early', 2),
    storeys: Math.max(1, n('storeys', 1)),
    seed,
  };
}

interface State {
  house: HouseLight;
  level: number;
  /** Storeys dark from the ground. */
  dark: number;
  /** The lowest floor of the house, world y. */
  floor: number;
  lift: InstanceHandle | null;
  /** The structure the lift holds. */
  held: number;
}

export default defineBehaviour({
  actor: 'window-light',
  create(item, ctx): State {
    const floor = ctx.instance.base[13] ?? 0;
    return { house: houseOf(item.params ?? {}, ctx.seed), level: -1, dark: 0, floor, lift: null, held: -1 };
  },
  changed(state, ctx) {
    state.house = houseOf(ctx.item.params ?? {}, ctx.seed);
    state.floor = ctx.instance.base[13] ?? 0;
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
      state.dark = 0;
      setHouseGlow(ctx.stage, home, 1, 0);
      return;
    }
    const want = windowLight(state.house, time, isOccupied(ctx.stage, home));
    // The first drawing of an evening (or of a town opened at night) starts where it should be.
    state.level = state.level < 0 ? want.on : approach(state.level, want.on, DUSKY.houseFade > 0 ? dt / DUSKY.houseFade : 1);
    // A light switched off on one floor: at once, like a switch.
    if (want.on === 1) state.dark = want.dark;
    setHouseGlow(ctx.stage, home, state.level, state.dark);
    const lead = shopLead(state.house, time);
    if (state.level >= 1 && lead === 0 && state.dark === 0 && !state.lift) return; // fully lit is the default: nothing to hold
    if (!state.lift || state.held !== home) {
      state.lift?.release();
      state.lift = ctx.stage.liftStructure(home);
      state.held = home;
    }
    // Param d: the height below which panes are dark (0: none).
    const below = state.dark > 0 ? state.floor + state.dark * CELL_H - 0.02 : 0;
    state.lift?.setParams(state.level, 0, lead, below);
  },
  dispose(state) {
    if (state.lift) {
      state.lift.setParams(1);
      state.lift.release();
    }
  },
});
