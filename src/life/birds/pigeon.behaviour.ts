// Pigeons (L12). A flock lives on its plaza: each bird pecks about near its
// own spot (a few steps, a run of pecks, a hop, a look round), and one or
// two flutter up to a perch on the fountain now and then. When a block
// lands within three cells, or someone walks through them, they burst into
// the air together (the near ones first, the rest a beat later), wheel over
// the square and are down again after five seconds (L16). At night they
// squat and sleep.
//
// A walking pigeon's place is smooth; its pecks, hops, looks and wing beats
// are drawn on twos.

import { CELL_H, columnIndex, keyX, keyY, keyZ } from '@/core/grid';
import type { Mat4 } from '@/core/mat4';
import { slotFrame } from '@/gen/frames';
import type { ActorOf, DressingPlan, ShapePlan } from '@/resolve/plan';
import { BIRDS } from '@/style/birds';
import { defineBehaviour, type LifeContext, type Signals } from '../api';
import { angleDelta, arc, easeInOut, easeOut, glide, lerp } from '../motion/ease';
import { fly, yawOf } from '../motion/pose';
import { onTwos } from '../motion/twos';
import { attitude, steer, Wings, type Attitude } from './flight';
import { scareDistance, scaresOf, type Scare } from './scare';
import { columnTops, drift, topUnder, wrecked } from './town';

type Mode = 'ground' | 'air' | 'toPerch' | 'perched' | 'fromPerch' | 'hold';
type Act = 'idle' | 'walk' | 'peck' | 'hop';
type Ctx = LifeContext<ActorOf<'pigeon'>>;

export interface PigeonState {
  wings: Wings;
  body: Attitude;
  m: Mat4;
  phase: number;
  t: number;
  n: number;
  p1: number;
  mode: Mode;
  modeT: number;
  modeLen: number;
  act: Act;
  actT: number;
  actLen: number;
  /** Where it stands (ground modes) and which way it faces. */
  x: number;
  y: number;
  z: number;
  yaw: number;
  wantYaw: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  /** Its own spot, and the ground it may walk on: floor height by column, and points to keep clear of. */
  homeX: number;
  homeZ: number;
  free: Map<number, number>;
  blocked: number[];
  // In the air: where it left from, the wheel it joins, where it comes down.
  ax: number;
  ay: number;
  az: number;
  wx: number;
  wz: number;
  wheelAt: number;
  wheelDir: number;
  /** How high over the square the wheel flies (world units above the floor). */
  wheelUp: number;
  /** Its wheel's radius, as a share of the full one (smaller beside tall houses). */
  wheelR: number;
  /** Where the town now puts the wheel: the four above drift here, so a re-read town never jerks a bird in the air. */
  want: { wx: number; wz: number; up: number; r: number };
  landX: number;
  landZ: number;
  // Its perch, if the rule gave it one.
  hasPerch: boolean;
  px: number;
  py: number;
  pz: number;
  shape: ShapePlan | null;
  dressing: DressingPlan | null;
  seen: number;
  fresh: boolean;
  drawn: number;
  wing: number;
}

const TAU = Math.PI * 2;
/** How long the last glide down takes, and the first rush up. */
const LAND = 1.3;
const CLIMB = 0.9;
const FLOOR = 0.03;

/**
 * The wheel one pigeon flies (its own radius, by p1): the widest of a few that clears every roof under
 * it by a margin within reach of the square, and how high it must fly for that. A tall house beside the
 * square pulls the wheel in rather than the bird flying through it; if even the smallest wheel cannot
 * clear, the bird flies over at whatever height that takes.
 */
export function wheelFor(shape: ShapePlan, x: number, z: number, floor: number, p1: number): { scale: number; up: number } {
  const tops = columnTops(shape);
  const cap = BIRDS.pigeonHeight + 1.6;
  let best = { scale: 0.35, up: cap };
  for (const scale of [1, 0.8, 0.62, 0.48, 0.35]) {
    const r = BIRDS.pigeonWheel * (0.75 + 0.5 * (p1 / TAU)) * scale;
    let top = topUnder(tops, x, z, 0.3);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * TAU;
      for (const rr of [r * 0.86, r * 1.14 + 0.2]) top = Math.max(top, topUnder(tops, x + rr * Math.cos(a), z + rr * Math.sin(a), 0.25));
    }
    // Its own bob and height spread are added on top of this; it clears the roofs by a margin.
    const need = top - floor + 0.4;
    best = { scale, up: Math.max(BIRDS.pigeonHeight * 0.8, need) };
    if (need <= cap) return best;
  }
  return best;
}

