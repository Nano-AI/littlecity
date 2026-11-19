// The river barge (L41): poled to and fro between two docks on a river,
// lying a while at each to load and unload. It is double-ended in use: the
// bargeman walks his pole from the bow up, and the barge goes stern first on
// the way back rather than turning in a narrow river. It never moves
// sideways. Under a bridge (anything built over the water just ahead) the
// mast comes down aft, and goes up again beyond. A sail is set only with
// the wind astern.
//
// The route is worked out from the water alone (L41.river-barge.rule.ts):
// whatever carves a river, the barge follows it.

import type { Mat4 } from '@/core/mat4';
import { columnIndex, keyX, keyY, keyZ, SEA_Y, SIZE_X, SIZE_Z } from '@/core/grid';
import { rand } from '@/core/rand';
import { toolMesh, TOOL_PIECE } from '@/parts/people/extras';
import { buildPerson, lookOf, PIECES, type Look } from '@/parts/people/person';
import { poseOf, rigMatrices } from '@/parts/people/pose';
import type { ShapePlan } from '@/resolve/plan';
import { BARGE_CLEAR, lowObstacles } from '@/rules/life/L41.river-barge.rule';
import { graphFrom, pathAt, pathOf, routeTo, seaField, type Path, type Pt } from '@/rules/life/ship-routes';
import { SHIPS } from '@/style/ships';
import { PALETTE, RAMPS } from '@/style/palette';
import type { InstanceHandle, LifeStage, Signals } from '../api';
import { swellAt, wakeRing, type Swell } from '../boats/afloat';
import { angleDelta, approach, glide } from '../motion/ease';
import { fly } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { ShipBody } from './body';
import type { BigShipNews } from './news';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
/** Seconds lying at each dock. */
const LIE = 18;

export class Barge {
  private body: ShipBody;
  private path: Path | null = null;
  /** Distance along the path from A; which way it is going (+1 to B, −1 back to A); seconds lying at a dock. */
  private s = 0;
  private way = 1;
  private lying = LIE * 0.5;
  private speed = 0;
  x = 0;
  z = 0;
  yaw = 0;
  private swell: Swell = { heave: 0, roll: 0, pitch: 0 };
  private drawn = NaN;
  private phase: number;
  private wake = 0;
  /** Its river or its docks have gone: it sinks away where it lies (it never pops). */
  fading = false;
  private scale = 1;
  private m: Mat4 = new Array<number>(16).fill(0);
  private bridges = new Set<number>();
  // The bargeman.
  private look: Look;
  private man: InstanceHandle[];
  private pole: InstanceHandle;
  private mats = new Float32Array(80);
  private world = new Array<number>(16).fill(0);

  constructor(private stage: LifeStage, seed: number, readonly id: string, look: number, public a: Pt, public b: Pt) {
    this.body = new ShipBody(stage, 'barge', look, HIDDEN, 0);
    this.phase = rand(seed, 'barge', id);
    this.look = { ...lookOf((rand(seed, 'bargeman', id) * 1e9) >>> 0), dress: false, hat: 'straw', hatColor: PALETTE.yellow, top: RAMPS.roof[3]!, child: false };
    const meshes = buildPerson(this.look, `bargeman-${id}`);
    this.man = PIECES.map((p) => stage.spawnMesh(meshes[p], HIDDEN));
    this.pole = stage.spawnMesh(toolMesh('pole', RAMPS.wood[1]!), HIDDEN);
    this.x = a[0];
    this.z = a[1];
  }

