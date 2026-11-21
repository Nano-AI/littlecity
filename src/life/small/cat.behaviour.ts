// L33: a cat on its doorstep. By day it naps, curled low and long beside
// the door, breathing slowly, its ear twitching now and then. As dusk comes
// it wakes with a stretch, sits up and watches the street, turning its head
// to whatever caught its eye; at night it sits on. Dawn: back to sleep.
//
// Poses (breath, twitch, stretch, looks) are on twos; it does not travel,
// except when its house is wrecked: then it bolts, at a bound, to the door of
// the nearest house still standing and in at it (or off away from the
// trouble if there is none near); and when its house stands again (or is
// new) it comes out at its own door to its place on the step.
// Frame: the 'door' socket (on the ground outside the door, +Z out); it sits
// a little to one side of the threshold.

import { keyX, keyZ } from '@/core/grid';
import { compose, multiply, rotationY, scaling, translation, type Mat4Like } from '@/core/mat4';
import type { ShapePlan, StructureId } from '@/resolve/plan';
import { defineBehaviour, type LifeStage, type TimeSignal } from '../api';
import { scaresOf } from '../birds/scare';
import { wrecked } from '../birds/town';
import { fxOf } from '../fx/fx';
import { easeInOut } from '../motion/ease';
import { place } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { dogsOf } from '../town/chains/dogs';
import { critterPoseOf } from '../mischief/critters';

/** Seconds a cat takes to come out of its door to its place; how fast it bolts (units a second); how far it will run for a door. */
const COME_OUT = 1.1;
const BOLT = 3.2;
const BOLT_REACH = 9;

/** The door of the nearest house that stands, other than `home`, within reach of (x, z): where a bolting cat goes in. */
function refuge(stage: LifeStage, shape: ShapePlan, home: StructureId | undefined, x: number, z: number): [number, number, number] | null {
  const broken = wrecked(shape);
  let best: [number, number, number] | null = null;
  let bestD = BOLT_REACH;
  for (const sk of shape.sockets) {
    if (sk.type !== 'door' || sk.structure === undefined || sk.structure === home || broken.has(sk.structure)) continue;
    if (shape.structures.get(sk.structure)?.kind !== 'house') continue;
    const d = Math.hypot(keyX(sk.cell) + 0.5 - x, keyZ(sk.cell) + 0.5 - z);
    if (d >= bestD) continue;
    const f = stage.socket(sk.id);
    if (!f) continue;
    bestD = d;
    best = [f[12]!, f[13]!, f[14]!];
  }
  return best;
}

/** The cat bolts from `from` to (tx, ty, tz) at a bound, and is gone in at the door there (an effect: it outlives the item). */
function bolt(stage: LifeStage, look: number, from: Mat4Like, to: [number, number, number]): void {
  const x0 = from[12]!, y0 = from[13]!, z0 = from[14]!;
  const [tx, ty, tz] = to;
  const d = Math.hypot(tx - x0, tz - z0);
  const yaw = Math.atan2(tx - x0, tz - z0);
  fxOf(stage).play(
    { actor: 'cat', params: { look } },
    Math.max(0.4, d / BOLT),
    (t, out) => {
      const u = t * (2 - t) * 0.5 + t * 0.5; // off fast, slowing a touch at the door
      const bound = Math.abs(Math.sin(t * d * 4)) * 0.06;
      place(x0 + (tx - x0) * u, y0 + (ty - y0) * u + bound, z0 + (tz - z0) * u, yaw, 1, 1, 1.15, out);
    },
    { smooth: true },
  );
}

/** Awake (sitting up) at dusk and through the night; asleep by day and at dawn. */
export const catAwake = (time: TimeSignal): boolean => time.isDusk || time.isNight;

interface State {
  /** Coming out of its door to its place: seconds left. */
  out: number;
  side: number;
  awake: number;
  phase: number;
  drawn: number;
  /** Seconds left of being upset by a dog (L61). */
  spooked: number;
}

