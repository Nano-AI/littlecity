// Ships in a blast (design section 13b; the owner: "Nukes should be able to
// damage boats as well ... break it in chunks, or have the mast fall off").
// Owner: Mischief.
//
// The big ships are the harbour's (src/life/ships), not blocks: a blast tells
// the harbour where it was and how far it reached, the harbour marks each ship
// it hurt and has it answer, and this draws the rest:
//   scorched     (the edge of a blast) sails torn away, smoke and flames on deck a while;
//                it gives up its visit and limps off
//   dismasted    (closer) a mast snaps at the deck and goes over the side into the sea,
//                its sails with it; planks fly off the hull; burning, it limps off
//   broken       (closest) it goes down where it is, settling by the head and listing,
//                under the water; planks, barrels, a spar and a hatch float where it was,
//                drift a while and sink. Its berth comes free and another ship calls.
// Nothing shrinks or fades: what goes, goes under the water.

import { CELL_H, columnIndex, inColumnBounds, key, SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import { compose, rotationY, translation, type Mat4 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { allParts } from '@/gen/discover';
import { MeshBuilder, type MeshData } from '@/gen/mesh';
import { rigOf } from '@/parts/actors/ships/rig';
import type { Actor, ShapePlan } from '@/resolve/plan';
import { BLAST } from '@/style/damage';
import { centroid, clonePoly, polysOf, Soup, transformPoly, type Poly } from '@/gen/damage/poly';
import { defineSystem, type InstanceHandle, type LifeStage } from '../api';
import { harbourOf, type Ship, type ShipHit } from '../ships/visit';
import { mischiefOf, NUKE, type Director, type MischiefEvent } from './director';
import { wakeRing } from '../boats/afloat';
import { crowdOf } from '../doors/table';
import { flameMesh, shockRingMesh, smokeMesh, spoutMesh, swimmerMesh, wreckPieceMesh } from './meshes';
import { boatAt, forgetBoatWrecks, strikeBoats, takeCapsized } from './boatwreck';
import { ownStage, type Owned } from './owned';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];
/** Seconds wreckage floats before it goes under; how long it takes to. */
const FLOAT = 40, SINK = 6;

interface Piece {
  h: InstanceHandle;
  x: number;
  z: number;
  y: number;
  yaw: number;
  /** In the air: velocity; then afloat. */
  vx: number;
  vy: number;
  vz: number;
  air: boolean;
  age: number;
  spin: number;
  /** A fallen mast: turning over about its foot first (radians to go), its world polygons' matrix. */
  mast?: { tip: number; axisX: number; axisZ: number; pivot: [number, number, number]; t: number };
  seed: number;
}

/**
 * Someone in the water: off the deck of a ship going down in a jump, then swimming for open sea and the
 * edge of the map (where the renderer cuts them off, as it does the ships), never vanishing where they are.
 */
interface Swimmer {
  h: [InstanceHandle, InstanceHandle];
  /** A pale ring on the water round them (so a head in the water reads from far off, and at night). */
  halo: InstanceHandle;
  /** Where they climb out (a quay, a beach), if one is in reach: the crowd takes them from there. */
  shore: { x: number; y: number; z: number } | null;
  look: number;
  x: number;
  y: number;
  z: number;
  /** The jump: from (x0, y0, z0) over `jump` seconds. */
  x0: number;
  y0: number;
  z0: number;
  dx: number;
  dz: number;
  age: number;
  jump: number;
  ring: number;
  seed: number;
}

interface Burning {
  ship: Ship;
  age: number;
  life: number;
  flames: InstanceHandle[];
  puffAcc: number;
}

interface Puff {
  h: InstanceHandle;
  /** The wash it thins into. */
  mist: InstanceHandle | null;
  x: number;
  y: number;
  z: number;
  age: number;
}

interface State {
  d: Director;
  own: Owned;
  shape: ShapePlan | null;
  pieces: Piece[];
  swimmers: Swimmer[];
  burning: Burning[];
  puffs: Puff[];
  spouts: { h: InstanceHandle; age: number }[];
  /** A nuke's strike waits for its shockwave. */
  pending: { at: number; x: number; z: number; power: number }[];
  time: number;
  /** The signals' clock (the small boats' wrecks are timed by it). */
  now: number;
  /** A small boat burning (its sail caught, or hit at the edge of a blast): flames and smoke on it a while. */
  boatFires: { id: string; age: number; flame: InstanceHandle; puff: number }[];
  off: () => void;
}

/** The parts of a ship's hull mesh: everything, and what belongs to mast `i` (its pole, top and shrouds). */
function hullWithout(ship: Ship, mast: number, shape: ShapePlan): { rest: Poly[]; mast: Poly[] } {
  const item = { id: `wreck:${ship.id}`, at: null, rule: 'spawn', hash: 0, type: ship.kind, params: { look: ship.look } } as unknown as Actor;
  const mesh = allParts().actor(item, { plan: shape }).mesh;
  const rig = rigOf(ship.kind, ship.look);
  const m = rig.masts[mast]!;
  const rest: Poly[] = [], gone: Poly[] = [];
  for (const p of polysOf(mesh)) {
    const [cx, cy, cz] = centroid(p);
    const up = cy > m.foot + 0.2;
    const pole = up && Math.abs(cx) < 0.32 && Math.abs(cz - m.z) < 0.42;
    // Its shrouds come down to the rail beside it.
    // Its shrouds come down from its top to the rail beside it (a little aft of it), all the way down.
    const shroud = cy > m.foot + 0.08 && cz > m.z - 0.75 && cz < m.z + 0.45 && Math.abs(cx) < 0.95 && Math.abs(cx) > 0.15 && cy > m.foot + 0.15 + (Math.abs(cx) - 0.15) * 0.45;
    (pole || shroud ? gone : rest).push(p);
  }
  return { rest, mast: gone };
}

function meshOfPolys(polys: readonly Poly[]): MeshData {
  const soup = new Soup();
  for (const p of polys) soup.add(p);
  return soup.empty ? new MeshBuilder().build() : soup.build();
}

function hit(st: State, stage: LifeStage, h: ShipHit, from: [number, number]): void {
  const seed = Math.floor(h.x * 131 + h.z * 71) + h.stage;
  if (h.stage === 3) goesDown(st, h, seed);
  else if (h.stage === 2 && !h.ship) {
    // A barge or a tall ship out at sea dismasted: planks off it.
    for (let i = 0; i < 4; i++) {
      const a = rand(seed, 'plank', i) * Math.PI * 2;
      st.pieces.push(piece(st, i % 2 ? 0 : 4, h.x, SEA_Y + 0.6, h.z, Math.cos(a) * 1.2, 2 + rand(seed, 'up', i), Math.sin(a) * 1.2, seed + i));
    }
  }
  const ship = h.ship;
  const body = ship?.body;
  if (!ship || !body || !st.shape) return;
  // Smoke and flames on deck a while (longer, the worse it is hurt).
  st.burning.push({ ship, age: 0, life: 12 + h.stage * 8, flames: [], puffAcc: 0 });
  // Sails torn away.
  const sails = body.rig.sails.map((_, i) => i).filter((i) => rand(seed, 'tear', i) < (h.stage === 1 ? 0.45 : 0.7));
  body.damage({ sails });
  if (h.stage >= 2) {
    // A mast goes: the one nearest the blast, snapped at the deck, over the side away from it.
    const rig = body.rig;
    const sin = Math.sin(ship.pose.yaw), cos = Math.cos(ship.pose.yaw);
    const along = (from[0] - ship.pose.x) * sin + (from[1] - ship.pose.z) * cos;
    let mi = 0;
    rig.masts.forEach((m, i) => {
      if (Math.abs(m.z - along) < Math.abs(rig.masts[mi]!.z - along)) mi = i;
    });
    const parts = hullWithout(ship, mi, st.shape);
    body.damage({ mast: mi, hull: st.own.stage.spawnMesh(meshOfPolys(parts.rest), ship.m) });
    // The mast in world space, toppling over about its foot, away from the blast, into the water.
    const world = parts.mast.map((p) => {
      const q = clonePoly(p);
      transformPoly(q, ship.m);
      return q;
    });
    const m = rig.masts[mi]!;
    const fx = ship.pose.x + sin * m.z, fz = ship.pose.z + cos * m.z;
    const across = (from[0] - ship.pose.x) * cos - (from[1] - ship.pose.z) * sin > 0 ? -1 : 1;
    // Falling athwartships: the axis is fore-and-aft, the fall to one side.
    const fall: [number, number] = [cos * across, -sin * across];
    const pivot: [number, number, number] = [fx, SEA_Y + m.foot, fz];
    // Put the mast's polygons about the pivot so its piece turns about the foot.
    const local = world.map((q) => {
      transformPoly(q, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -pivot[0], -pivot[1], -pivot[2], 1]);
      return q;
    });
    st.pieces.push({
      h: st.own.stage.spawnMesh(meshOfPolys(local), HIDDEN),
      x: pivot[0], y: pivot[1], z: pivot[2], yaw: 0, vx: fall[0] * 0.2, vy: 0, vz: fall[1] * 0.2, air: false, age: 0, spin: 0, seed: seed + 7,
      mast: { tip: 1.45, axisX: -fall[1], axisZ: fall[0], pivot, t: 0 },
    });
    // Planks off the hull.
    for (let i = 0; i < 5; i++) {
      const a = rand(seed, 'plank', i) * Math.PI * 2;
      st.pieces.push(piece(st, i % 2 ? 0 : 4, ship.pose.x + sin * (m.z * 0.5), SEA_Y + 0.8, ship.pose.z + cos * (m.z * 0.5), Math.cos(a) * 1.4, 2.2 + rand(seed, 'up', i), Math.sin(a) * 1.4, seed + i));
    }
  }
}

