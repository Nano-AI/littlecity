// The harbour master (L38–L42): every big ship's visit, one at a time at sea.
//
// A VISIT, for a ship that calls at a berth:
//
//   idle       waiting for its next call (the first comes SHIPS.firstCall
//              seconds after the berth exists; then a seeded gap)
//   arriving   up over an edge of the map (it grows out of the distance as
//              it comes), under full sail along a route a whole hull can
//              sail (ship-routes.ts), bow following the path. Sails come in
//              one by one as it nears; it slows to a glide
//   swing-in   if it came in at an angle, the stern swings in about the bow
//              until it lies along the quay
//   warp-in    the mooring lines take it in the last stretch; a bell
//   moored     lines fast, gangplank down, the crew land goods, residents
//              come to look, gulls wheel round the masts. It stays the
//              night, lanterns lit, and never leaves in the dark
//   warp-out   gangplank up, lines cast off (a creak), sails set one by one
//   swing-out  if it must, the bow swings out about the stern
//   leaving    it gathers way and sails off over another edge, going down
//              into the distance as it goes
//
// Only one ship is ever at sea (arriving or leaving) at a time, and two
// never share a berth at once, so ships never meet. A ship alongside is an
// obstacle to the others' routes.
//
// THE TOWN CHANGES UNDER IT. On every change the harbour checks each ship:
// a ship whose way ahead is now blocked finds another; a ship whose berth
// has gone (or whose call has: the port shrank) gives up and leaves from
// where it is; a ship with no way at all, or with something built right
// where it floats, sinks away into the distance where it is (it shrinks,
// it never pops). The goods it landed are carted off a while later.
//
// Pure of the clock: everything comes from `dt`, signals and seeded rand,
// so the same town and clock give the same visits.

