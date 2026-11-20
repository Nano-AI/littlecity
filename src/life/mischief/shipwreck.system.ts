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

import { SEA_Y } from '@/core/grid';
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
import { flameMesh, smokeMesh, spoutMesh, wreckPieceMesh } from './meshes';
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
  burning: Burning[];
  puffs: Puff[];
  spouts: { h: InstanceHandle; age: number }[];
  /** A nuke's strike waits for its shockwave. */
  pending: { at: number; x: number; z: number; power: number }[];
  time: number;
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
    const shroud = up && cy > m.foot + 0.5 && Math.abs(cz - m.z) < 0.7 && Math.abs(cx) < 0.9 && Math.abs(cx) > 0.2;
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
  const ship = h.ship;
  const body = ship.body;
  if (!body || !st.shape) return;
  const seed = h.ship.visits * 31 + ship.look;
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
  if (h.stage === 3) {
    // Where it goes down: wreckage on the water.
    const len = ship.hull.bow - ship.hull.stern;
    for (let i = 0; i < 9; i++) {
      const u = rand(seed, 'wreck-u', i), v = rand(seed, 'wreck-v', i) - 0.5;
      const along = ship.hull.stern + u * len;
      const sin = Math.sin(ship.pose.yaw), cos = Math.cos(ship.pose.yaw);
      const x = ship.pose.x + sin * along + cos * v * ship.hull.halfBeam * 2;
      const z = ship.pose.z + cos * along - sin * v * ship.hull.halfBeam * 2;
      st.pieces.push(piece(st, i, x, SEA_Y + 0.6, z, (rand(seed, 'wx', i) - 0.5) * 1.6, 1.5 + rand(seed, 'wy', i), (rand(seed, 'wz', i) - 0.5) * 1.6, seed + 100 + i));
    }
    st.spouts.push({ h: st.own.stage.spawnMesh(spoutMesh(), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ship.pose.x, SEA_Y, ship.pose.z, 1]), age: 0 });
  }
}

function piece(st: State, kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, seed: number): Piece {
  return { h: st.own.stage.spawnMesh(wreckPieceMesh(kind), HIDDEN), x, y, z, yaw: rand(seed, 'yaw') * 6, vx, vy, vz, air: true, age: 0, spin: (rand(seed, 'spin') - 0.5) * 8, seed };
}

function strike(st: State, stage: LifeStage, x: number, z: number, power: number): void {
  const harbour = harbourOf(stage);
  if (!harbour) return;
  const hits = harbour.strike(x, z, BLAST.rubble * power * 0.9, BLAST.wreck * power, BLAST.shake * power);
  for (const h of hits) hit(st, stage, h, [x, z]);
}

function clearAll(st: State): void {
  for (const p of st.pieces) p.h.release();
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
    harbourOf(stage)?.clearWrecks();
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
    const st: State = { d: mischiefOf(ctx.stage), own: ownStage(ctx.stage), shape: null, pieces: [], burning: [], puffs: [], spouts: [], pending: [], time: 0, off: () => {} };
    st.off = st.d.on((e) => onEvent(st, ctx.stage, e));
    // For tests and watching (like __lcPeople): the harbour on this stage.
    Object.defineProperty(globalThis, '__lcHarbour', { get: () => harbourOf(ctx.stage), configurable: true });
    return st;
  },
  sync(st, next) {
    st.shape = next.shape;
  },
  update(st, dt, signals, ctx) {
    st.time += dt;
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
  dispose(st) {
    st.off();
    st.own.releaseAll();
  },
});