function canStand(s: PigeonState, x: number, z: number): boolean {
  const m = 0.13;
  for (let k = 0; k < 4; k++) {
    const px = x + (k & 1 ? m : -m), pz = z + (k & 2 ? m : -m);
    if (!s.free.has(columnIndex(Math.floor(px), Math.floor(pz)))) return false;
  }
  if (Math.hypot(x - s.homeX, z - s.homeZ) > BIRDS.pigeonRoam) return false;
  for (let i = 0; i < s.blocked.length; i += 2) if (Math.hypot(x - s.blocked[i]!, z - s.blocked[i + 1]!) < 0.24) return false;
  return true;
}
const floorAt = (s: PigeonState, x: number, z: number): number => s.free.get(columnIndex(Math.floor(x), Math.floor(z))) ?? s.y;

/** Reads the town: its spot, the plaza cells it may walk on, what stands on them, its perch. */
function survey(s: PigeonState, ctx: Ctx): void {
  const shape = ctx.shape;
  s.shape = shape;
  s.dressing = ctx.dressing;
  const at = ctx.item.at;
  const params = ctx.item.params ?? {};
  const home = at && 'cell' in at ? slotFrame(at.cell, at.pos, at.face) : ctx.instance.base;
  s.homeX = home[12]!;
  s.homeZ = home[14]!;
  const homeY = home[13]! + FLOOR;
  s.free = new Map();
  const reach = BIRDS.pigeonRoam + 1;
  const plaza = params.plaza === undefined ? undefined : shape.structures.get(params.plaza);
  for (const c of plaza?.cells ?? []) {
    if (shape.kinds.has(c)) continue; // a fountain, a stall, a tree stands there
    if (Math.abs(keyX(c) + 0.5 - s.homeX) > reach || Math.abs(keyZ(c) + 0.5 - s.homeZ) > reach) continue;
    s.free.set(columnIndex(keyX(c), keyZ(c)), keyY(c) * CELL_H + FLOOR);
  }
  if (s.free.size === 0) s.free.set(columnIndex(Math.floor(s.homeX), Math.floor(s.homeZ)), homeY);
  s.blocked = [];
  for (const p of ctx.dressing.props) {
    const a = p.at;
    if (!('cell' in a) || !s.free.has(columnIndex(keyX(a.cell), keyZ(a.cell)))) continue;
    const f = slotFrame(a.cell, a.pos, a.face);
    s.blocked.push(f[12]!, f[14]!);
  }
  const spot = params.spot;
  const w = s.want;
  w.wx = spot === undefined ? s.homeX : keyX(spot) + 0.5;
  w.wz = spot === undefined ? s.homeZ : keyZ(spot) + 0.5;
  s.wheelDir = ((params.plaza ?? 0) & 1) === 0 ? 1 : -1;
  const wheel = wheelFor(shape, w.wx, w.wz, homeY, s.p1);
  w.up = wheel.up;
  w.r = wheel.scale;
  // Its perch, unless that is on a wreck (or under scaffolding).
  const perch = params.perch ? shape.sockets.find((k) => k.id === params.perch) : undefined;
  const standing = !perch || perch.structure === undefined || !wrecked(shape).has(perch.structure);
  const frame = params.perch && standing ? ctx.stage.socket(params.perch) : null;
  s.hasPerch = frame !== null;
  if (frame) {
    s.px = frame[12]!;
    s.py = frame[13]!;
    s.pz = frame[14]!;
  }
}