import { CELL_H, columnIndex, SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import type { Mat4, Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { MeshBuilder } from '@/gen/mesh';
import { rigOf, type ShipKind } from '@/parts/actors/ships/rig';
import type { ActorOf, DressingPlan, ShapePlan } from '@/resolve/plan';
import { findBerths, hullSize, planningField, SEA_MARGIN, type Berth } from '@/rules/life/berths.fact';
import { hullClear, mooringAt, pathAt, pathClear, pivot, planArrival, planDeparture, type HullSize, type Mooring, type Pose, type SeaField, type Voyage } from '@/rules/life/ship-routes';
import { SHIPS } from '@/style/ships';
import { RAMPS } from '@/style/palette';
import { stick } from '@/parts/actors/boats/hull';
import type { InstanceHandle, LifeStage, Signals } from '../api';
import { swellAt, hullRing, wakeRing, type Swell } from '../boats/afloat';
import { angleDelta, clamp01, easeInOut, easeOut, glide } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { ShipBody, type ShipWind } from './body';
import { Crew, LeftGoods, type Gangway, type Spot } from './crew';
import { Escort } from './escort';
import { newsOf, type BigShipNews } from './news';

export interface CallInfo {
  id: string;
  kind: ShipKind;
  call: ActorOf<'ship-call'>;
}

export type Phase = 'idle' | 'arriving' | 'swing-in' | 'warp-in' | 'moored' | 'warp-out' | 'swing-out' | 'leaving' | 'fading';

export interface Ship {
  id: string;
  kind: ShipKind;
  look: number;
  hull: HullSize;
  berth: Berth;
  dir: 1 | -1;
  mooring: Mooring;
  /** The call has gone from the plan: finish (or abandon) this visit and stop. */
  orphan: boolean;
  phase: Phase;
  /** Seconds in this phase. */
  t: number;
  /** Seconds until it next calls (idle). */
  due: number;
  visits: number;
  voyage: Voyage | null;
  /** Distance along the voyage's path, and speed (columns a second). */
  s: number;
  speed: number;
  pose: Pose;
  /** Drawn size: grows out of the distance arriving, shrinks into it leaving or fading. */
  scale: number;
  /** The edge it came in over (it leaves by another). */
  cameFrom: number;
  body: ShipBody | null;
  crew: Crew | null;
  plank: InstanceHandle | null;
  /** The plank's drawn length, and how far down it is (0 up, 1 resting on the quay). */
  plankLen: number;
  plankK: number;
  lines: InstanceHandle[];
  escort: Escort | null;
  heel: number;
  bank: number;
  swell: Swell;
  phaseSeed: number;
  drawn: number;
  /** Columns sailed since the last ring of the wake; seconds since the last ring alongside. */
  wake: number;
  bowWave: number;
  ring: number;
  m: Mat4;
}

export interface Harbour {
  readonly ships: readonly Ship[];
  sync(shape: ShapePlan, dressing: DressingPlan, calls: readonly CallInfo[]): void;
  update(dt: number, signals: Signals): void;
  dispose(): void;
}

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
/** Margin a ship keeps while close along a quay. */
const NEAR = 0.1;
/** Radians a second a ship swings at the quay. */
const SWING_RATE = 0.085;

const STAY: Record<ShipKind, () => number> = { galleon: () => SHIPS.galleonStay, cog: () => SHIPS.cogStay, galley: () => SHIPS.galleyStay, barge: () => 30 };
const GAP: Record<ShipKind, () => [number, number]> = {
  galleon: () => [SHIPS.galleonGapMin, SHIPS.galleonGapMax],
  cog: () => [SHIPS.cogGapMin, SHIPS.cogGapMax],
  galley: () => [SHIPS.galleyGapMin, SHIPS.galleyGapMax],
  barge: () => [30, 60],
};
const CREW: Record<ShipKind, number> = { galleon: 3, cog: 2, galley: 2, barge: 1 };
/** The order calls are first answered in when a town opens with several. */
const FIRST: Record<ShipKind, number> = { galleon: 0, cog: 1, galley: 2, barge: 3 };

/** The berth a call names (the same numbers berths.fact.ts gives it). */
export function berthOfCall(call: ActorOf<'ship-call'>, berths: readonly Berth[]): Berth | null {
  const p = call.params ?? {};
  const key = `${p.x},${p.z},${p.along},${p.out}`;
  return berths.find((b) => b.key === key) ?? null;
}

/** A unit line of rope along +Z, for mooring lines (scaled to length). */
let LINE: ReturnType<MeshBuilder['build']> | null = null;
function lineMesh(): ReturnType<MeshBuilder['build']> {
  if (!LINE) {
    const b = new MeshBuilder({ ink: 'ship-line' });
    b.setColor(RAMPS.wood[7]!).setInk('rope');
    stick(b, [0, 0, 0], [0, 0, 1], 0.024);
    LINE = b.build();
  }
  return LINE;
}

/** Columns under a hull at a pose (as obstacles for the other ships). */
function hullColumns(h: HullSize, p: Pose): number[] {
  const out = new Set<number>();
  const sx = Math.sin(p.yaw), cz = Math.cos(p.yaw);
  for (let a = h.stern; a <= h.bow; a += 0.3) {
    for (const w of [-h.halfBeam, 0, h.halfBeam]) {
      const x = p.x + sx * a + cz * w, z = p.z + cz * a - sx * w;
      const ix = Math.floor(x), iz = Math.floor(z);
      if (ix >= 0 && iz >= 0 && ix < SIZE_X && iz < SIZE_Z) out.add(columnIndex(ix, iz));
    }
  }
  return [...out];
}

const harbours = new WeakMap<LifeStage, Harbour>();
/** The harbour running on a stage (for tests and the guide). */
export function harbourOf(stage: LifeStage): Harbour | null {
  return harbours.get(stage) ?? null;
}

export function createHarbour(stage: LifeStage, seed: number): Harbour {
  const ships: Ship[] = [];
  const left: LeftGoods[] = [];
  let shape: ShapePlan | null = null;
  let opened = false;
  const fields = new Map<string, SeaField>();
  const news = newsOf(stage);

  /** The field a ship plans in: the town, the small boats' moorings, and the hulls of the other ships alongside. */
  const fieldFor = (ship: Ship): SeaField => {
    const others = ships.filter((o) => o !== ship && o.body && o.phase !== 'arriving' && o.phase !== 'leaving' && o.phase !== 'idle');
    const k = `${ship.id}|${others.map((o) => `${o.id}:${o.phase === 'moored' ? 'm' : 'x'}`).join(',')}`;
    let f = fields.get(k);
    if (!f) {
      const extra = others.flatMap((o) => hullColumns(o.hull, o.phase === 'moored' ? o.mooring : o.pose));
      f = planningField(shape!.facts, ship.berth, extra);
      fields.set(k, f);
    }
    return f;
  };
  const r = (ship: Ship, what: string): number => rand(seed, 'ship', ship.id, what, ship.visits);
  const gap = (ship: Ship): number => {
    const [lo, hi] = GAP[ship.kind]();
    return lo + (hi - lo) * r(ship, 'gap');
  };
  const atSea = (): boolean => ships.some((s) => s.phase === 'arriving' || s.phase === 'leaving');
  const berthBusy = (ship: Ship): boolean => ships.some((s) => s !== ship && s.phase !== 'idle' && s.phase !== 'arriving' && s.phase !== 'fading' && s.phase !== 'leaving' && s.berth.key === ship.berth.key) || ships.some((s) => s !== ship && s.phase === 'arriving' && s.berth.key === ship.berth.key);

  const spawnBody = (ship: Ship, set: number): void => {
    ship.body?.release();
    ship.body = new ShipBody(stage, ship.kind, ship.look, HIDDEN, set);
  };

  const setPhase = (ship: Ship, phase: Phase): void => {
    ship.phase = phase;
    ship.t = 0;
  };

  /** Ends a visit: everything the ship drew goes; its goods stay a while. */
  const finish = (ship: Ship): void => {
    ship.body?.release();
    ship.body = null;
    ship.crew?.release();
    if (ship.crew && ship.crew.landed.length) left.push(new LeftGoods([...ship.crew.landed], pileSpots(ship), SHIPS.goodsLinger));
    ship.crew = null;
    ship.plank?.release();
    ship.plank = null;
    ship.plankK = 0;
    for (const l of ship.lines) l.release();
    ship.lines = [];
    ship.escort?.leave();
    ship.voyage = null;
    ship.visits++;
    ship.due = gap(ship);
    setPhase(ship, 'idle');
  };

  /** Off to sea from where it is now (the berth has gone, or its way ahead is blocked). */
  const leaveFromHere = (ship: Ship): void => {
    const field = fieldFor(ship);
    const v = planDeparture(field, ship.hull, ship.mooring, SHIPS.edgeIn, SEA_MARGIN, r(ship, 'exit'), -1, ship.pose);
    if (v && hullClear(field, ship.hull, ship.pose.x, ship.pose.z, ship.pose.yaw, 0)) {
      ship.voyage = v;
      ship.s = 0;
      ship.body?.setAll(1);
      setPhase(ship, 'leaving');
    } else setPhase(ship, 'fading');
  };

  /** Where the gangplank comes down, and where the goods are piled: on the quay beside the ship's middle. */
  const gangwayOf = (ship: Ship): { way: Gangway; side: number } => {
    const rig = rigOf(ship.kind, ship.look);
    const m = ship.mooring;
    // The quay is on the side opposite the water; the ship's +X points (cos yaw, −sin yaw).
    const side = Math.cos(m.yaw) * -m.ox + -Math.sin(m.yaw) * -m.oz > 0 ? 1 : -1;
    const [gx, gy, gz] = rig.gangway;
    const deck = rig.hull.deck(rig.hull.t(gz));
    const way: Gangway = {
      hatch: [side * -0.1, deck, gz - 0.55],
      rail: [side * (gx - 0.22), deck, gz],
      top: [side * (gx - 0.04), gy + 0.02, gz],
      foot: [0, 0, 0],
    };
    // The foot: straight across onto the quay, 0.45 in from its face.
    const b = ship.berth;
    const wx = m.x + Math.cos(m.yaw) * side * gx + Math.sin(m.yaw) * gz, wz = m.z - Math.sin(m.yaw) * side * gx + Math.cos(m.yaw) * gz;
    const faceDist = (wx - b.face.ax) * b.face.ox + (wz - b.face.az) * b.face.oz;
    way.foot = [wx - b.face.ox * (faceDist + 0.45), b.level * CELL_H + 0.02, wz - b.face.oz * (faceDist + 0.45)];
    return { way, side };
  };
  const pileSpots = (ship: Ship): Spot[] => {
    const { way } = gangwayOf(ship);
    const b = ship.berth;
    const f = way.foot;
    const yaw = Math.atan2(-b.face.ox, -b.face.oz);
    const out: Spot[] = [];
    const n = Math.max(0, Math.round(SHIPS.goodsMax));
    for (let i = 0; i < n; i++) {
      // Two rows along the quay, beside the plank's foot, a little further in.
      const along = (i % 3 === 0 ? 0.55 : i % 3 === 1 ? 0.82 : -0.6) * (i >= 3 ? -1 : 1);
      const depth = 0.18 + (i >= 3 ? 0.04 : 0);
      out.push({ x: f[0] + b.face.dx * along - b.face.ox * depth, y: f[1], z: f[2] + b.face.dz * along - b.face.oz * depth, yaw: yaw + (rand(seed, 'pile', ship.id, i) - 0.5) * 0.5 });
    }
    return out;
  };

  /** Starts a call: plan the way in, or try again a little later. */
  const begin = (ship: Ship): void => {
    const field = fieldFor(ship);
    const v = planArrival(field, ship.hull, ship.mooring, SHIPS.edgeIn, SEA_MARGIN, r(ship, 'entry'));
    if (!v) {
      ship.due = 20;
      return;
    }
    ship.voyage = v;
    ship.s = 0;
    ship.speed = SHIPS.sailSpeed * 0.8;
    ship.cameFrom = v.edge.side;
    ship.scale = 0.02;
    const p = pathAt(v.path, 0);
    ship.pose = { x: p.x, z: p.z, yaw: p.yaw };
    spawnBody(ship, 1);
    ship.escort ??= new Escort(stage, seed, ship.id);
    setPhase(ship, 'arriving');
  };

  /** Lies at the berth right away (a town opened with a ship in). */
  const moorNow = (ship: Ship, into: number): void => {
    ship.pose = { x: ship.mooring.x, z: ship.mooring.z, yaw: ship.mooring.yaw };
    ship.scale = 1;
    spawnBody(ship, 0);
    ship.escort ??= new Escort(stage, seed, ship.id);
    ship.cameFrom = -1;
    setPhase(ship, 'moored');
    ship.t = into;
  };

  const stepShip = (ship: Ship, dt: number, signals: Signals): void => {
    ship.t += dt;
    const body = ship.body;
    const wind = signals.wind(ship.pose.x, ship.pose.z);
    const sin = Math.sin(ship.pose.yaw), cos = Math.cos(ship.pose.yaw);
    const w: ShipWind = { lee: wind.dirX * cos - wind.dirZ * sin, along: wind.dirX * sin + wind.dirZ * cos, strength: wind.strength };
    const full = ship.kind === 'galley' ? SHIPS.rowSpeed : SHIPS.sailSpeed * (0.85 + 0.15 * w.along);
    const len = ship.hull.bow - ship.hull.stern;
    const before = { ...ship.pose };
    const rowing = ship.kind === 'galley';

    switch (ship.phase) {
      case 'idle': {
        if (ship.orphan) return;
        ship.due -= dt;
        return;
      }
      case 'arriving': {
        const v = ship.voyage!;
        const remaining = v.path.length - ship.s;
        const want = full * Math.min(1, Math.max(0.16, Math.sqrt(Math.max(0, remaining) / SHIPS.slowing)));
        ship.speed += (want - ship.speed) * glide(0.8, dt);
        ship.s = Math.min(v.path.length, ship.s + ship.speed * dt);
        const p = pathAt(v.path, ship.s);
        ship.pose.x = p.x;
        ship.pose.z = p.z;
        ship.pose.yaw += angleDelta(ship.pose.yaw, p.yaw) * glide(SHIPS.turn * 3, dt);
        ship.scale = Math.max(0.02, easeOut(clamp01(ship.t / SHIPS.rise)));
        if (body) {
          // Sails come in one by one as it nears, the last at the very end.
          const n = body.sails.length;
          body.sails.forEach((sp, i) => {
            const rank = n - 1 - body.rig.sails[i]!.order;
            sp.want = remaining > SHIPS.slowing * (1 - rank / Math.max(1, n)) * 0.95 + 0.6 ? 1 : 0;
            if (rowing) sp.want = w.along > 0.35 && remaining > 4 ? 1 : 0;
          });
          if (rowing) body.rowing = remaining > 2.2 ? Math.min(1, body.rowing + dt) : Math.max(0, body.rowing - dt * 0.8);
        }
        if (ship.s >= v.path.length - 1e-6) setPhase(ship, v.swing !== 0 ? 'swing-in' : 'warp-in');
        break;
      }
      case 'swing-in': {
        const v = ship.voyage!;
        const dur = Math.abs(v.swing) / SWING_RATE;
        const k = easeInOut(clamp01(ship.t / dur));
        const warp: Pose = { x: ship.mooring.wx, z: ship.mooring.wz, yaw: ship.mooring.yaw };
        pivot(warp, ship.hull.bow, v.swing * (1 - k), ship.pose);
        if (body && rowing) body.rowing = Math.max(0, body.rowing - dt);
        if (ship.t >= dur) setPhase(ship, 'warp-in');
        break;
      }
      case 'warp-in': {
        if (ship.t < dt * 1.5) {
          news.sounds.push({ kind: 'bell', x: ship.pose.x, z: ship.pose.z });
          ship.lines = [stage.spawnMesh(lineMesh(), HIDDEN), stage.spawnMesh(lineMesh(), HIDDEN)];
        }
        const k = easeInOut(clamp01(ship.t / SHIPS.warp));
        const m = ship.mooring;
        ship.pose.x = m.wx + (m.x - m.wx) * k;
        ship.pose.z = m.wz + (m.z - m.wz) * k;
        ship.pose.yaw = m.yaw;
        if (body) {
          body.setAll(0);
          if (rowing) body.rowing = Math.max(0, body.rowing - dt);
        }
        if (ship.t >= SHIPS.warp) {
          setPhase(ship, 'moored');
          ship.voyage = null;
          ship.crew?.release();
          ship.crew = null;
        }
        break;
      }
      case 'moored': {
        const m = ship.mooring;
        ship.pose.x = m.x;
        ship.pose.z = m.z;
        ship.pose.yaw = m.yaw;
        if (!ship.lines.length) ship.lines = [stage.spawnMesh(lineMesh(), HIDDEN), stage.spawnMesh(lineMesh(), HIDDEN)];
        body?.setAll(0);
        if (body && rowing) body.rowing = 0;
        const stay = STAY[ship.kind]();
        const night = signals.time.isNight || signals.time.isDusk;
        if (!ship.crew) ship.crew = new Crew(stage, (rand(seed, 'crew', ship.id, ship.visits) * 1e9) >>> 0, ship.kind, CREW[ship.kind], Math.round(SHIPS.goodsMax * (ship.kind === 'galleon' ? 1 : 0.67)), pileSpots(ship));
        if (!ship.plank) {
          const { way } = gangwayOf(ship);
          const top = transform(fly(m.x, SEA_Y, m.z, m.yaw, 0, 0, 1), way.top);
          ship.plankLen = Math.max(0.3, Math.hypot(way.foot[0] - top[0], way.foot[1] - top[1], way.foot[2] - top[2]));
          ship.plank = stage.spawn({ actor: 'gangplank', params: { length: Math.round(ship.plankLen * 20) / 20 } }, HIDDEN);
          ship.plankLen = Math.round(ship.plankLen * 20) / 20;
        }
        // The plank comes down once it is fast, and up again when the stay is over and the crew are aboard.
        const done = (ship.t >= stay && !night) || ship.orphan;
        const want = done && ship.crew.aboard ? 0 : ship.t > 0.8 ? 1 : 0;
        ship.plankK = Math.max(0, Math.min(1, ship.plankK + (want > ship.plankK ? dt : -dt) / 1.8));
        if (done && ship.crew.aboard && ship.plankK <= 0) {
          setPhase(ship, 'warp-out');
          news.sounds.push({ kind: 'creak', x: ship.pose.x, z: ship.pose.z });
        }
        break;
      }
      case 'warp-out': {
        if (ship.t < dt * 1.5 && !ship.voyage) {
          const field = fieldFor(ship);
          ship.voyage = planDeparture(field, ship.hull, ship.mooring, SHIPS.edgeIn, SEA_MARGIN, r(ship, 'exit'), ship.cameFrom) ?? planDeparture(field, ship.hull, ship.mooring, SHIPS.edgeIn, SEA_MARGIN, r(ship, 'exit'));
          if (!ship.voyage) {
            // Nowhere to go: stay at the berth and try again later (or, if the berth is gone, sink away).
            if (ship.orphan || !shape) setPhase(ship, 'fading');
            else setPhase(ship, 'moored');
            return;
          }
        }
        const dur = SHIPS.warp * 0.8;
        const k = easeInOut(clamp01(ship.t / dur));
        const m = ship.mooring;
        ship.pose.x = m.x + (m.wx - m.x) * k;
        ship.pose.z = m.z + (m.wz - m.z) * k;
        ship.pose.yaw = m.yaw;
        if (body) {
          // Sails set one by one, the first as the lines come in.
          body.sails.forEach((sp, i) => {
            sp.want = ship.t > body.rig.sails[i]!.order * SHIPS.sailEvery ? 1 : 0;
            if (rowing) sp.want = w.along > 0.35 ? sp.want : 0;
          });
          if (rowing) body.rowing = Math.min(1, ship.t / dur);
        }
        if (ship.t > 0.6 && ship.lines.length) {
          for (const l of ship.lines) l.release();
          ship.lines = [];
        }
        if (ship.t >= dur && ship.voyage) setPhase(ship, ship.voyage.swing !== 0 ? 'swing-out' : 'leaving');
        break;
      }
      case 'swing-out': {
        const v = ship.voyage!;
        const dur = Math.abs(v.swing) / SWING_RATE;
        const k = easeInOut(clamp01(ship.t / dur));
        const warp: Pose = { x: ship.mooring.wx, z: ship.mooring.wz, yaw: ship.mooring.yaw };
        pivot(warp, ship.hull.stern, v.swing * k, ship.pose);
        if (body) body.sails.forEach((sp, i) => (sp.want = rowing ? sp.want : ship.t + SHIPS.warp * 0.8 > body.rig.sails[i]!.order * SHIPS.sailEvery ? 1 : 0));
        if (ship.t >= dur) {
          setPhase(ship, 'leaving');
          ship.s = 0;
          ship.speed = 0.08;
        }
        break;
      }
      case 'leaving': {
        const v = ship.voyage!;
        if (body && !rowing) body.sails.forEach((sp, i) => (sp.want = ship.t + SHIPS.warp > body.rig.sails[i]!.order * SHIPS.sailEvery * 0.6 ? 1 : 0));
        if (body && rowing) body.rowing = Math.min(1, body.rowing + dt);
        // Gathering way as the sails fill.
        const want = full * Math.min(1, 0.18 + ship.s / (len * 1.2)) * (rowing ? 1 : 0.35 + 0.65 * (body?.canvas ?? 1));
        ship.speed += (want - ship.speed) * glide(0.6, dt);
        ship.s = Math.min(v.path.length, ship.s + ship.speed * dt);
        const p = pathAt(v.path, ship.s);
        ship.pose.x = p.x;
        ship.pose.z = p.z;
        ship.pose.yaw += angleDelta(ship.pose.yaw, p.yaw) * glide(SHIPS.turn * 3, dt);
        const remaining = v.path.length - ship.s;
        ship.scale = Math.min(1, Math.max(0, remaining / Math.max(0.5, SHIPS.rise * Math.max(0.3, ship.speed))));
        ship.scale = easeOut(ship.scale);
        if (remaining <= 1e-6) {
          finish(ship);
          return;
        }
        break;
      }
      case 'fading': {
        ship.scale = Math.max(0, ship.scale - dt / 2.2);
        if (ship.lines.length) {
          for (const l of ship.lines) l.release();
          ship.lines = [];
        }
        if (ship.plank) {
          ship.plank.release();
          ship.plank = null;
        }
        if (ship.scale <= 0) {
          finish(ship);
          return;
        }
        break;
      }
    }

    // ── the crew, the gangplank and the lines, while it lies alongside ──
    const alongside = ship.phase === 'moored' || ship.phase === 'warp-out' || ship.phase === 'warp-in';
    const { way, side } = gangwayOf(ship);
    if (ship.crew) ship.crew.update(dt, ship.m, way, ship.phase === 'moored' && ship.t < STAY[ship.kind]() - 6 && !ship.orphan);
    if (ship.phase !== 'moored' && ship.crew && ship.crew.aboard) {
      if (ship.crew.landed.length) left.push(new LeftGoods([...ship.crew.landed], pileSpots(ship), SHIPS.goodsLinger));
      ship.crew.release();
      ship.crew = null;
    }
    if (ship.plank) {
      // Swung up from the rail (raised) down to rest on the quay.
      const top = transform(ship.m, way.top);
      const f = way.foot;
      const dx = f[0] - top[0], dy = f[1] - top[1], dz = f[2] - top[2];
      const flat = Math.hypot(dx, dz), length = Math.hypot(flat, dy);
      const yaw = Math.atan2(dx, dz);
      const k = easeInOut(ship.plankK);
      const pitch = Math.atan2(-dy, flat) * k - 1.25 * (1 - k);
      const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const sz = length / ship.plankLen;
      ship.plank.setMatrix([cy, 0, -sy, 0, sy * sp, cp, cy * sp, 0, sy * cp * sz, -sp * sz, cy * cp * sz, 0, top[0], top[1] + 0.02, top[2], 1]);
      if (ship.phase !== 'moored') {
        ship.plank.release();
        ship.plank = null;
        ship.plankK = 0;
      }
    }
    if (ship.lines.length === 2 && alongside) {
      // Bow and stern lines from the rail to the quay, a little beyond each end.
      const rig = rigOf(ship.kind, ship.look);
      const b = ship.berth;
      const ends = [rig.hull.z(0.92, 0.5), rig.hull.z(0.08, 0.5)];
      ends.forEach((zl, i) => {
        const y = rig.hull.rail(rig.hull.t(zl));
        const from = transform(ship.m, [side * rig.hull.outer(rig.hull.t(zl), y), y, zl]);
        const fd = (from[0] - b.face.ax) * b.face.ox + (from[2] - b.face.az) * b.face.oz;
        const ax = Math.sin(ship.pose.yaw) * (i === 0 ? 0.9 : -0.9), az = Math.cos(ship.pose.yaw) * (i === 0 ? 0.9 : -0.9);
        const to: Vec3 = [from[0] - b.face.ox * (fd + 0.25) + ax, b.level * CELL_H + 0.08, from[2] - b.face.oz * (fd + 0.25) + az];
        ship.lines[i]!.setMatrix(lineMatrix(from, to));
      });
    }

    // ── the hull: swell on twos, heel, bank; everything placed every frame ──
    if (!ship.body) return;
    const now = onTwos(signals.time.seconds, ship.phaseSeed);
    if (now !== ship.drawn) {
      const step = Number.isNaN(ship.drawn) ? 1 / 12 : Math.max(0, now - ship.drawn);
      ship.drawn = now;
      swellAt(now, ship.phaseSeed, len * 0.35, wind.strength, ship.swell);
      ship.body.trim(step, w, SHIPS.sailTime);
      if (rowing) ship.body.stroke = (ship.body.stroke + step * (0.35 + 0.45 * Math.min(1, ship.speed / SHIPS.rowSpeed))) % 1;
      const heel = -SHIPS.heel * Math.min(1, wind.strength) * ship.body.canvas * w.lee;
      ship.heel += (heel - ship.heel) * Math.min(1, step * 1.5);
    }
    const turn = dt > 0 ? angleDelta(before.yaw, ship.pose.yaw) / dt : 0;
    ship.bank += (Math.max(-0.05, Math.min(0.05, -turn * 0.2)) - ship.bank) * Math.min(1, dt * 2);
    const sw = ship.swell;
    const calm = alongside ? 0.35 : 0.6;
    fly(ship.pose.x, SEA_Y + sw.heave * calm * ship.scale, ship.pose.z, ship.pose.yaw, sw.pitch * calm * 0.6, sw.roll * calm * 0.6 + ship.heel + ship.bank, ship.scale, ship.m);
    ship.body.pose(ship.m, Math.atan2(wind.dirX, wind.dirZ), ship.scale);

    // ── the water: a wake astern and a bow wave under way, rings alongside ──
    const moved = Math.hypot(ship.pose.x - before.x, ship.pose.z - before.z);
    ship.wake += moved;
    ship.bowWave += moved;
    if (ship.wake > 1.1 && ship.scale > 0.3) {
      ship.wake = 0;
      wakeRing(stage, ship.pose.x + sin * ship.hull.stern * ship.scale, ship.pose.z + cos * ship.hull.stern * ship.scale, ship.hull.halfBeam * 0.55 * ship.scale, 2.8, 2.6);
    }
    if (ship.bowWave > 0.55 && ship.scale > 0.3 && ship.speed > 0.25) {
      ship.bowWave = 0;
      const bx = ship.pose.x + sin * (ship.hull.bow - 0.9) * ship.scale, bz = ship.pose.z + cos * (ship.hull.bow - 0.9) * ship.scale;
      hullRing(stage, bx, bz, ship.pose.yaw, ship.hull.halfBeam * 1.1 * ship.scale, 1.1 * ship.scale, 1.7, 1.1);
    }
    if (alongside) {
      ship.ring += dt;
      if (ship.ring > 3.4) {
        ship.ring = 0;
        const mid = (ship.hull.stern + ship.hull.bow) / 2;
        hullRing(stage, ship.pose.x + sin * mid, ship.pose.z + cos * mid, ship.pose.yaw, ship.hull.halfBeam * 2, len, 1.15, 2.4);
      }
    }
  };

  const harbour: Harbour = {
    ships,
    sync(nextShape, _dressing, calls) {
      const changed = nextShape !== shape;
      shape = nextShape;
      if (changed) fields.clear();
      const berths = findBerths(nextShape.facts);
      const seen = new Set<string>();
      for (const c of calls) {
        if (c.kind === 'barge') continue;
        seen.add(c.id);
        const berth = berthOfCall(c.call, berths);
        if (!berth) continue;
        const dir = (c.call.params?.dir ?? 1) < 0 ? -1 : 1;
        const hull = hullSize(c.kind as 'galleon');
        let ship = ships.find((s) => s.id === c.id);
        if (!ship) {
          ship = {
            id: c.id, kind: c.kind, look: Math.abs(Math.round(c.call.params?.look ?? 0)), hull, berth, dir,
            mooring: mooringAt(hull, berth.face, dir, SHIPS.alongside, SHIPS.warpGap),
            orphan: false, phase: 'idle', t: 0, due: SHIPS.firstCall + FIRST[c.kind] * 30, visits: 0, voyage: null, s: 0, speed: 0,
            pose: { x: 0, z: 0, yaw: 0 }, scale: 1, cameFrom: -1, body: null, crew: null, plank: null, plankLen: 1, plankK: 0, lines: [], escort: null,
            heel: 0, bank: 0, swell: { heave: 0, roll: 0, pitch: 0 }, phaseSeed: rand(seed, 'ship-phase', c.id), drawn: NaN, wake: 0, bowWave: 0, ring: 0,
            m: new Array<number>(16).fill(0),
          };
          ships.push(ship);
        } else if (ship.berth.key !== berth.key || ship.dir !== dir) {
          // Its berth moved: finish this visit as if the old one had gone, then use the new one.
          if (ship.phase === 'idle') {
            ship.berth = berth;
            ship.dir = dir;
            ship.mooring = mooringAt(hull, berth.face, dir, SHIPS.alongside, SHIPS.warpGap);
          } else ship.orphan = true;
        } else ship.orphan = false;
      }
      for (const s of ships) if (!seen.has(s.id)) s.orphan = true;
      // A town opened with a port: the first ship is already in.
      const first = !opened;
      opened = true;
      if (first && ships.length) {
        const lead = [...ships].sort((a, b) => FIRST[a.kind] - FIRST[b.kind])[0]!;
        if (lead.phase === 'idle' && !lead.orphan) moorNow(lead, STAY[lead.kind]() * 0.2);
        for (const s of ships) if (s !== lead) s.due = Math.max(s.due, STAY[lead.kind]() + 30);
      }
      if (!changed) return;
      // ── the town changed: check every ship under it ──
      for (const ship of ships) {
        if (ship.phase === 'idle' || ship.phase === 'fading') continue;
        const field = fieldFor(ship);
        if (!hullClear(field, ship.hull, ship.pose.x, ship.pose.z, ship.pose.yaw, -0.05)) {
          // Something stands where it floats: it sinks away into the distance.
          setPhase(ship, 'fading');
          continue;
        }
        const v = ship.voyage;
        if (ship.phase === 'arriving' && v) {
          if (ship.orphan) leaveFromHere(ship);
          else if (!pathClear(field, ship.hull, v.path, NEAR, ship.s, v.path.length)) {
            const again = planArrival(field, ship.hull, ship.mooring, SHIPS.edgeIn, SEA_MARGIN, 0, -1, ship.pose);
            if (again) {
              ship.voyage = again;
              ship.s = 0;
            } else leaveFromHere(ship);
          }
        } else if (ship.phase === 'leaving' && v) {
          if (!pathClear(field, ship.hull, v.path, NEAR, ship.s, v.path.length)) leaveFromHere(ship);
        } else if ((ship.phase === 'swing-in' || ship.phase === 'warp-in') && ship.orphan) {
          leaveFromHere(ship);
        } else if ((ship.phase === 'swing-out' || ship.phase === 'warp-out') && v) {
          if (!pathClear(field, ship.hull, v.path, NEAR, 0, v.path.length)) {
            ship.voyage = null;
            if (ship.phase === 'swing-out') leaveFromHere(ship);
          }
        }
      }
    },
    update(dt, signals) {
      // Calls that are due, one at a time at sea, never two at one berth.
      if (!atSea()) {
        const due = ships.filter((s) => s.phase === 'idle' && !s.orphan && s.due <= 0 && !berthBusy(s)).sort((a, b) => a.due - b.due || FIRST[a.kind] - FIRST[b.kind]);
        if (due[0] && shape) begin(due[0]);
      }
      news.ships.length = 0;
      news.inPort.clear();
      for (const ship of ships) {
        stepShip(ship, dt, signals);
        if (ship.body && ship.phase !== 'idle') {
          const n: BigShipNews = { x: ship.pose.x, z: ship.pose.z, yaw: ship.pose.yaw, stern: ship.hull.stern * ship.scale, bow: ship.hull.bow * ship.scale, halfBeam: ship.hull.halfBeam * ship.scale, speed: ship.phase === 'arriving' || ship.phase === 'leaving' ? ship.speed : 0 };
          news.ships.push(n);
        }
        if (ship.phase === 'warp-in' || ship.phase === 'moored' || ship.phase === 'warp-out') news.inPort.add(ship.id);
        // Gulls come out to a ship near the town and wheel round its masts.
        if (ship.escort) {
          const near = ship.phase !== 'idle' && ship.phase !== 'fading' && !(ship.phase === 'leaving' && ship.s > 10) && !(ship.phase === 'arriving' && ship.voyage!.path.length - ship.s > 14);
          const rig = rigOf(ship.kind, ship.look);
          const top = rig.masts[Math.min(1, rig.masts.length - 1)]!;
          const at = transform(ship.m, [0, top.head + 0.3, top.z]);
          ship.escort.update(dt, signals, near && !signals.time.isNight, at, ship.phase === 'moored' ? 1.6 : 2.2);
        }
      }
      // Orphans that have finished their last visit go.
      for (let i = ships.length - 1; i >= 0; i--) {
        const s = ships[i]!;
        if (s.orphan && s.phase === 'idle') {
          s.escort?.release();
          ships.splice(i, 1);
        }
      }
      for (let i = left.length - 1; i >= 0; i--) if (!left[i]!.update(dt)) left.splice(i, 1);
    },
    dispose() {
      for (const s of ships) {
        s.body?.release();
        s.crew?.release();
        s.plank?.release();
        for (const l of s.lines) l.release();
        s.escort?.release();
        if (s.crew) for (const g of s.crew.landed) g.release();
      }
      ships.length = 0;
      for (const l of left) l.release();
      left.length = 0;
      news.ships.length = 0;
      news.inPort.clear();
    },
  };
  harbours.set(stage, harbour);
  return harbour;
}

function transform(m: Mat4, p: Vec3): Vec3 {
  return [m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!, m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!, m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!];
}

/** A matrix taking the unit line (0,0,0)–(0,0,1) to run from a to b, sagging is left to the eye. */
function lineMatrix(a: Vec3, b: Vec3): Mat4 {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  const zx = dx / len, zy = dy / len, zz = dz / len;
  // X square to the line and level; Y square to both.
  let xx = zz, xz = -zx;
  const xl = Math.hypot(xx, xz) || 1;
  xx /= xl;
  xz /= xl;
  const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
  return [xx, 0, xz, 0, yx, yy, yz, 0, zx * len, zy * len, zz * len, 0, a[0], a[1], a[2], 1];
}

