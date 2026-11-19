// Castle life (L36 garrison, L37 rider): runs each castle's troop (troop.ts)
// and rider (rider.ts) and draws them, piece by piece like the residents
// (people.system.ts): soldiers are people in the castle's tabard and helmet
// with pikes; the rider sits a horse (src/parts/people/horse.ts).
//
// Drawn "on twos" at PERSON.drawRate, like the crowd; a figure whose drawing
// did not change is not touched. Residents give way to the column and the
// horse (crowd.ts reads obstaclesOf).

import { defineSystem, type InstanceHandle, type LifeStage } from '@/life/api';
import type { MeshData } from '@/gen/mesh';
import { clothColors } from '@/parts/props/kit';
import { TOOL_PIECE, toolMesh, type Tool } from '@/parts/people/extras';
import { buildHorse, HORSE_PIECES, horseMatrices, horsePose, SADDLE } from '@/parts/people/horse';
import { buildPerson, PIECES, rigOf, soldierLook, type Look, type Rig } from '@/parts/people/person';
import { poseOf, rigMatrices, sitDrop, type Pose } from '@/parts/people/pose';
import { findCastles, type Castle } from '@/rules/life/castle.lib';
import type { ShapePlan, DressingPlan } from '@/resolve/plan';
import { PERSON } from '@/style/people';
import { crowdOf, setObstacles, type Obstacle } from '../doors/table';
import { createRide, rideOf, type Ride } from './rider';
import { createRouter } from './route';
import { createTroop, patrolOf, type Troop } from './troop';

interface Figure {
  handles: InstanceHandle[];
  tool: { kind: Tool; handle: InstanceHandle } | null;
  last: Float32Array;
}

interface Garrison {
  key: string;
  castle: Castle;
  troop: Troop | null;
  ride: Ride | null;
  colour: string;
  soldiers: { look: Look; rig: Rig; fig: Figure | null }[];
  horse: { pieces: InstanceHandle[]; last: Float32Array } | null;
  rider: { look: Look; rig: Rig; fig: Figure | null; lance: InstanceHandle | null } | null;
  horseLook: number;
}