export default defineBehaviour({
  actor: 'cat',
  create(_item, ctx): State {
    // Made after the town opened (its house stands again, or is new): it comes out of the door.
    return { out: scaresOf(ctx.stage).towns > 1 ? COME_OUT : 0, side: ctx.rand('side') < 0.5 ? -1 : 1, awake: -1, phase: ctx.rand('phase'), drawn: NaN, spooked: 0 };
  },
  update(state, dt, signals, ctx) {
    // L61: a dog dashing up: up it leaps, back arched, and sits up awake a while.
    const base = ctx.instance.base;
    if (state.out > 0) {
      // Out of the door (it was just inside the threshold) and round to its place, awake.
      state.out = Math.max(0, state.out - dt);
      const u = easeInOut(1 - state.out / COME_OUT);
      state.awake = 1;
      state.drawn = NaN;
      ctx.instance.setMatrix(multiply(base, compose(translation(state.side * 0.24 * u, Math.abs(Math.sin(u * 9)) * 0.03 * (1 - u), -0.15 + 0.27 * u), rotationY(state.side * 0.6 * (1 - u)))));
      return;
    }
    // Mischief: blown about or in the Hand (src/life/mischief/critters.ts): drawn where that says, its own state left be.
    const held = critterPoseOf(ctx.stage, ctx.item.id, 'cat', multiply(base, translation(state.side * 0.24, 0, 0.12)), 0.16);
    if (held) {
      ctx.instance.setMatrix(held);
      state.drawn = NaN;
      return;
    }
    const dog = dogsOf(ctx.stage).find((d) => d.doing === 'chase' && Math.hypot(d.x - base[12]!, d.z - base[14]!) < 0.8);
    if (dog) state.spooked = 3;
    state.spooked = Math.max(0, state.spooked - dt);
    const want = catAwake(signals.time) || state.spooked > 0 ? 1 : 0;
    // Waking and settling take a couple of seconds (a stretch, a turn round).
    state.awake = state.awake < 0 ? want : state.awake + Math.sign(want - state.awake) * Math.min(Math.abs(want - state.awake), dt / 2);
    const p = onTwos(signals.time.seconds, state.phase);
    const w = easeInOut(state.awake);
    const breath = 1 + 0.03 * Math.sin(p * 1.6 + state.phase * 9) * (1 - w);
    const look = w * Math.sin(Math.floor(p / 2.3) * 2.1 + state.phase * 7) * 0.7;
    // Asleep: low and long, head turned along the step. Awake: upright, facing out.
    // The leap: up and arched while the dog is at it.
    const leap = state.spooked > 2.2 ? Math.sin(((3 - state.spooked) / 0.8) * Math.PI) * 0.18 : 0;
    const sx = 1 + 0.3 * (1 - w), sy = (0.55 + 0.45 * w) * breath * (state.spooked > 0 ? 1.15 : 1), sz = 1 + 0.25 * (1 - w);
    const turn = (1 - w) * state.side * 1.3 + look;
    const key = sx * 3.1 + sy * 7.3 + turn * 11.1 + leap * 13.7;
    if (key === state.drawn) return;
    state.drawn = key;
    ctx.instance.setMatrix(multiply(ctx.instance.base, compose(translation(state.side * 0.24, leap, 0.12), rotationY(turn), scaling(sx, sy, sz))));
  },
  dispose(state, ctx) {
    // Its house is wrecked (or gone): it bolts for another door, never just blinks out.
    if (scaresOf(ctx.stage).towns === 0) return;
    const base = ctx.instance.base;
    const from = multiply(base, translation(state.side * 0.24, 0, 0.12));
    const at = ctx.item.at;
    const sock = at && 'socket' in at ? ctx.shape.sockets.find((k) => k.id === at.socket) : undefined;
    let to = refuge(ctx.stage, ctx.shape, sock?.structure, from[12]!, from[14]!);
    if (!to) {
      // Nowhere near to go in: off along the street, away from the trouble, round the corner.
      const fright = scaresOf(ctx.stage).latest();
      let dx = base[8]!, dz = base[10]!;
      if (fright) {
        const ax = from[12]! - fright.x, az = from[14]! - fright.z, n = Math.hypot(ax, az);
        if (n > 0.5) {
          dx = ax / n;
          dz = az / n;
        }
      }
      to = [from[12]! + dx * 6, from[13]!, from[14]! + dz * 6];
    }
    bolt(ctx.stage, Number(ctx.item.params?.look ?? 0), from, to);
  },
});