/** A seeded place to stand within `far` of (x, z); the home spot if nothing nearer suits. */
function pickSpot(s: PigeonState, ctx: Ctx, x: number, z: number, near: number, far: number): { x: number; z: number } {
  for (let k = 0; k < 6; k++) {
    const a = ctx.rand('walk-a', s.n, k) * TAU;
    const d = near + (far - near) * ctx.rand('walk-d', s.n, k);
    const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d;
    if (canStand(s, tx, tz)) return { x: tx, z: tz };
  }
  return { x: s.homeX, z: s.homeZ };
}

function nextAct(s: PigeonState, ctx: Ctx, night: boolean): void {
  const r = ctx.rand('act', s.n++);
  s.actT = 0;
  s.fromX = s.toX = s.x;
  s.fromZ = s.toZ = s.z;
  if (night) {
    s.act = 'idle';
    s.actLen = 3 + 3 * r;
    return;
  }
  if (r < 0.4) {
    const to = pickSpot(s, ctx, s.x, s.z, 0.25, 0.85);
    const dist = Math.hypot(to.x - s.x, to.z - s.z);
    if (dist > 0.05) {
      s.act = 'walk';
      s.toX = to.x;
      s.toZ = to.z;
      s.actLen = dist / BIRDS.pigeonWalk;
      s.wantYaw = Math.atan2(to.x - s.x, to.z - s.z);
      return;
    }
  }
  if (r < 0.78) {
    s.act = 'peck';
    s.actLen = (2 + Math.floor(ctx.rand('pecks', s.n) * 3)) * (4 / 12);
  } else if (r < 0.86) {
    const tx = s.x + Math.sin(s.yaw) * 0.2, tz = s.z + Math.cos(s.yaw) * 0.2;
    s.act = 'hop';
    s.actLen = 0.34;
    if (canStand(s, tx, tz)) {
      s.toX = tx;
      s.toZ = tz;
    }
  } else if (r < 0.94 || !s.hasPerch) {
    s.act = 'idle';
    s.actLen = 0.8 + 1.6 * ctx.rand('idle', s.n);
    s.wantYaw = s.yaw + (ctx.rand('turn', s.n) - 0.5) * 3;
  } else {
    // Up to the perch.
    s.mode = 'toPerch';
    s.modeT = 0;
    s.modeLen = 0.95;
    s.ax = s.x;
    s.ay = s.y;
    s.az = s.z;
    s.body.x = s.x;
    s.body.y = s.y;
    s.body.z = s.z;
    s.body.yaw = s.yaw;
    s.body.moving = true;
    s.wings.show(true);
  }
}

/** Burst into the air: away from the fright, round the wheel over the square, and down by its own spot. */
function burst(s: PigeonState, ctx: Ctx, from: { x: number; z: number }, delay: number): void {
  const b = s.body;
  if (s.mode === 'ground') {
    b.x = s.x;
    b.y = s.y;
    b.z = s.z;
    b.yaw = s.yaw;
    b.pitch = b.roll = 0;
  }
  b.moving = true;
  s.ax = b.x;
  s.ay = b.y;
  s.az = b.z;
  s.mode = 'air';
  s.modeT = -delay;
  s.modeLen = BIRDS.pigeonSettle - delay + 0.35 * ctx.rand('settle', s.n);
  // The flock meets on the far side of its wheel from whatever frightened it.
  s.wheelAt = Math.atan2(s.wz - from.z, s.wx - from.x) + (ctx.rand('lag') - 0.5) * 1.5;
  const land = pickSpot(s, ctx, s.homeX, s.homeZ, 0, 0.6);
  s.landX = land.x;
  s.landZ = land.z;
  s.n++;
}

