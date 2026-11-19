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
import { buildPerson, lookOf, PIECES, rigOf, type Look, type Rig } from '@/parts/people/person';
import { poseOf, rigMatrices, sitDrop } from '@/parts/people/pose';
import type { NavDoor } from '@/resolve/plan';
import { PEOPLE } from '@/style/people';
import { createCrowd, type Crowd, type Person } from './crowd';
import { markCensusReady, recordHome } from './home';

interface Drawn {
  look: Look;
  rig: Rig;
  handles: InstanceHandle[] | null;
  shown: boolean;
  /** What was last sent to the stage, to leave a still figure alone. */
  last: Float32Array;
}

interface State {
  crowd: Crowd;
  drawn: Map<Person, Drawn>;
  /** The plan's own resident instances, kept hidden. */
  standIns: InstanceHandle[];
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

function emit<E extends 'personPassed' | 'residentHome'>(signals: Signals, event: E, payload: Parameters<SignalsDriver['emit']>[1]): void {
  (signals as Partial<SignalsDriver>).emit?.(event, payload as never);
}

function draw(p: Person, d: Drawn, stage: LifeStage): void {
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
  const walking = p.pose === 'walk' || p.pose === 'run';
  const pose = poseOf(p.pose, walking ? p.stride : p.poseTime, p.rank);
  const sitting = p.pose === 'sit' && p.seat >= 0;
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
      world[o + 1] = scale * ly + (col === 3 ? p.y : 0);
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
        added(p) {
          const look = lookOf(p.look, p.child);
          drawn.set(p, { look, rig: rigOf(look), handles: null, shown: false, last: new Float32Array(80) });
        },
        removed(p) {
          const d = drawn.get(p);
          if (d?.handles) for (const h of d.handles) h.release();
          drawn.delete(p);
        },
      },
    });
    const unsubscribe = ctx.signals.on('blockLanded', (cell) => crowd.blockLanded(cell));
    return { crowd, drawn, standIns: [], unsubscribe };
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
    markCensusReady(ctx.signals);
  },
  update(state, dt, signals, ctx) {
    // Whatever else touches the plan's instances (pop-in, a re-sync), the stand-ins stay hidden.
    for (const h of state.standIns) h.setVisible(false);
    state.crowd.step(dt, signals.time);
    for (const p of state.crowd.people) {
      const d = state.drawn.get(p);
      if (d) draw(p, d, ctx.stage);
    }
  },
  dispose(state) {
    state.unsubscribe();
    for (const d of state.drawn.values()) if (d.handles) for (const h of d.handles) h.release();
    state.drawn.clear();
  },
});

