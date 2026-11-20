// The river barge (L41): poled to and fro between its two ends (two river
// docks, or a river dock and the river's mouth), lying a while at each to
// load and unload. It is double-ended in use: the bargeman poles from
// whichever end is aft, and the barge goes stern first on the way back
// rather than turning in a narrow river. It never moves sideways. Under a
// bridge (anything built over the water just ahead, an arch at the water
// included) the mast comes down aft, and goes up again beyond. A sail is set
// only with the wind astern.
//
// It never vanishes. A barge that comes to a town already open poles in
// through the edge of the map (the renderer cuts it off there); a barge
// whose run has gone poles away out through it. If the water under it is
// built on it is nudged aside first; with no way out it stays where it is,
// afloat; only with no water left at all does it go, in the removal puff.

import type { Mat4 } from '@/core/mat4';
import { columnIndex, keyX, keyY, keyZ, SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import { rand } from '@/core/rand';
import { toolMesh, TOOL_PIECE } from '@/parts/people/extras';
import { buildPerson, lookOf, PIECES, type Look } from '@/parts/people/person';
import { poseOf, rigMatrices } from '@/parts/people/pose';
import type { ShapePlan } from '@/resolve/plan';
import { hullSize } from '@/rules/life/berths.fact';
import { BARGE_CLEAR, bargeWater, lowObstacles } from '@/rules/life/L41.river-barge.rule';
import { beyond, edgePoints, graphFrom, hullClear, mapEdge, pathAt, pathOf, routeTo, seaField, type Path, type Pt, type SeaField } from '@/rules/life/ship-routes';
import { SHIPS } from '@/style/ships';
import { PALETTE, RAMPS } from '@/style/palette';
import type { InstanceHandle, LifeStage, Signals } from '../api';
import { swellAt, wakeRing, type Swell } from '../boats/afloat';
import { angleDelta, approach, easeInOut, glide } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { ShipBody } from './body';
import { clearAhead, floatPoints, type BigShipNews } from './news';
import { removalPuff } from './puff';
import { nearestFree } from './visit';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
/** Seconds lying at each end. */
const LIE = 18;
const HULL = hullSize('barge');

type Mode = 'run' | 'coming' | 'leaving' | 'nudging' | 'resident';

export class Barge {
  private body: ShipBody;
  /** Its run between A and B, and (coming or leaving) the way in or out through the edge. */
  private path: Path | null = null;
  private leg: Path | null = null;
  private mode: Mode = 'run';
  /** Distance along the run from A, which way it is going (+1 to B, −1 back to A), seconds lying at an end. */
  private s = 0;
  private way = 1;
  private lying = LIE * 0.5;
  private speed = 0;
  x = 0;
  z = 0;
  yaw = 0;
  private from = { x: 0, z: 0, yaw: 0 };
  /** Lying stern to the way its path runs (it is double-ended, and came in the other way round). */
  private flip = false;
  /** The way it goes, along its own hull: +1 bow first, −1 stern first. */
  private get hullWay(): number {
    return this.mode === 'run' || this.mode === 'coming' || this.mode === 'leaving' ? this.way * (this.flip ? -1 : 1) : this.way;
  }
  private to = { x: 0, z: 0, yaw: 0 };
  private t = 0;
  private swell: Swell = { heave: 0, roll: 0, pitch: 0 };
  private drawn = NaN;
  private phase: number;
  private wake = 0;
  private m: Mat4 = new Array<number>(16).fill(0);
  private bridges = new Set<number>();
  private field: SeaField | null = null;
  /** True once it has gone (out through the edge, or in a puff): the harbour releases it. */
  gone = false;
  private look: Look;
  private man: InstanceHandle[];
  private pole: InstanceHandle;
  private mats = new Float32Array(80);
  private world = new Array<number>(16).fill(0);

  constructor(private stage: LifeStage, private seed: number, readonly id: string, look: number, public a: Pt, public b: Pt, private arrive = false) {
    this.body = new ShipBody(stage, 'barge', look, HIDDEN, 0);
    this.phase = rand(seed, 'barge', id);
    this.look = { ...lookOf((rand(seed, 'bargeman', id) * 1e9) >>> 0), dress: false, hat: 'straw', hatColor: PALETTE.yellow, top: RAMPS.roof[3]!, child: false };
    const meshes = buildPerson(this.look, `bargeman-${id}`);
    this.man = PIECES.map((p) => stage.spawnMesh(meshes[p], HIDDEN));
    this.pole = stage.spawnMesh(toolMesh('pole', RAMPS.wood[1]!), HIDDEN);
    this.x = a[0];
    this.z = a[1];
  }

  /** On its way out for good (its run has gone). */
  get leaving(): boolean {
    return this.mode === 'leaving' || this.mode === 'resident';
  }

  /** The way between a point and the edge of the map through water a barge fits, out to beyond it (or in, reversed). */
  private toEdge(from: Pt, reverse: boolean): Path | null {
    const field = this.field!;
    const g = graphFrom(field, from, BARGE_CLEAR);
    const ends = edgePoints(field, SHIPS.edgeIn, BARGE_CLEAR).filter((e) => g.cost[columnIndex(Math.floor(e.x), Math.floor(e.z))]! < Infinity);
    ends.sort((p, q) => g.cost[columnIndex(Math.floor(p.x), Math.floor(p.z))]! - g.cost[columnIndex(Math.floor(q.x), Math.floor(q.z))]!);
    const e = ends[0];
    if (!e) return null;
    const route = routeTo(g, from, [e.x, e.z]);
    if (!route) return null;
    const out = beyond(HULL);
    const pts: Pt[] = [...route, [e.x - Math.sin(e.yaw) * out, e.z - Math.cos(e.yaw) * out]];
    return pathOf(reverse ? pts.reverse() : pts);
  }

  /** The town changed: the way between the ends, the bridges, and what to do if its water has gone. */
  sync(shape: ShapePlan): void {
    const low = lowObstacles(shape.facts);
    this.field = seaField(low);
    this.bridges.clear();
    for (const [c, k] of shape.facts.kinds) {
      const col = columnIndex(keyX(c), keyZ(c));
      if (shape.terrain.height[col] === 0 && (keyY(c) >= 1 || k === 'arch')) this.bridges.add(col);
    }
    if (this.mode !== 'nudging' && !hullClear(this.field, HULL, this.x, this.z, this.yaw, -0.05)) {
      this.nudge();
      return;
    }
    if (this.mode === 'leaving' || this.mode === 'resident') {
      this.leg = this.toEdge([this.x, this.z], false);
      if (this.leg) {
        this.mode = 'leaving';
        this.s = 0;
      } else this.mode = 'resident';
      return;
    }
    // Up and down its river only (L41.river-barge.rule.ts).
    const g = graphFrom(seaField(bargeWater(shape.facts)), this.a, BARGE_CLEAR);
    const route = routeTo(g, this.a, this.b);
    const was = this.path;
    this.path = route ? pathOf(route) : null;
    if (this.arrive && !was) {
      // Coming to a town already open: in through the edge of the map to its first end.
      this.arrive = false;
      this.leg = this.toEdge(this.a, true);
      if (this.leg) {
        this.mode = 'coming';
        this.s = 0;
        const p = pathAt(this.leg, 0);
        this.x = p.x;
        this.z = p.z;
        this.yaw = p.yaw;
        return;
      }
    }
    if (this.path && was && this.mode === 'run') {
      // Pick up from where it is on the new way.
      let best = 0, bestD = Infinity;
      for (let s = 0; s <= this.path.length; s += 0.1) {
        const p = pathAt(this.path, s);
        const d = Math.hypot(p.x - this.x, p.z - this.z);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      this.s = best;
    }
    if (!this.path && this.mode === 'run') this.leave(shape);
  }

  /** Its run has gone: it poles away out through the edge (or stays, if there is no way out). */
  leave(shape: ShapePlan): void {
    this.mode = 'leaving';
    this.sync(shape);
  }

  private nudge(): void {
    const to = this.field ? nearestFree(this.field, HULL, { x: this.x, z: this.z, yaw: this.yaw }) : null;
    if (!to) {
      removalPuff(this.stage, this.seed, this.x, SEA_Y + 0.3, this.z, 1.4, 7);
      this.gone = true;
      return;
    }
    this.from = { x: this.x, z: this.z, yaw: this.yaw };
    this.to = to;
    this.t = 0;
    this.mode = 'nudging';
  }

  update(dt: number, signals: Signals): BigShipNews | null {
    if (this.gone) return null;
    let moving = false;
    const pole = (path: Path, target: number): boolean => {
      const left = Math.abs(target - this.s);
      // It slows for a small boat in its way (going stern first, "ahead" is astern).
      const here = pathAt(path, this.s);
      const me = { x: this.x, z: this.z, yaw: here.yaw + (target < this.s ? Math.PI : 0), stern: HULL.stern, bow: HULL.bow, halfBeam: HULL.halfBeam, speed: this.speed };
      const want = SHIPS.poleSpeed * Math.min(1, 0.25 + left / 2.5) * Math.min(1, 0.3 + this.t / 3) * clearAhead(me, floatPoints(this.stage));
      this.speed += (want - this.speed) * glide(1.2, dt);
      this.s = target > this.s ? Math.min(target, this.s + this.speed * dt) : Math.max(target, this.s - this.speed * dt);
      const p = pathAt(path, this.s);
      const px = this.x, pz = this.z;
      this.x = p.x;
      this.z = p.z;
      // Lying along the way it goes: the line from a little astern to a little ahead (so the hull follows
      // the bends, not swinging wide of them). It is double-ended: it never turns about, it poles the other way.
      const back = pathAt(path, Math.max(0, this.s - 1.2)), fore = pathAt(path, Math.min(path.length, this.s + 1.2));
      let aim = Math.hypot(fore.x - back.x, fore.z - back.z) > 0.05 ? Math.atan2(fore.x - back.x, fore.z - back.z) : p.yaw;
      if (this.flip) aim += Math.PI;
      if (Math.abs(angleDelta(this.yaw, aim)) > Math.PI / 2) {
        this.flip = !this.flip;
        aim += Math.PI;
      }
      this.yaw += angleDelta(this.yaw, aim) * glide(5, dt);
      this.wake += Math.hypot(this.x - px, this.z - pz);
      return Math.abs(target - this.s) < 1e-6;
    };
    this.t += dt;
    if (this.mode === 'run' && this.path) {
      if (this.lying > 0) {
        this.lying -= dt;
        this.speed = 0;
        this.t = 0;
      } else {
        moving = true;
        if (pole(this.path, this.way > 0 ? this.path.length : 0)) {
          this.way = -this.way;
          this.lying = LIE;
        }
      }
    } else if (this.mode === 'coming' && this.leg) {
      moving = true;
      this.way = 1;
      if (pole(this.leg, this.leg.length)) {
        this.mode = 'run';
        this.s = 0;
        this.lying = LIE * 0.5;
      }
    } else if (this.mode === 'leaving' && this.leg) {
      moving = true;
      this.way = 1;
      if (pole(this.leg, this.leg.length)) {
        // All of it is out beyond the edge of the map.
        this.gone = true;
        return null;
      }
    } else if (this.mode === 'nudging') {
      const k = easeInOut(Math.min(1, this.t / 2));
      this.x = this.from.x + (this.to.x - this.from.x) * k;
      this.z = this.from.z + (this.to.z - this.from.z) * k;
      this.yaw = this.from.yaw + angleDelta(this.from.yaw, this.to.yaw) * k;
      if (this.t >= 2) {
        this.mode = 'leaving';
        this.leg = this.field ? this.toEdge([this.x, this.z], false) : null;
        this.s = 0;
        if (!this.leg) this.mode = 'resident';
      }
    }
    // A bridge just ahead (or overhead): the mast comes down.
    const hx = Math.sin(this.yaw) * this.hullWay, hz = Math.cos(this.yaw) * this.hullWay;
    let under = false;
    for (let d = -1.6; d <= 2.4 && !under; d += 0.4) {
      const cx = Math.floor(this.x + hx * d), cz = Math.floor(this.z + hz * d);
      if (cx >= 0 && cz >= 0 && cx < SIZE_X && cz < SIZE_Z && this.bridges.has(columnIndex(cx, cz))) under = true;
    }
    this.body.lower = approach(this.body.lower, under ? 1 : 0, dt / 1.6);
    const wind = signals.wind(this.x, this.z);
    const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
    const along = (wind.dirX * sn + wind.dirZ * cs) * this.hullWay;
    this.body.setAll(moving && !under && this.body.lower < 0.05 && along > 0.35 ? 1 : 0);
    const now = onTwos(signals.time.seconds, this.phase);
    if (now !== this.drawn) {
      this.drawn = now;
      swellAt(now, this.phase, 1.2, wind.strength * 0.5, this.swell);
      this.body.trim(1 / 12, { lee: (wind.dirX * cs - wind.dirZ * sn) * this.hullWay, along, strength: wind.strength }, SHIPS.sailTime);
    }
    fly(this.x, SEA_Y + this.swell.heave * 0.5, this.z, this.yaw, this.swell.pitch * 0.4, this.swell.roll * 0.4, 1, this.m);
    const edge = Math.max(mapEdge(this.x + sn * 2, this.z + cs * 2), mapEdge(this.x - sn * 2, this.z - cs * 2));
    this.body.setCut(edge > -2);
    for (const h of [...this.man, this.pole]) h.setParams(1, 0, 0, edge > -2 ? -1 : 0);
    this.body.pose(this.m, Math.atan2(wind.dirX, wind.dirZ));
    if (this.wake > 0.9) {
      this.wake = 0;
      wakeRing(this.stage, this.x - hx * 1.4, this.z - hz * 1.4, 0.3, 2.2, 1.8);
    }
    this.drawMan(signals, moving);
    return { x: this.x, z: this.z, yaw: this.yaw, stern: HULL.stern, bow: HULL.bow, halfBeam: HULL.halfBeam, speed: moving ? this.speed : 0 };
  }

  /** The bargeman at the end he poles from (the stern going to B, the bow coming back), facing the way. */
  private drawMan(signals: Signals, moving: boolean): void {
    const rig = this.body.rig;
    const zl = this.hullWay > 0 ? rig.hull.z(0.13, 0.2) : rig.hull.z(0.88, 0.2);
    const deck = rig.spec.decks[0]!.y;
    const m = this.m;
    const x = m[8]! * zl + m[4]! * deck + m[12]!, y = m[9]! * zl + m[5]! * deck + m[13]!, z = m[10]! * zl + m[6]! * deck + m[14]!;
    const heading = this.yaw + (this.hullWay > 0 ? 0 : Math.PI);
    const t = signals.time.seconds + this.phase * 5;
    const pose = poseOf(moving ? 'sweep' : 'stand', moving ? t * 0.6 : t);
    rigMatrices(this.look, pose, this.mats);
    const c = Math.cos(heading) * this.look.scale, sn = Math.sin(heading) * this.look.scale;
    for (let i = 0; i < 5; i++) {
      const k = i * 16, w = this.world;
      for (let col = 0; col < 4; col++) {
        const o = k + col * 4;
        const lx = this.mats[o]!, ly = this.mats[o + 1]!, lz = this.mats[o + 2]!;
        w[col * 4] = c * lx + sn * lz + (col === 3 ? x : 0);
        w[col * 4 + 1] = this.look.scale * ly + (col === 3 ? y : 0);
        w[col * 4 + 2] = -sn * lx + c * lz + (col === 3 ? z : 0);
        w[col * 4 + 3] = col === 3 ? 1 : 0;
      }
      this.man[i]!.setMatrix(w);
      if (i === TOOL_PIECE.pole) this.pole.setMatrix(w);
    }
  }

  release(): void {
    this.body.release();
    for (const h of this.man) h.release();
    this.pole.release();
  }
}