const air = { x: 0, y: 0, z: 0 };
/** Where an airborne pigeon is, `tau` seconds after it left the ground (into `air`). */
function airAt(s: PigeonState, tau: number): void {
  const ground = floorAt(s, s.landX, s.landZ);
  const radius = BIRDS.pigeonWheel * s.wheelR * (0.75 + 0.5 * (s.p1 / TAU)) * (1 + 0.14 * Math.sin(tau * 1.3 + s.p1));
  const angle = s.wheelAt + s.wheelDir * (BIRDS.pigeonSpeed / BIRDS.pigeonWheel) * tau;
  const wx = s.wx + radius * Math.cos(angle), wz = s.wz + radius * Math.sin(angle);
  const wy = ground + s.wheelUp + BIRDS.pigeonHeight * 0.4 * ((s.p1 * 3) % 1) + 0.16 * Math.sin(tau * 2.1 + s.p1);
  const up = easeOut(tau / CLIMB);
  air.x = lerp(s.ax, wx, up);
  air.y = lerp(s.ay, wy, up);
  air.z = lerp(s.az, wz, up);
  const down = easeInOut((tau - (s.modeLen - LAND)) / LAND);
  if (down > 0) {
    air.x = lerp(air.x, s.landX, down);
    air.y = lerp(air.y, ground, down);
    air.z = lerp(air.z, s.landZ, down);
  }
}

function frighten(s: PigeonState, ctx: Ctx, e: Scare): void {
  if (s.mode === 'hold') return;
  const here = s.mode === 'ground' ? s : s.body;
  const d = scareDistance(e, here.x, here.z);
  if (e.person) {
    if (d <= e.radius && (s.mode === 'ground' || s.mode === 'perched')) burst(s, ctx, e, 0.04 * ctx.rand('delay', s.n));
    else if (d <= e.radius + 2 && s.mode === 'ground') burst(s, ctx, e, 0.12 + 0.1 * (d - e.radius));
    return;
  }
  if (d > e.radius + BIRDS.scareFollow) return;
  // The near ones go at once; the rest of the flock a beat later, like a wave.
  const delay = d <= e.radius ? 0.05 * ctx.rand('delay', s.n) : 0.12 + 0.1 * (d - e.radius) + 0.08 * ctx.rand('delay', s.n);
  if (s.mode !== 'air') burst(s, ctx, e, delay);
  else if (s.modeT > s.modeLen - LAND) burst(s, ctx, e, 0); // caught coming down: up again from where it is
  else s.modeLen = Math.max(s.modeLen, s.modeT + BIRDS.pigeonSettle * 0.8);
}

function settleHome(s: PigeonState, dt: number): void {
  const w = s.want;
  s.wx = drift(s.wx, w.wx, dt);
  s.wz = drift(s.wz, w.wz, dt);
  s.wheelUp = drift(s.wheelUp, w.up, dt);
  s.wheelR = drift(s.wheelR, w.r, dt);
}

