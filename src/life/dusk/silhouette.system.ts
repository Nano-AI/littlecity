// L07: someone is home. In a lit window a resident's silhouette sometimes
// crosses, pauses, or draws a curtain: dark shapes against the warm pane,
// never more than a few in view at once.
//
// A handful of slots (SILHOUETTES.slots) take turns: each plays one act after
// another, every SILHOUETTES.period seconds, at a window chosen by seed among
// those lit now: a house window (not a shopfront, rose or slit) of a house
// whose light is fully up (houseGlowOf) on a storey that has not gone to bed
// (houseDarkOf), at night when every pane of a lit house is lit. If the
// light goes out under an act, the act ends with it: never a silhouette in
// a dark window.
//
//   cross    in at one side of the pane, across, out at the other
//   pause    in from one side to the middle, a moment, back out
//   curtain  a curtain drawn across half the pane, and back again
//
// Drawing: two spawned meshes per slot (a figure, a curtain), flat on the
// pane in the window socket's frame, their width scaled as they slide in at
// the pane's edge so they never spill over the frame. Deterministic: acts
// come from rand(seed, slot, act number) and life time.

import { keyY } from '@/core/grid';
import { multiply, type Mat4Like } from '@/core/mat4';
import { hash, rand } from '@/core/rand';
import type { MeshData } from '@/gen/mesh';
import { curtainMesh, silhouetteMesh } from '@/parts/people/extras';
import type { StructureId } from '@/resolve/plan';
import { defineSystem, type InstanceHandle } from '../api';
import { easeInOut } from '../motion/ease';
import { glowOf } from './glow';
import { houseDarkOf, houseGlowOf, isOccupied } from './occupancy';
import { houseOf, windowLight, type HouseLight } from './window-light.behaviour';

/** Window looks whose pane a figure fits inside (in the socket's frame: the sill, +Z out). */
const VARIANTS = new Set(['square', 'tall', 'arched', 'shuttered', undefined]);
/** The pane's inner box in the window socket's frame, and its depth (just proud of the glass). */
export const PANE = { x: 0.085, y0: 0.05, z: -0.0293 } as const;
const FIGURE = 0.14; // a whole figure's width: close to the glass, it fills most of the pane

export const SILHOUETTES = { slots: 4, period: 8 } as const;

export type Act = 'cross' | 'pause' | 'curtain';

export interface Window {
  socket: string;
  house: StructureId;
  /** Storeys above the house's lowest. */
  storey: number;
}

/** Where an act is at `t` seconds: the figure's middle and width (0: not shown), the curtain's width. Pure. */
export function actAt(act: Act, t: number, side: 1 | -1): { fx: number; fw: number; cw: number; done: boolean } {
  const edge = PANE.x;
  // Its width where its middle is: whole inside the pane, narrowing to nothing as it slides behind the frame.
  const width = (x: number): number => Math.max(0, Math.min(FIGURE, 2 * (edge - Math.abs(x))));
  if (act === 'cross') {
    const len = 2.6;
    if (t >= len) return { fx: 0, fw: 0, cw: 0, done: true };
    const x = -side * edge + side * 2 * edge * (t / len);
    return { fx: x, fw: width(x), cw: 0, done: false };
  }
  if (act === 'pause') {
    const len = 4.2;
    if (t >= len) return { fx: 0, fw: 0, cw: 0, done: true };
    const k = t < 1.1 ? easeInOut(t / 1.1) : t < 3.1 ? 1 : 1 - easeInOut((t - 3.1) / 1.1);
    const x = -side * edge * (1 - k);
    return { fx: x, fw: width(x), cw: 0, done: false };
  }
  const len = 6;
  if (t >= len) return { fx: 0, fw: 0, cw: 0, done: true };
  const k = t < 1.4 ? easeInOut(t / 1.4) : t < 4.6 ? 1 : 1 - easeInOut((t - 4.6) / 1.4);
  return { fx: 0, fw: 0, cw: edge * k, done: false };
}

/** Whether a window can show somebody now: its house fully lit, its storey awake, every pane lit (night). */
export function windowLit(level: number, dark: number, storey: number, glow: number): boolean {
  return level >= 0.98 && storey >= dark && glow >= 0.95;
}

interface Slot {
  figure: InstanceHandle | null;
  curtain: InstanceHandle | null;
  /** The act now playing: its number, window and kind. */
  act: number;
  window: Window | null;
  kind: Act;
  side: 1 | -1;
  /** Something of it is showing now (for tests and watching). */
  shown: boolean;
}

interface State {
  windows: Window[];
  /** Each house's light plan, as its window-light behaviour has it (the same pure function decides). */
  houses: Map<StructureId, HouseLight>;
  slots: Slot[];
  meshes: { figure: MeshData; curtain: MeshData } | null;
}

const scratch = new Array<number>(16).fill(0);