  /** The town changed: the way between the docks (null: no way, it lies where it is). */
  sync(shape: ShapePlan): void {
    const low = lowObstacles(shape.facts);
    const field = seaField(low);
    const g = graphFrom(field, this.a, BARGE_CLEAR);
    const route = routeTo(g, this.a, this.b);
    this.bridges.clear();
    for (const c of shape.facts.kinds.keys()) {
      if (keyY(c) >= 1 && shape.terrain.height[columnIndex(keyX(c), keyZ(c))] === 0) this.bridges.add(columnIndex(keyX(c), keyZ(c)));
    }
    const was = this.path;
    this.path = route ? pathOf(route) : null;
    if (this.path && was) {
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
  }

  /** False once it has faded right away. */
  get alive(): boolean {
    return this.scale > 0;
  }

  update(dt: number, signals: Signals): BigShipNews {
    if (this.fading) {
      this.scale = Math.max(0, this.scale - dt / 2);
      if (this.scale <= 0.5) for (const h of [...this.man, this.pole]) h.setVisible(false);
    }
    const path = this.fading ? null : this.path;
    let moving = false;
    if (path) {
      if (this.lying > 0) {
        this.lying -= dt;
        this.speed = 0;
      } else {
        const end = this.way > 0 ? path.length : 0;
        const left = Math.abs(end - this.s);
        const want = SHIPS.poleSpeed * Math.min(1, 0.25 + left / 2.5) * Math.min(1, 0.3 + (path.length - left) / 1.5);
        this.speed += (want - this.speed) * glide(1.2, dt);
        this.s = Math.max(0, Math.min(path.length, this.s + this.way * this.speed * dt));
        moving = true;
        if ((this.way > 0 && this.s >= path.length - 1e-6) || (this.way < 0 && this.s <= 1e-6)) {
          this.way = -this.way;
          this.lying = LIE;
        }
      }
      const p = pathAt(path, this.s);
      const px = this.x, pz = this.z;
      this.x = p.x;
      this.z = p.z;
      // The bow always toward B: back to A it goes stern first.
      this.yaw += angleDelta(this.yaw, p.yaw) * glide(2, dt);
      this.wake += Math.hypot(this.x - px, this.z - pz);
    }
    // A bridge just ahead (or overhead): the mast comes down.
    const hx = Math.sin(this.yaw) * this.way, hz = Math.cos(this.yaw) * this.way;
    let under = false;
    for (let d = -1.6; d <= 2.4 && !under; d += 0.4) {
      const cx = Math.floor(this.x + hx * d), cz = Math.floor(this.z + hz * d);
      if (cx >= 0 && cz >= 0 && cx < SIZE_X && cz < SIZE_Z && this.bridges.has(columnIndex(cx, cz))) under = true;
    }
    this.body.lower = approach(this.body.lower, under ? 1 : 0, dt / 1.6);
    const wind = signals.wind(this.x, this.z);
    const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
    const along = (wind.dirX * sn + wind.dirZ * cs) * this.way;
    this.body.setAll(moving && !under && this.body.lower < 0.05 && along > 0.35 ? 1 : 0);
    const now = onTwos(signals.time.seconds, this.phase);
    if (now !== this.drawn) {
      this.drawn = now;
      swellAt(now, this.phase, 1.2, wind.strength * 0.5, this.swell);
      this.body.trim(1 / 12, { lee: (wind.dirX * cs - wind.dirZ * sn) * this.way, along, strength: wind.strength }, SHIPS.sailTime);
    }
    fly(this.x, SEA_Y + this.swell.heave * 0.5, this.z, this.yaw, this.swell.pitch * 0.4, this.swell.roll * 0.4, Math.max(0.001, this.scale), this.m);
    this.body.pose(this.m, Math.atan2(wind.dirX, wind.dirZ), this.scale);
    if (this.wake > 0.9) {
      this.wake = 0;
      wakeRing(this.stage, this.x - hx * 1.4, this.z - hz * 1.4, 0.3, 2.2, 1.8);
    }
    if (!this.fading) this.drawMan(signals, moving);
    return { x: this.x, z: this.z, yaw: this.yaw, stern: -1.65, bow: 1.62, halfBeam: 0.52, speed: this.speed };
  }

  /** The bargeman at the end he poles from (the stern going to B, the bow coming back), facing the way. */
  private drawMan(signals: Signals, moving: boolean): void {
    const rig = this.body.rig;
    const zl = this.way > 0 ? rig.hull.z(0.13, 0.2) : rig.hull.z(0.88, 0.2);
    const deck = rig.spec.decks[0]!.y;
    const m = this.m;
    const x = m[8]! * zl + m[4]! * deck + m[12]!, y = m[9]! * zl + m[5]! * deck + m[13]!, z = m[10]! * zl + m[6]! * deck + m[14]!;
    const heading = this.yaw + (this.way > 0 ? 0 : Math.PI);
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