export function updatePigeon(s: PigeonState, dt: number, signals: Signals, ctx: Ctx): void {
  if (ctx.shape !== s.shape || ctx.dressing !== s.dressing) {
    survey(s, ctx);
    s.drawn = NaN; // the town was redrawn: every instance is back where the plan has it
    if (s.mode === 'ground' && !canStand(s, s.x, s.z) && !canStand(s, s.toX, s.toZ)) {
      // Something was built where it stood: back to its own spot.
      s.x = s.fromX = s.toX = s.homeX;
      s.z = s.fromZ = s.toZ = s.homeZ;
      s.y = floorAt(s, s.x, s.z);
    }
    if ((s.mode === 'perched' || s.mode === 'toPerch') && !s.hasPerch) burst(s, ctx, { x: s.body.x + 1, z: s.body.z }, 0);
  }
  settleHome(s, dt);
  s.t += dt;
  s.modeT += dt;
  const q = onTwos(s.t, s.phase);
  const redraw = q !== s.drawn;
  s.drawn = q;

  if (s.mode === 'hold') {
    if (!redraw) return;
    const hold = ctx.item.params?.hold ?? 'sit';
    const base = ctx.instance.base;
    fly(base[12]!, base[13]! + (hold === 'sit' ? FLOOR : 0.3), base[14]!, yawOf(base), 0, 0, 1, s.m);
    ctx.instance.setMatrix(s.m);
    s.wings.show(hold !== 'sit');
    s.wings.pose(s.m, hold === 'up' ? 0.8 : hold === 'down' ? -0.5 : 0.12);
    return;
  }

  // L16: something landed, or someone walked through.
  const scares = scaresOf(ctx.stage);
  if (scares.seq !== s.seen) {
    for (const e of scares.since(s.seen)) {
      if (s.fresh && signals.time.seconds - e.at > 0.6) continue;
      frighten(s, ctx, e);
    }
    s.seen = scares.seq;
  }
  s.fresh = false;
  const b = s.body;

  if (s.mode === 'ground') {
    s.actT += dt;
    if (s.actT >= s.actLen) {
      s.x = s.toX;
      s.z = s.toZ;
      nextAct(s, ctx, signals.time.isNight);
      if (s.mode !== 'ground') return;
    }
    const u = s.actLen > 0 ? s.actT / s.actLen : 1;
    let moved = false;
    if (s.act === 'walk' || s.act === 'hop') {
      s.x = lerp(s.fromX, s.toX, u);
      s.z = lerp(s.fromZ, s.toZ, u);
      s.y = floorAt(s, s.x, s.z);
      moved = s.fromX !== s.toX || s.fromZ !== s.toZ;
    }
    const turn = angleDelta(s.yaw, s.wantYaw);
    if (Math.abs(turn) > 0.01) {
      s.yaw += turn * glide(s.act === 'walk' ? 12 : 7, dt);
      moved = true;
    }
    if (!moved && !redraw) return;
    // The drawing: a walking pigeon nods; a pecking one tips right down, twice a peck; a sleeping one squats.
    let pitch = 0, lift = 0;
    if (s.act === 'walk') pitch = 0.12 * Math.sin(TAU * 3 * q);
    else if (s.act === 'peck') pitch = (Math.floor(q * 12 + 0.5) & 3) < 2 ? -0.85 : -0.1;
    else if (s.act === 'hop') lift = 0.07 * arc(u);
    else if (signals.time.isNight) pitch = -0.16;
    fly(s.x, s.y + lift, s.z, s.yaw, pitch, 0, 1, s.m);
    ctx.instance.setMatrix(s.m);
    return;
  }

  if (s.mode === 'perched') {
    if (s.modeT >= s.modeLen && !signals.time.isNight) {
      const to = pickSpot(s, ctx, s.homeX, s.homeZ, 0, 0.6);
      s.n++;
      s.landX = to.x;
      s.landZ = to.z;
      s.mode = 'fromPerch';
      s.modeT = 0;
      s.modeLen = 0.95;
      s.wings.show(true);
    } else {
      if (!redraw) return;
      const look = s.yaw + 0.9 * Math.sin(Math.floor(s.modeT / 1.7) * 2.4 + s.p1);
      b.yaw += angleDelta(b.yaw, look) * 0.5;
      fly(s.px, s.py, s.pz, b.yaw, 0, 0, 1, s.m);
      ctx.instance.setMatrix(s.m);
      return;
    }
  }

  // In the air.
  if (s.mode === 'air') {
    if (s.modeT < 0) {
      // It has seen it: head up, a held breath before it goes.
      if (redraw) {
        fly(b.x, b.y, b.z, b.yaw, 0.2, 0, 1, s.m);
        ctx.instance.setMatrix(s.m);
      }
      return;
    }
    s.wings.show(true);
    // About to come down onto a fire, or where something has just gone off: round the wheel again.
    if (s.modeT > s.modeLen - LAND - 0.2 && s.modeT <= s.modeLen - LAND && scares.danger(s.landX, s.landZ, signals.time.seconds, 1)) s.modeLen += BIRDS.pigeonSettle * 0.6;
    airAt(s, s.modeT);
    steer(b, air.x, air.y, air.z, dt, 0.5, 0.75);
    if (s.modeT >= s.modeLen) return land(s, ctx, s.landX, s.landZ);
  } else {
    const u = Math.min(1, s.modeT / s.modeLen);
    const w = easeInOut(u);
    const up = s.mode === 'toPerch';
    const gx = up ? s.ax : s.landX, gz = up ? s.az : s.landZ, gy = floorAt(s, gx, gz);
    const k = up ? w : 1 - w;
    steer(b, lerp(gx, s.px, k), lerp(gy, s.py, k) + arc(u) * 0.28, lerp(gz, s.pz, k), dt, 0.3, 0.4);
    if (u >= 1) {
      if (!up) return land(s, ctx, gx, gz);
      s.mode = 'perched';
      s.modeT = 0;
      s.modeLen = 6 + 8 * ctx.rand('perch', s.n++);
      s.yaw = b.yaw;
      b.pitch = b.roll = 0;
      s.wings.show(false);
      fly(s.px, s.py, s.pz, b.yaw, 0, 0, 1, s.m);
      ctx.instance.setMatrix(s.m);
      return;
    }
  }
  if (redraw) {
    const hard = s.mode !== 'air' || s.modeT < CLIMB || s.modeT > s.modeLen - LAND;
    s.wing = 0.08 + (hard ? 0.78 : 0.55) * Math.sin(TAU * 4 * q + s.p1);
  }
  fly(b.x, b.y, b.z, b.yaw, b.pitch, b.roll, 1, s.m);
  ctx.instance.setMatrix(s.m);
  s.wings.pose(s.m, s.wing);
}

