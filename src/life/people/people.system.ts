// The people system (People, Stage 3): runs the crowd (crowd.ts) and draws
// it. One system for the whole town, because who walks where is a town-wide
// matter (routes, queues, who is home), not one actor's.
//
// Drawing: each person is five rigid pieces (src/parts/people/person.ts)
// spawned on the stage, posed every frame with matrices (pose.ts). Nothing
// is re-meshed while they walk. The `resident` actors the plan places at
// each front door are the same people standing still; this system hides
// those instances and draws its own, so a town shown without life still has
// its residents at their doors.

import { DIR4, keyX, keyZ } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { defineSystem, type InstanceHandle, type LifeStage, type Signals, type SignalsDriver } from '@/life/api';
import type { MeshData } from '@/gen/mesh';
import { bubbleMesh, kiteMesh, lineMesh } from '@/parts/people/extras';
import { buildPerson, DESIGN_HEIGHT, lookOf, PIECES, rigOf, type Look, type Rig } from '@/parts/people/person';
import { poseOf, rigMatrices, sitDrop } from '@/parts/people/pose';
import type { NavDoor } from '@/resolve/plan';
import { PEOPLE, PERSON } from '@/style/people';
import { createCrowd, type Crowd, type Person } from './crowd';
import { markCensusReady, recordHome } from './home';

interface Drawn {
  look: Look;
  rig: Rig;
  handles: InstanceHandle[] | null;
  shown: boolean;
  /** What was last sent to the stage, to leave a still figure alone. */
  last: Float32Array;
  /** The chat bubble over their head while they talk. */
  bubble: InstanceHandle | null;
  /** A child's kite and its line (L28). */
  kite: { kite: InstanceHandle; line: InstanceHandle } | null;
}

interface State {
  crowd: Crowd;
  drawn: Map<Person, Drawn>;
  bubbleMesh: MeshData | null;
  lineMesh: MeshData | null;
  /** The plan's own resident instances, kept hidden. */
  standIns: InstanceHandle[];
  /** The drawing last shown (see update), and whether the town changed since, which draws at once. */
  tick: number;
  fresh: boolean;
  unsubscribe: () => void;
}

const local = new Float32Array(80);
const world = new Float32Array(80);
const IDENTITY: Mat4Like = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** The resident cap for this device (L21): 60, or 30 on a phone-sized viewport. */
export function residentCap(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  const h = (globalThis as { innerHeight?: number }).innerHeight;
  if (typeof w === 'number' && typeof h === 'number' && Math.min(w, h) < PEOPLE.phoneSide) return PEOPLE.capPhone;
  return PEOPLE.cap;
}

function emit<E extends 'personPassed' | 'residentHome' | 'lampReached' | 'bellRung'>(signals: Signals, event: E, payload: Parameters<SignalsDriver['emit']>[1]): void {
  (signals as Partial<SignalsDriver>).emit?.(event, payload as never);
}

function draw(p: Person, d: Drawn, stage: LifeStage, gust: boolean): void {
  const visible = p.visible && p.fade > 0.02;
  if (!visible) {
    if (d.shown && d.handles) for (const h of d.handles) h.setVisible(false);
    d.shown = false;
    return;
  }
  if (!d.handles) {
    // Built the first time they are seen, so a town of sixty does not mesh sixty people in one frame.
    const meshes = buildPerson(d.look, p.id);
    d.handles = PIECES.map((piece) => stage.spawnMesh(meshes[piece], IDENTITY));
    d.shown = true;
  }
  const name = p.react ?? p.pose;
  const walking = name === 'walk' || name === 'run';
  const pose = poseOf(name, walking ? p.stride : p.poseTime, p.rank);
  // L26: a strong gust, and a hand goes to the hat.
  if (gust && d.look.hat !== 'none' && (walking || name === 'stand')) {
    pose.armR = 2.95;
    pose.outR = -0.2;
  }
  if (walking && p.carrying) {
    // Arms full: a sack, a tray.
    pose.armL = pose.armR = 1.25;
    pose.outL = pose.outR = -0.2;
  }
  const sitting = name === 'sit' && p.seat >= 0;
  const scale = d.look.scale * (0.35 + 0.65 * p.fade);
  rigMatrices(d.look, pose, local, sitting ? sitDrop(d.rig, p.seat / scale) : 0, d.rig);
  // world = T(x, y, z) · Ry(heading) · S(scale) · local
  const c = Math.cos(p.heading) * scale, s = Math.sin(p.heading) * scale;
  for (let i = 0; i < 5; i++) {
    const k = i * 16;
    for (let col = 0; col < 4; col++) {
      const o = k + col * 4;
      const lx = local[o]!, ly = local[o + 1]!, lz = local[o + 2]!;
      world[o] = c * lx + s * lz + (col === 3 ? p.x : 0);
      world[o + 1] = scale * ly + (col === 3 ? p.y + p.lift : 0);
      world[o + 2] = -s * lx + c * lz + (col === 3 ? p.z : 0);
      world[o + 3] = col === 3 ? 1 : 0;
    }
  }
  // A still figure is left alone: nothing moved, so the page need not redraw its shade.
  let same = d.shown;
  for (let i = 0; same && i < 80; i++) same = d.last[i] === world[i];
  if (!d.shown) {
    for (const h of d.handles) h.setVisible(true);
    d.shown = true;
  }
  if (same) return;
  d.last.set(world);
  for (let i = 0; i < 5; i++) d.handles[i]!.setMatrix(world.subarray(i * 16, i * 16 + 16));
}