interface State {
  list: Garrison[];
  tick: number;
  fresh: boolean;
  obstacles: Obstacle[];
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const local = new Float32Array(96);
const world = new Float32Array(96);
const toolMeshes = new Map<string, MeshData>();

function release(g: Garrison): void {
  for (const s of g.soldiers) dropFigure(s.fig);
  if (g.horse) for (const h of g.horse.pieces) h.release();
  if (g.rider) {
    dropFigure(g.rider.fig);
    g.rider.lance?.release();
  }
}
function dropFigure(f: Figure | null): void {
  if (!f) return;
  for (const h of f.handles) h.release();
  f.tool?.handle.release();
}

/** world = T(x, y, z) · Ry(heading) · S(scale) · local, for `n` pieces. */
function place(n: number, x: number, y: number, z: number, heading: number, scale: number, from: Float32Array, into: Float32Array): void {
  const c = Math.cos(heading) * scale, s = Math.sin(heading) * scale;
  for (let i = 0; i < n; i++) {
    const k = i * 16;
    for (let col = 0; col < 4; col++) {
      const o = k + col * 4;
      const lx = from[o]!, ly = from[o + 1]!, lz = from[o + 2]!;
      into[o] = c * lx + s * lz + (col === 3 ? x : 0);
      into[o + 1] = scale * ly + (col === 3 ? y : 0);
      into[o + 2] = -s * lx + c * lz + (col === 3 ? z : 0);
      into[o + 3] = col === 3 ? 1 : 0;
    }
  }
}

/**
 * A rider's legs astride the horse: each leg (pieces 1 and 2) turned out about its hip by `angle`, so the
 * legs come down the horse's flanks instead of into its barrel (a person's legs otherwise only swing fore
 * and aft). The leg's translation is its hip, which stays put.
 */
export function straddle(mats: Float32Array, angle: number): void {
  for (const [i, a] of [[1, -angle], [2, angle]] as const) {
    const c = Math.cos(a), s = Math.sin(a), k = i * 16;
    // Rz(a) · R for each of the three axis columns.
    for (let col = 0; col < 3; col++) {
      const x = mats[k + col * 4]!, y = mats[k + col * 4 + 1]!;
      mats[k + col * 4] = c * x - s * y;
      mats[k + col * 4 + 1] = s * x + c * y;
    }
  }
}

/** Sends a person's five pieces (and their tool) to the stage, if the drawing changed. */
function drawFigure(stage: LifeStage, f: Figure, mats: Float32Array, tool: Tool | null, colour: string): void {
  if (f.tool && f.tool.kind !== tool) {
    f.tool.handle.release();
    f.tool = null;
  }
  let fresh = false;
  if (tool && !f.tool) {
    const k = `${tool}:${colour}`;
    let mesh = toolMeshes.get(k);
    if (!mesh) toolMeshes.set(k, (mesh = toolMesh(tool, colour)));
    f.tool = { kind: tool, handle: stage.spawnMesh(mesh, IDENTITY) };
    fresh = true;
  }
  let same = !fresh;
  for (let i = 0; same && i < 80; i++) same = f.last[i] === mats[i];
  if (same) return;
  f.last.set(mats.subarray(0, 80));
  for (let i = 0; i < 5; i++) f.handles[i]!.setMatrix(mats.subarray(i * 16, i * 16 + 16));
  if (f.tool) f.tool.handle.setMatrix(mats.subarray(TOOL_PIECE[f.tool.kind] * 16, TOOL_PIECE[f.tool.kind] * 16 + 16));
}

function newFigure(stage: LifeStage, look: Look, ink: string): Figure {
  const meshes = buildPerson(look, ink);
  return { handles: PIECES.map((p) => stage.spawnMesh(meshes[p], IDENTITY)), tool: null, last: new Float32Array(80) };
}

function build(shape: ShapePlan, dressing: DressingPlan, seed: number, time: Parameters<typeof createTroop>[3]): Garrison[] {
  const nav = dressing.nav;
  const castles = findCastles(shape, nav);
  const router = createRouter(nav);
  const squares = dressing.sockets.filter((s) => s.type === 'haunt-square').map((s) => nav.nodeAt.get(s.cell)).filter((n): n is number => n !== undefined);
  const out: Garrison[] = [];
  for (const a of dressing.actors) {
    if (a.type !== 'garrison' && a.type !== 'rider') continue;
    const castle = castles.find((c) => c.id === a.home);
    if (!castle?.gate) continue;
    let g = out.find((x) => x.castle.id === castle.id);
    const colours = clothColors();
    const colour = colours[(((Number((a.params as { color?: number } | undefined)?.color ?? 0)) % colours.length) + colours.length) % colours.length]!;
    if (!g) {
      g = { key: `castle${castle.id}`, castle, troop: null, ride: null, colour, soldiers: [], horse: null, rider: null, horseLook: 0 };
      out.push(g);
    }
    if (a.type === 'garrison') {
      const track = patrolOf(nav, castle);
      if (!track) continue;
      g.troop = createTroop(nav, castle, track, time);
      g.soldiers = g.troop.soldiers.map((s) => {
        const look = soldierLook(seed * 31 + castle.id * 7 + s.index, colour);
        return { look, rig: rigOf(look), fig: null };
      });
    } else {
      const track = rideOf(nav, router, castle, squares);
      if (!track) continue;
      g.ride = createRide(castle, track, seed ^ castle.id, time);
      const look = soldierLook(seed * 37 + castle.id, colour);
      g.rider = { look, rig: rigOf(look), fig: null, lance: null };
      g.horseLook = Number((a.params as { look?: number } | undefined)?.look ?? 0);
    }
  }
  return out;
}

const RIDE_POSE: Pose = { legL: 0.4, legR: 0.4, armL: 0.75, armR: 0.3, outL: 0.05, outR: 0.12, lean: 0.04, lift: 0, twist: 0 };

export default defineSystem<State>({
  id: 'garrison',
  order: 21,
  create(ctx) {
    const state: State = { list: [], tick: -1, fresh: true, obstacles: [] };
    setObstacles(ctx.stage, () => state.obstacles);
    // The debug handle for watching (like window.__lcPeople).
    (globalThis as { __lcGarrison?: State }).__lcGarrison = state;
    return state;
  },
  sync(state, next, prev, ctx) {
    if (!next.dressing) return;
    // Keep a troop that is still there (same castle and same actors) going across unrelated edits.
    const keep = prev?.dressing && next.dressing.nav === prev.dressing.nav;
    if (keep && state.list.length > 0) return;
    for (const g of state.list) release(g);
    state.list = build(next.shape, next.dressing, ctx.seed, ctx.signals.time);
    state.fresh = true;
  },
  update(state, dt, signals, ctx) {
    const crowd = crowdOf(ctx.stage);
    const crowded = (x: number, z: number, dx: number, dz: number): boolean => {
      if (!crowd) return false;
      for (const p of crowd.people) {
        if (!p.visible) continue;
        const ox = p.x - x, oz = p.z - z;
        const ahead = ox * dx + oz * dz;
        if (ahead > -0.2 && ahead < 1.1 && Math.abs(ox * dz - oz * dx) < 0.5) return true;
      }
      return false;
    };
    state.obstacles.length = 0;
    for (const g of state.list) {
      g.troop?.step(dt, signals.time);
      g.ride?.step(dt, signals.time, crowded);
      for (const s of g.troop?.soldiers ?? []) state.obstacles.push({ x: s.x, z: s.z, y: s.y });
      if (g.ride) {
        // The horse is long: its middle and both ends.
        const hx = Math.sin(g.ride.heading) * 0.2, hz = Math.cos(g.ride.heading) * 0.2;
        state.obstacles.push({ x: g.ride.x, z: g.ride.z, y: g.ride.y }, { x: g.ride.x + hx, z: g.ride.z + hz, y: g.ride.y }, { x: g.ride.x - hx, z: g.ride.z - hz, y: g.ride.y });
      }
    }
    const tick = Math.floor(signals.time.seconds * PERSON.drawRate);
    if (tick === state.tick && !state.fresh) return;
    state.tick = tick;
    state.fresh = false;
    for (const g of state.list) {
      if (g.troop) {
        g.troop.soldiers.forEach((s, i) => {
          const d = g.soldiers[i]!;
          d.fig ??= newFigure(ctx.stage, d.look, `${g.key}-soldier${i}`);
          const pose = s.pose === 'walk' ? poseOf('walk', s.stride, 0) : { legL: 0, legR: 0, armL: 0, armR: 0, outL: 0.08, outR: 0.08, lean: 0, lift: 0, twist: 0 };
          // The pike hand is held still, in step or halted; a sentry raises the torch a little.
          pose.armR = s.torch ? 0.55 : 0.32;
          pose.outR = 0.06;
          rigMatrices(d.look, pose, local, 0, d.rig);
          place(5, s.x, s.y, s.z, s.heading, d.look.scale, local, world);
          drawFigure(ctx.stage, d.fig, world, s.torch ? 'torch' : 'pike', g.colour);
        });
      }
      if (g.ride && g.rider) {
        const r = g.ride;
        const meshes = g.horse ? null : buildHorse(g.horseLook, g.colour);
        g.horse ??= { pieces: HORSE_PIECES.map((p) => ctx.stage.spawnMesh(meshes![p], IDENTITY)), last: new Float32Array(96) };
        const hp = horsePose(r.gait, r.phase, (g.castle.id % 7) / 7);
        horseMatrices(hp, local);
        place(6, r.x, r.y, r.z, r.heading, 1, local, world);
        let same = true;
        for (let i = 0; same && i < 96; i++) same = g.horse.last[i] === world[i];
        if (!same) {
          g.horse.last.set(world);
          for (let i = 0; i < 6; i++) g.horse.pieces[i]!.setMatrix(world.subarray(i * 16, i * 16 + 16));
        }
        // The rider: in the saddle while riding; standing at the horse's head while it is tethered.
        g.rider.fig ??= newFigure(ctx.stage, g.rider.look, `${g.key}-rider`);
        if (r.riding) {
          const drop = sitDrop(g.rider.rig, 0);
          rigMatrices(g.rider.look, { ...RIDE_POSE, lean: r.gait === 'trot' ? 0.1 : 0.04 }, local, drop, g.rider.rig);
          straddle(local, 0.55);
          // Origin on the saddle: the seat moves with the horse's spring.
          const sx = r.x + Math.sin(r.heading) * SADDLE.z, sz = r.z + Math.cos(r.heading) * SADDLE.z;
          place(5, sx, r.y + SADDLE.y + hp.lift, sz, r.heading, g.rider.look.scale, local, world);
        } else {
          // Beside the horse's head, holding the bridle, looking about.
          const side = 0.16, fwd = 0.2;
          const cx = r.x + Math.sin(r.heading) * fwd + Math.cos(r.heading) * side, cz = r.z + Math.cos(r.heading) * fwd - Math.sin(r.heading) * side;
          const pose = poseOf('stand', signals.time.seconds, 0.3);
          pose.armR = 0.3;
          rigMatrices(g.rider.look, pose, local, 0, g.rider.rig);
          place(5, cx, r.y, cz, r.heading - Math.PI / 2, g.rider.look.scale, local, world);
        }
        drawFigure(ctx.stage, g.rider.fig, world, 'lance', g.colour);
      }
    }
  },
  dispose(state, ctx) {
    for (const g of state.list) release(g);
    state.list = [];
    setObstacles(ctx.stage, null);
  },
});