/** Where a ship (a barge, a tall ship) goes down: wreckage on the water, a splash, its people over the side. */
function goesDown(st: State, h: ShipHit, seed: number): void {
  const len = h.bow - h.stern;
  const sin = Math.sin(h.yaw), cos = Math.cos(h.yaw);
  const n = h.kind === 'barge' ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const u = rand(seed, 'wreck-u', i), v = rand(seed, 'wreck-v', i) - 0.5;
    const along = h.stern + u * len;
    const x = h.x + sin * along + cos * v * h.halfBeam * 2;
    const z = h.z + cos * along - sin * v * h.halfBeam * 2;
    // A barge's cargo goes over the side: barrels and crates.
    const kind = h.kind === 'barge' ? (i % 2 ? 2 : 4) : i;
    st.pieces.push(piece(st, kind, x, SEA_Y + 0.6, z, (rand(seed, 'wx', i) - 0.5) * 1.6, 1.5 + rand(seed, 'wy', i), (rand(seed, 'wz', i) - 0.5) * 1.6, seed + 100 + i));
  }
  st.spouts.push({ h: st.own.stage.spawnMesh(spoutMesh(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, h.x, SEA_Y, h.z, 1]), age: 0 });
  abandon(st, h, seed);
}

/** Which way to swim from (x, z): toward the nearest edge of the map reached over open water, or null. */
function wayOut(shape: ShapePlan, x: number, z: number): [number, number] | null {
  const dirs: [number, number, number][] = [[-1, 0, x], [1, 0, SIZE_X - x], [0, -1, z], [0, 1, SIZE_Z - z]];
  dirs.sort((a, b) => a[2] - b[2]);
  for (const [dx, dz, far] of dirs) {
    let open = true;
    for (let t = 0.5; t < far && open; t += 0.5) {
      const cx = Math.floor(x + dx * t), cz = Math.floor(z + dz * t);
      if (!inColumnBounds(cx, cz)) break;
      if (shape.terrain.height[columnIndex(cx, cz)]! > 0) open = false;
    }
    if (open) return [dx, dz];
  }
  return null;
}