export default defineSystem<State>({
  id: 'people',
  order: 20,
  create(ctx) {
    const drawn = new Map<Person, Drawn>();
    const doorAt = (door: NavDoor): { x: number; z: number } | null => {
      if (door.socket === undefined || door.dir === undefined) return null;
      const m = ctx.stage.socket(door.socket);
      if (!m) return null;
      // Only a frame that really is at this door's face (a stage with no layout answers with the origin).
      const [dx, dz] = DIR4[door.dir]!;
      const fx = keyX(door.cell) + 0.5 + dx * 0.5, fz = keyZ(door.cell) + 0.5 + dz * 0.5;
      const x = m[12]!, z = m[14]!;
      return Math.abs(x - fx) < 0.8 && Math.abs(z - fz) < 0.8 ? { x, z } : null;
    };
    const crowd = createCrowd({
      cap: residentCap(),
      doorAt,
      wind: (x, z) => ctx.signals.wind(x, z),
      seatAt(socket) {
        const m = ctx.stage.socket(socket);
        if (!m || (m[12] === 0 && m[13] === 0 && m[14] === 0)) return null;
        return { x: m[12]!, y: m[13]!, z: m[14]!, face: Math.atan2(m[8]!, m[10]!) };
      },
      events: {
        home(home, count) {
          recordHome(ctx.signals, home, count);
          emit(ctx.signals, 'residentHome', { home, count });
        },
        passed(cell) {
          emit(ctx.signals, 'personPassed', cell);
        },
        lamp(lamp) {
          emit(ctx.signals, 'lampReached', { lamp });
        },
        bell(structure) {
          emit(ctx.signals, 'bellRung', structure);
        },
        added(p) {
          const look = lookOf(p.look, p.child);
          drawn.set(p, { look, rig: rigOf(look), handles: null, shown: false, last: new Float32Array(80), bubble: null, kite: null });
        },
        removed(p) {
          const d = drawn.get(p);
          if (d?.handles) for (const h of d.handles) h.release();
          d?.bubble?.release();
          d?.kite?.kite.release();
          d?.kite?.line.release();
          drawn.delete(p);
        },
      },
    });
    const unsubscribe = ctx.signals.on('blockLanded', (cell) => crowd.blockLanded(cell));
    // The debug handle for browser tests and for watching (like the app's window.__lc): the newest crowd.
    (globalThis as { __lcPeople?: Crowd }).__lcPeople = crowd;
    return { crowd, drawn, bubbleMesh: null, lineMesh: null, standIns: [], tick: -1, fresh: true, unsubscribe };
  },
  sync(state, next, _prev, ctx) {
    if (!next.dressing) return;
    state.standIns = [];
    for (const a of next.dressing.actors) {
      if (a.type !== 'resident') continue;
      const h = ctx.stage.instance(a.id);
      if (h) state.standIns.push(h);
    }
    for (const h of state.standIns) h.setVisible(false);
    state.crowd.sync(next.shape, next.dressing, ctx.signals.time);
    state.fresh = true;
    markCensusReady(ctx.signals);
  },
  update(state, dt, signals, ctx) {
    // Whatever else touches the plan's instances (pop-in, a re-sync), the stand-ins stay hidden.
    for (const h of state.standIns) h.setVisible(false);
    state.crowd.step(dt, signals.time);
    // Drawn "on twos": the crowd steps every frame, but the picture of it changes PERSON.drawRate times
    // a second. That is the hand of the thing, and it also spares the page: every frame in which
    // something moved costs the renderer a second pass for the shade on the ground.
    const tick = Math.floor(signals.time.seconds * PERSON.drawRate);
    if (tick === state.tick && !state.fresh) return;
    state.tick = tick;
    state.fresh = false;
    for (const p of state.crowd.people) {
      const d = state.drawn.get(p);
      if (!d) continue;
      const gust = p.visible && d.look.hat !== 'none' && signals.wind(p.x, p.z).strength > PEOPLE.gust;
      draw(p, d, ctx.stage, gust);
      // The chat bubble over whoever is talking (L26).
      const talking = p.bubble && p.visible;
      if (talking) {
        d.bubble ??= ctx.stage.spawnMesh((state.bubbleMesh ??= bubbleMesh()), IDENTITY);
        const m = Array.from(IDENTITY);
        m[12] = p.x;
        m[13] = p.y + (DESIGN_HEIGHT + 0.2) * d.look.scale;
        m[14] = p.z;
        d.bubble.setMatrix(m);
      } else if (d.bubble) {
        d.bubble.release();
        d.bubble = null;
      }
      // A kite (L28): downwind and up, weaving a little; its line from the raised hand.
      if (p.flying && p.visible) {
        if (!d.kite) {
          state.lineMesh ??= lineMesh();
          d.kite = { kite: ctx.stage.spawnMesh(kiteMesh(p.look % 10), IDENTITY), line: ctx.stage.spawnMesh(state.lineMesh, IDENTITY) };
        }
        const wind = signals.wind(p.x, p.z);
        const t = signals.time.seconds;
        const weave = Math.sin(t * 1.3 + p.rank * 20) * 0.2, bob = Math.sin(t * 0.9 + p.rank * 11) * 0.1;
        const pull = Math.min(1.3, 0.7 + wind.strength);
        const kx = p.x + wind.dirX * PEOPLE.kiteOut * pull - wind.dirZ * weave;
        const ky = p.y + PEOPLE.kiteUp + bob;
        const kz = p.z + wind.dirZ * PEOPLE.kiteOut * pull + wind.dirX * weave;
        const hx = p.x + Math.sin(p.heading) * 0.05, hy = p.y + 0.44 * d.look.scale, hz = p.z + Math.cos(p.heading) * 0.05;
        // The kite faces back toward the child, tipped up into the wind.
        const zx = -wind.dirX * 0.8, zy = 0.6, zz = -wind.dirZ * 0.8;
        const xl = Math.hypot(zz, zx) || 1;
        const xx = zz / xl, xz = -zx / xl;
        d.kite.kite.setMatrix([xx, 0, xz, 0, zy * xz, zz * xx - zx * xz, -zy * xx, 0, zx, zy, zz, 0, kx, ky, kz, 1]);
        // The line: its mesh runs one unit along +X, so the X column is the whole span.
        const lx = kx - hx, ly = ky - hy, lz = kz - hz;
        const ll = Math.hypot(lx, ly, lz) || 1;
        const sx = lz / (Math.hypot(lx, lz) || 1), sz = -lx / (Math.hypot(lx, lz) || 1);
        const ux = (-ly * sz) / ll, uy = (sz * lx - sx * lz) / ll, uz = (ly * sx) / ll; // S × L: right-handed
        d.kite.line.setMatrix([lx, ly, lz, 0, ux, uy, uz, 0, sx, 0, sz, 0, hx, hy, hz, 1]);
      } else if (d.kite) {
        d.kite.kite.release();
        d.kite.line.release();
        d.kite = null;
      }
    }
  },
  dispose(state) {
    state.unsubscribe();
    for (const d of state.drawn.values()) {
      if (d.handles) for (const h of d.handles) h.release();
      d.bubble?.release();
      d.kite?.kite.release();
      d.kite?.line.release();
    }
    state.drawn.clear();
  },
});