export default defineSystem<State>({
  id: 'dusk.silhouettes',
  order: 30,
  create: () => {
    const state: State = { windows: [], houses: new Map(), slots: [], meshes: null };
    // The debug handle for watching (like window.__lcPeople).
    (globalThis as { __lcSilhouettes?: State }).__lcSilhouettes = state;
    return state;
  },
  sync(state, next) {
    const base = new Map<StructureId, number>();
    for (const s of next.shape.structures.values()) {
      if (s.kind !== 'house') continue;
      let lo = Infinity;
      for (const c of s.cells) lo = Math.min(lo, keyY(c));
      base.set(s.id, lo);
    }
    const windows: Window[] = [];
    for (const f of next.shape.features) {
      if (f.type !== 'window' || f.cell === undefined || !VARIANTS.has(f.variant)) continue;
      const lo = base.get(f.structure);
      if (lo === undefined) continue;
      windows.push({ socket: `${f.id}/window`, house: f.structure, storey: keyY(f.cell) - lo });
    }
    windows.sort((a, b) => (a.socket < b.socket ? -1 : a.socket > b.socket ? 1 : 0));
    // Only houses with a window light (the plan's), so a silhouette is never in a house nobody lights.
    state.houses = new Map();
    for (const a of next.dressing?.actors ?? []) {
      if (a.type !== 'window-light' || a.home === undefined) continue;
      state.houses.set(a.home, houseOf((a.params ?? {}) as Record<string, unknown>, hash(next.shape.world.seed, a.id)));
    }
    state.windows = windows.filter((w) => state.houses.has(w.house));
    // A window that is gone ends its act.
    const live = new Set(windows.map((w) => w.socket));
    for (const s of state.slots) if (s.window && !live.has(s.window.socket)) s.window = null;
  },
  update(state, _dt, signals, ctx) {
    const glow = glowOf(signals.time);
    const now = signals.time.seconds;
    while (state.slots.length < SILHOUETTES.slots) state.slots.push({ figure: null, curtain: null, act: -1, window: null, kind: 'cross', side: 1, shown: false });
    // Lit as drawn last frame, and still to be lit this frame (the window behaviours run after systems).
    const lit = (w: Window): boolean => {
      const h = state.houses.get(w.house);
      if (!h) return false;
      const want = windowLight(h, signals.time, isOccupied(ctx.stage, w.house));
      return want.on === 1 && w.storey >= want.dark && windowLit(houseGlowOf(ctx.stage, w.house), houseDarkOf(ctx.stage, w.house), w.storey, glow);
    };
    state.slots.forEach((slot, k) => {
      const t0 = now / SILHOUETTES.period + k / SILHOUETTES.slots;
      const n = Math.floor(t0);
      const t = (t0 - n) * SILHOUETTES.period;
      if (n !== slot.act) {
        // A new act: a window lit now that no other slot is at, chosen by seed.
        slot.act = n;
        slot.window = null;
        const ws = state.windows;
        if (ws.length > 0 && glow >= 0.95 && rand(ctx.seed, 'sil', k, n) < 0.8) {
          const start = Math.floor(rand(ctx.seed, 'sil-at', k, n) * ws.length);
          const taken = new Set(state.slots.map((s) => s.window?.socket));
          for (let i = 0; i < ws.length; i++) {
            const w = ws[(start + i) % ws.length]!;
            if (taken.has(w.socket) || !lit(w)) continue;
            slot.window = w;
            break;
          }
          const r = rand(ctx.seed, 'sil-kind', k, n);
          slot.kind = r < 0.45 ? 'cross' : r < 0.8 ? 'pause' : 'curtain';
          slot.side = rand(ctx.seed, 'sil-side', k, n) < 0.5 ? 1 : -1;
        }
      }
      const w = slot.window;
      const frame: Mat4Like | null = w ? ctx.stage.socket(w.socket) : null;
      const a = w && frame && lit(w) ? actAt(slot.kind, t - 0.6, slot.side) : null;
      if (!a || a.done || t < 0.6) {
        if (w && frame && !lit(w)) slot.window = null; // the light went out: the act is over
        slot.figure?.setVisible(false);
        slot.curtain?.setVisible(false);
        slot.shown = false;
        return;
      }
      slot.shown = a.fw > 0.002 || a.cw > 0.002;
      state.meshes ??= { figure: silhouetteMesh(), curtain: curtainMesh() };
      const place = (h: InstanceHandle, x: number, w: number): void => {
        // The socket frame · T(x, y0, z) · S(w, 1, 1)
        scratch.fill(0);
        scratch[0] = Math.max(1e-4, w);
        scratch[5] = 1;
        scratch[10] = 1;
        scratch[12] = x;
        scratch[13] = PANE.y0;
        scratch[14] = PANE.z;
        scratch[15] = 1;
        h.setMatrix(multiply(frame!, scratch));
        h.setVisible(true);
      };
      if (a.fw > 0.002) {
        slot.figure ??= ctx.stage.spawnMesh(state.meshes.figure, frame!);
        place(slot.figure, a.fx, a.fw);
      } else slot.figure?.setVisible(false);
      if (a.cw > 0.002) {
        slot.curtain ??= ctx.stage.spawnMesh(state.meshes.curtain, frame!);
        // From the side the curtain is drawn from, toward the middle.
        place(slot.curtain, slot.side === 1 ? -PANE.x : PANE.x - a.cw, a.cw);
      } else slot.curtain?.setVisible(false);
    });
  },
  dispose(state) {
    for (const s of state.slots) {
      s.figure?.release();
      s.curtain?.release();
    }
    state.slots = [];
  },
});