/** The crew of a ship going down jump clear and swim for it. */
/** The nearest place to climb out within a few cells of (x, z), reached over open water: its edge, and the ground's height. */
function shoreNear(shape: ShapePlan, x: number, z: number): { x: number; y: number; z: number; dx: number; dz: number } | null {
  let best: { x: number; y: number; z: number; dx: number; dz: number; d: number } | null = null;
  const R = 7;
  for (let cz = Math.floor(z) - R; cz <= Math.floor(z) + R; cz++) {
    for (let cx = Math.floor(x) - R; cx <= Math.floor(x) + R; cx++) {
      if (!inColumnBounds(cx, cz)) continue;
      const h = shape.terrain.height[columnIndex(cx, cz)]!;
      const dock = shape.kinds.get(key(cx, 0, cz)) === 'dock';
      if (h === 0 && !dock) continue;
      const tx = cx + 0.5, tz = cz + 0.5;
      const d = Math.hypot(tx - x, tz - z);
      if (d > R || (best && d >= best.d)) continue;
      // Over open water all the way to within a cell of it.
      const ux = (tx - x) / d, uz = (tz - z) / d;
      let open = true;
      for (let t = 0.4; t < d - 1 && open; t += 0.4) {
        const sx = Math.floor(x + ux * t), sz = Math.floor(z + uz * t);
        if (!inColumnBounds(sx, sz) || shape.terrain.height[columnIndex(sx, sz)]! > 0 || shape.kinds.has(key(sx, 0, sz))) open = false;
      }
      if (!open) continue;
      best = { x: tx, y: dock ? CELL_H : h * CELL_H, z: tz, dx: ux, dz: uz, d };
    }
  }
  return best;
}