function land(s: PigeonState, ctx: Ctx, x: number, z: number): void {
  // Touch down where the body is (it steers after its target and trails it a little), so it does not
  // jump the last few centimetres in one frame.
  const bx = s.body.x, bz = s.body.z;
  if (Math.hypot(bx - x, bz - z) < 0.25) {
    x = bx;
    z = bz;
  }
  s.mode = 'ground';
  s.modeT = 0;
  s.x = s.fromX = s.toX = x;
  s.z = s.fromZ = s.toZ = z;
  s.y = floorAt(s, x, z);
  s.yaw = s.wantYaw = s.body.yaw;
  s.body.pitch = s.body.roll = 0;
  s.act = 'idle';
  s.actT = 0;
  s.actLen = 0.3 + 0.5 * ctx.rand('landed', s.n++);
  s.wings.show(false);
  fly(s.x, s.y, s.z, s.yaw, 0, 0, 1, s.m);
  ctx.instance.setMatrix(s.m);
}

export default defineBehaviour<'pigeon', PigeonState>({
  actor: 'pigeon',
  create(item, ctx) {
    const s: PigeonState = {
      wings: new Wings(ctx.stage, 'pigeon'),
      body: attitude(),
      m: new Array<number>(16).fill(0),
      phase: ctx.rand('twos'),
      t: ctx.rand('clock') * 20,
      n: 0,
      p1: ctx.rand('p1') * TAU,
      mode: item.params?.hold ? 'hold' : 'ground',
      modeT: 0, modeLen: 0,
      act: 'idle', actT: 0, actLen: ctx.rand('first') * 1.5,
      x: 0, y: 0, z: 0, yaw: ctx.rand('yaw') * TAU, wantYaw: 0,
      fromX: 0, fromZ: 0, toX: 0, toZ: 0,
      homeX: 0, homeZ: 0, free: new Map(), blocked: [],
      ax: 0, ay: 0, az: 0, wx: 0, wz: 0, wheelAt: 0, wheelDir: 1, wheelUp: BIRDS.pigeonHeight, wheelR: 1, landX: 0, landZ: 0,
      want: { wx: 0, wz: 0, up: BIRDS.pigeonHeight, r: 1 },
      hasPerch: false, px: 0, py: 0, pz: 0,
      shape: null, dressing: null,
      seen: scaresOf(ctx.stage).seq,
      fresh: true,
      drawn: NaN,
      wing: 0,
    };
    s.wantYaw = s.yaw;
    if (s.mode === 'hold') return s;
    survey(s, ctx);
    s.wx = s.want.wx;
    s.wz = s.want.wz;
    s.wheelUp = s.want.up;
    s.wheelR = s.want.r;
    s.x = s.fromX = s.toX = s.homeX;
    s.z = s.fromZ = s.toZ = s.homeZ;
    s.y = floorAt(s, s.x, s.z);
    return s;
  },
  update: updatePigeon,
  changed(s, ctx) {
    if (s.mode === 'hold') {
      if (!ctx.item.params?.hold) s.mode = 'ground';
      return;
    }
    s.shape = null; // a new spot, flock or perch: read the town again
  },
  dispose(s) {
    s.wings.release();
  },
});