function abandon(st: State, h: ShipHit, seed: number): void {
  if (!st.shape) return;
  const n = h.crew;
  const sin = Math.sin(h.yaw), cos = Math.cos(h.yaw);
  for (let i = 0; i < n; i++) {
    const along = h.stern + (h.bow - h.stern) * (0.25 + 0.5 * (i / Math.max(1, n - 1)));
    const side = i % 2 ? 1 : -1;
    const x0 = h.x + sin * along + cos * side * h.halfBeam * 0.6, y0 = SEA_Y + 0.75, z0 = h.z + cos * along - sin * side * h.halfBeam * 0.6;
    // Over the side, a body's length out, then away.
    const ox = cos * side, oz = -sin * side;
    // For the nearest quay or beach if there is one in reach; else away to the edge of the map.
    const shore = shoreNear(st.shape, x0 + ox * 1.1, z0 + oz * 1.1);
    const out = shore ? [shore.dx, shore.dz] : (wayOut(st.shape, x0 + ox * 1.2, z0 + oz * 1.2) ?? [ox, oz]);
    const look = Math.floor(rand(seed, 'swimmer', i) * 60);
    st.swimmers.push({
      halo: st.own.stage.spawnMesh(shockRingMesh(), HIDDEN),
      shore: shore ? { x: shore.x, y: shore.y, z: shore.z } : null,
      look,
      h: [st.own.stage.spawnMesh(swimmerMesh(look, 0), HIDDEN), st.own.stage.spawnMesh(swimmerMesh(look, 1), HIDDEN)],
      x: x0 + ox * 1.1, y: SEA_Y, z: z0 + oz * 1.1, x0, y0, z0, dx: out[0], dz: out[1], age: -i * 0.35, jump: 0.7, ring: 0, seed: seed + i,
    });
  }
}

function piece(st: State, kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, seed: number): Piece {
  return { h: st.own.stage.spawnMesh(wreckPieceMesh(kind), HIDDEN), x, y, z, yaw: rand(seed, 'yaw') * 6, vx, vy, vz, air: true, age: 0, spin: (rand(seed, 'spin') - 0.5) * 8, seed };
}

function strike(st: State, stage: LifeStage, x: number, z: number, power: number): void {
  const r3 = BLAST.rubble * power * 0.9, r2 = BLAST.wreck * power, r1 = BLAST.shake * power;
  const harbour = harbourOf(stage);
  if (harbour) for (const h of harbour.strike(x, z, r3, r2, r1)) hit(st, stage, h, [x, z]);
  // The small boats: swamped or capsized (their behaviours draw that); whoever was aboard a capsized one swims.
  for (const b of strikeBoats(stage, x, z, st.now, r3, r2, r1)) {
    if (b.stage < 3) burnBoat(st, b.id);
    const seed = Math.floor(b.x * 97 + b.z * 53) + b.stage;
    if (b.stage === 3) {
      abandon(st, { ship: null, stage: 3, d: 0, kind: 'barge', x: b.x, z: b.z, yaw: b.yaw, stern: -0.4, bow: 0.4, halfBeam: 0.2, crew: b.type === 'fishing-boat' ? 2 : 1 }, seed);
      for (let i = 0; i < 2; i++) st.pieces.push(piece(st, i ? 0 : 2, b.x, SEA_Y + 0.4, b.z, (rand(seed, 'bx', i) - 0.5) * 1.4, 1.4, (rand(seed, 'bz', i) - 0.5) * 1.4, seed + i));
    }
  }
}

function burnBoat(st: State, id: string): void {
  if (st.boatFires.some((f) => f.id === id)) return;
  st.boatFires.push({ id, age: 0, flame: st.own.stage.spawnMesh(flameMesh(id.length % 3), HIDDEN), puff: 0 });
}

function clearAll(st: State): void {
  for (const f of st.boatFires) f.flame.release();
  st.boatFires = [];
  for (const p of st.pieces) p.h.release();
  for (const w of st.swimmers) for (const h of [...w.h, w.halo]) h.release();
  st.swimmers = [];
  for (const b of st.burning) for (const f of b.flames) f.release();
  for (const p of st.puffs) {
    p.h.release();
    p.mist?.release();
  }
  for (const s of st.spouts) s.h.release();
  st.pieces = [];
  st.burning = [];
  st.puffs = [];
  st.spouts = [];
  st.pending = [];
}

function onEvent(st: State, stage: LifeStage, e: MischiefEvent): void {
  if (e.type === 'reset' || e.type === 'undo') {
    clearAll(st);
    forgetBoatWrecks(stage);
    harbourOf(stage)?.clearWrecks();
    return;
  }
  // Lightning on a vessel: its sails catch, and it is scorched as at the edge of a blast.
  if (e.type === 'strike' && e.strike.cell === -1) {
    const [x, , z] = e.strike.point;
    const harbour = harbourOf(stage);
    if (harbour) for (const h of harbour.strike(x, z, -1, -1, 0.7)) hit(st, stage, h, [x, z]);
    for (const b of strikeBoats(stage, x, z, st.now, -1, -1, 0.7)) burnBoat(st, b.id);
    return;
  }
  if (e.type !== 'blast') return;
  const [x, , z] = e.blast.point;
  if (e.nuke) st.pending.push({ at: st.time + 0.3, x, z, power: NUKE.power });
  else strike(st, stage, x, z, e.blast.power);
}

export default defineSystem<State>({
  id: 'mischief.shipwreck',
  order: 41,
  create(ctx) {
    const st: State = { d: mischiefOf(ctx.stage), own: ownStage(ctx.stage), shape: null, pieces: [], swimmers: [], burning: [], puffs: [], spouts: [], pending: [], time: 0, now: 0, boatFires: [], off: () => {} };
    st.off = st.d.on((e) => onEvent(st, ctx.stage, e));
    // For tests and watching (like __lcPeople): the harbour on this stage.
    Object.defineProperty(globalThis, '__lcHarbour', { get: () => harbourOf(ctx.stage), configurable: true });
    Object.defineProperty(globalThis, '__lcSwimmers', { get: () => st.swimmers.map((w) => ({ x: w.x, z: w.z, age: w.age })), configurable: true });
    return st;
  },
  sync(st, next) {
    st.shape = next.shape;
  },
  update(st, dt, signals, ctx) {
    st.time += dt;
    st.now = signals.time.seconds;
    st.d.clock = st.now;
    const stage = ctx.stage;
    // Small boats the Hand threw down into the sea: over they went, and whoever was aboard swims for it.
    for (const b of takeCapsized(stage)) {
      const seed = Math.floor(b.x * 97 + b.z * 53) + 3;
      abandon(st, { ship: null, stage: 3, d: 0, kind: 'barge', x: b.x, z: b.z, yaw: b.yaw, stern: -0.4, bow: 0.4, halfBeam: 0.2, crew: b.type === 'fishing-boat' ? 2 : 1 }, seed);
    }
    for (let i = st.pending.length - 1; i >= 0; i--) {
      const p = st.pending[i]!;
      if (st.time < p.at) continue;
      st.pending.splice(i, 1);
      strike(st, ctx.stage, p.x, p.z, p.power);
    }
    // ── pieces: flying, then afloat and drifting, then going under ──
    for (let i = st.pieces.length - 1; i >= 0; i--) {
      const p = st.pieces[i]!;
      p.age += dt;
      let m: Mat4;
      if (p.mast) {
        // Over the side about its foot, then lying in the water, drifting.
        const k = Math.min(1, p.mast.t / 1.1);
        p.mast.t += dt;
        const a = p.mast.tip * k * k;
        const c = Math.cos(a), s = Math.sin(a), ax = p.mast.axisX, az = p.mast.axisZ, t = 1 - c;
        const drop = k * Math.max(0, p.mast.pivot[1] - SEA_Y + 0.05);
        if (k >= 1) {
          const w = signals.wind(p.x, p.z);
          p.x += w.dirX * w.strength * dt * 0.12;
          p.z += w.dirZ * w.strength * dt * 0.12;
        }
        const sink = p.age > FLOAT ? Math.min(1, (p.age - FLOAT) / SINK) * 1.5 : 0;
        m = [t * ax * ax + c, s * az, t * ax * az, 0, -s * az, c, s * ax, 0, t * ax * az, -s * ax, t * az * az + c, 0, p.x, p.y - drop - sink, p.z, 1];
      } else if (p.air) {
        p.vy -= 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.yaw += p.spin * dt;
        if (p.y <= SEA_Y + 0.02 && p.vy < 0) {
          p.air = false;
          p.y = SEA_Y + 0.02;
        }
        m = compose(translation(p.x, p.y, p.z), rotationY(p.yaw));
      } else {
        const w = signals.wind(p.x, p.z);
        p.x += w.dirX * w.strength * dt * 0.15;
        p.z += w.dirZ * w.strength * dt * 0.15;
        p.yaw += Math.sin(p.age * 0.7 + p.seed) * dt * 0.2;
        const sink = p.age > FLOAT ? Math.min(1, (p.age - FLOAT) / SINK) * 0.6 : 0;
        const bob = Math.sin(st.time * 1.6 + p.seed) * 0.015;
        m = compose(translation(p.x, SEA_Y + 0.02 + bob - sink, p.z), rotationY(p.yaw));
      }
      p.h.setMatrix(m);
      p.h.setVisible(true);
      if (p.age > FLOAT + SINK) {
        p.h.release();
        st.pieces.splice(i, 1);
      }
    }
    // ── swimmers: over the side, then away for open water and the edge of the map ──
    for (let i = st.swimmers.length - 1; i >= 0; i--) {
      const w = st.swimmers[i]!;
      w.age += dt;
      if (w.age < 0) continue;
      const [a, b] = w.h;
      let m: Mat4;
      const yaw = Math.atan2(w.dx, w.dz);
      if (w.age < w.jump) {
        // The jump: up off the rail and down into the water, a splash at the end.
        const k = w.age / w.jump;
        const x = w.x0 + (w.x - w.x0) * k, z = w.z0 + (w.z - w.z0) * k;
        const y = w.y0 + (SEA_Y - w.y0) * k + Math.sin(k * Math.PI) * 0.35;
        m = compose(translation(x, y, z), rotationY(yaw));
        a.setMatrix(m);
        a.setVisible(true);
        b.setVisible(false);
        continue;
      }
      if (w.ring === 0) wakeRing(stage, w.x, w.z, 0.12, 2.4, 1.2);
      // Swimming: two drawings in turn (on twos), a ripple each stroke; toward the shore, they steer for it.
      if (w.shore) {
        const ex = w.shore.x - w.x, ez = w.shore.z - w.z, el = Math.hypot(ex, ez) || 1;
        w.dx = ex / el;
        w.dz = ez / el;
        // Close: they climb out, and are one of the town from here (the crowd takes them, same frame).
        if (el < 0.75) {
          const p = crowdOf(stage)?.ashore(w.x + w.dx * 0.6, w.shore.y, w.z + w.dz * 0.6, Math.atan2(w.dx, w.dz), w.look);
          if (p) {
            for (const h of [...w.h, w.halo]) h.release();
            st.swimmers.splice(i, 1);
            continue;
          }
          // Nowhere to stand after all: away to the edge instead.
          w.shore = null;
          const out = st.shape ? wayOut(st.shape, w.x, w.z) : null;
          if (out) [w.dx, w.dz] = out;
          else [w.dx, w.dz] = [-w.dx, -w.dz];
        }
      }
      w.x += w.dx * dt * 0.42;
      w.z += w.dz * dt * 0.42;
      w.ring += dt;
      const stroke = Math.floor(st.time * 2.4 + w.seed) % 2;
      if (w.ring > 0.85) {
        w.ring = 0.001;
        wakeRing(stage, w.x, w.z, 0.1, 2.2, 1.1);
      }
      const bob = Math.sin(st.time * 4.8 + w.seed) * 0.012;
      // A little larger than life, so a head in the water reads from the whole-harbour view.
      m = compose(translation(w.x, SEA_Y - 0.03 + bob, w.z), rotationY(yaw), [1.5, 0, 0, 0, 0, 1.5, 0, 0, 0, 0, 1.5, 0, 0, 0, 0, 1]);
      const show = stroke ? b : a, hide = stroke ? a : b;
      show.setMatrix(m);
      show.setVisible(true);
      hide.setVisible(false);
      const k = 0.26 + 0.03 * Math.sin(st.time * 3 + w.seed);
      w.halo.setMatrix([k, 0, 0, 0, 0, 1, 0, 0, 0, 0, k, 0, w.x, SEA_Y + 0.01, w.z, 1]);
      w.halo.setParams(0.8);
      w.halo.setVisible(true);
      // At the edge of the map the renderer cuts them off, as it does a ship sailing out.
      const out = Math.min(w.x, SIZE_X - w.x, w.z, SIZE_Z - w.z);
      for (const h of w.h) h.setParams(1, 0, 0, out < 1.5 ? -2 : 0);
      w.halo.setParams(0.8, 0, 0, out < 1.5 ? -2 : 0);
      if (out < -0.6) {
        for (const h of [...w.h, w.halo]) h.release();
        st.swimmers.splice(i, 1);
      }
    }

    // ── small boats burning: flames on the boat (its sail alight), smoke, then out ──
    for (let i = st.boatFires.length - 1; i >= 0; i--) {
      const f = st.boatFires[i]!;
      f.age += dt;
      const at = boatAt(stage, f.id);
      const life = 14;
      if (!at || f.age > life) {
        f.flame.release();
        st.boatFires.splice(i, 1);
        continue;
      }
      const k = Math.min(1, (life - f.age) / 3) * Math.min(1, f.age * 3);
      const s = 0.2 + 0.4 * k;
      f.flame.setMatrix(compose(translation(at.x, at.y + 0.18, at.z), rotationY((st.d.camera.yaw * Math.PI) / 180), [s, 0, 0, 0, 0, s * (1.4 + 0.15 * Math.sin(st.time * 9)), 0, 0, 0, 0, s, 0, 0, 0, 0, 1]));
      f.flame.setParams(1);
      f.flame.setVisible(k > 0.05);
      f.puff += dt * 1.5;
      if (f.puff >= 1 && st.puffs.length < 60) {
        f.puff = 0;
        st.puffs.push({ h: st.own.stage.spawnMesh(smokeMesh(false, st.puffs.length % 3, 0), HIDDEN), mist: null, x: at.x, y: at.y + 0.6, z: at.z, age: 0 });
      }
    }

    // ── fire and smoke aboard a hurt ship, carried with it ──
    for (let i = st.burning.length - 1; i >= 0; i--) {
      const b = st.burning[i]!;
      b.age += dt;
      const ship = b.ship;
      const gone = !ship.body || ship.phase === 'idle' || b.age > b.life;
      const under = ship.phase === 'sinking' && ship.t > 3;
      if (gone || under) {
        for (const f of b.flames) f.release();
        st.burning.splice(i, 1);
        continue;
      }
      const deck = (along: number, side: number): [number, number, number] => {
        const sin = Math.sin(ship.pose.yaw), cos = Math.cos(ship.pose.yaw);
        const mm = ship.m;
        void sin;
        void cos;
        const lx = side * 0.2, ly = 0.75, lz = along;
        return [mm[0]! * lx + mm[4]! * ly + mm[8]! * lz + mm[12]!, mm[1]! * lx + mm[5]! * ly + mm[9]! * lz + mm[13]!, mm[2]! * lx + mm[6]! * ly + mm[10]! * lz + mm[14]!];
      };
      const spots = [ship.hull.stern * 0.5, ship.hull.bow * 0.4];
      while (b.flames.length < spots.length) b.flames.push(st.own.stage.spawnMesh(flameMesh(b.flames.length % 3), HIDDEN));
      const fade = Math.min(1, (b.life - b.age) / 3);
      b.flames.forEach((f, k) => {
        const [x, y, z] = deck(spots[k]!, k ? 1 : -1);
        const s = 0.55 * fade + 0.15;
        f.setMatrix(compose(translation(x, y, z), rotationY((st.d.camera.yaw * Math.PI) / 180), [s, 0, 0, 0, 0, s * (1 + 0.1 * Math.sin(st.time * 9 + k)), 0, 0, 0, 0, s, 0, 0, 0, 0, 1]));
        f.setParams(1);
        f.setVisible(fade > 0.05);
      });
      b.puffAcc += dt * 2.5;
      while (b.puffAcc >= 1 && st.puffs.length < 60) {
        b.puffAcc -= 1;
        const [x, y, z] = deck(spots[st.puffs.length % 2]!, 0);
        st.puffs.push({ h: st.own.stage.spawnMesh(smokeMesh(false, st.puffs.length % 3, 0), HIDDEN), mist: null, x, y: y + 0.3, z, age: 0 });
      }
    }
    for (let i = st.puffs.length - 1; i >= 0; i--) {
      const p = st.puffs[i]!;
      p.age += dt;
      const w = signals.wind(p.x, p.z);
      p.x += w.dirX * dt * (0.2 + w.strength * 0.6);
      p.z += w.dirZ * dt * (0.2 + w.strength * 0.6);
      p.y += dt * 0.9;
      // Up and spreading, then thinning into a wash that clears (smoke, as from any fire).
      const s = 0.28 + p.age * 0.12;
      const m = [s, 0, 0, 0, 0, s * 0.9, 0, 0, 0, 0, s, 0, p.x, p.y, p.z, 1];
      if (p.age < 1.6) {
        p.h.setMatrix(m);
        p.h.setVisible(true);
      } else {
        if (!p.mist) {
          p.h.setVisible(false);
          p.mist = st.own.stage.spawnMesh(smokeMesh(true, i % 3), HIDDEN);
        }
        p.mist.setMatrix(m);
        p.mist.setParams(0.75 * Math.max(0, 1 - (p.age - 1.6) / 2.4));
        p.mist.setVisible(true);
      }
      if (p.age > 4) {
        p.h.release();
        p.mist?.release();
        st.puffs.splice(i, 1);
      }
    }
    for (let i = st.spouts.length - 1; i >= 0; i--) {
      const s = st.spouts[i]!;
      s.age += dt;
      const k = Math.min(1, s.age / 1.2);
      const m = Array.from(s.h.base);
      m[5] = Math.sin(k * Math.PI) * 1.4 + 0.001;
      s.h.setMatrix(m);
      s.h.setVisible(k < 1);
      if (k >= 1) {
        s.h.release();
        st.spouts.splice(i, 1);
      }
    }
  },
  dispose(st, ctx) {
    st.off();
    forgetBoatWrecks(ctx.stage);
    st.own.releaseAll();
  },
});
