// Drawing the people blown about by mischief (design section 13b, "blown
// about"): the thrower (thrower.ts) moves them and the people system draws
// the figures from `Person.tumble`; this draws what goes with them: the
// little stars circling a dizzy head, a straw hat flying off and lying on
// the ground, a splash where somebody lands in the water, a puff of dust
// where they hit the ground. Owner: Mischief. Every handle goes through the
// owned stage (owned.ts), so a new town keeps none of it.
//
// It listens to the director: a nuke's blast (the ring throws people as it
// reaches them), a bomb's, a bolt of lightning (only right beside it); undo
// and a called-off act set everybody back on their feet at once.

import { SEA_Y } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { dazeStarMesh } from '@/parts/people/scuffle-art';
import { defineSystem, type InstanceHandle, type LifeStage } from '../api';
import { crowdOf } from '../doors/table';
import { fxOf } from '../fx/fx';
import { place } from '../motion/pose';
import type { Crowd } from '../people/crowd';
import { mischiefOf, type Director, type MischiefEvent } from './director';
import { spoutMesh } from './meshes';
import { capsizeBoat } from './boatwreck';
import { ownStage, type Owned } from './owned';
import { createThrower, farScale, flightGrow, airOf, type Thrown, type Thrower } from './thrower';
import { PALETTE } from '@/style/palette';
import { quatToMat3 } from './thrown';
import { crittersOf, type Critter } from './critters';
import type { NavGraph, ShapePlan } from '@/resolve/plan';

const HIDE: Mat4Like = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];
const DUST = { actor: 'puff', variant: 'dust' } as const;
/** Stars round a dizzy head: how many, how far out, how fast round (radians a second). */
const STARS = { n: 4, r: 0.13, speed: 4.5, rate: 12, size: 1.8 };

const throwers = new WeakMap<LifeStage, Thrower>();
/** The thrower of a stage (the Hand, tests, sequences), once the people are there. */
export function throwerOf(stage: LifeStage): Thrower | null {
  return throwers.get(stage) ?? null;
}

let starMesh: MeshData | null = null;
const hatMeshes = new Map<string, MeshData>();
/** A straw hat (person.ts draws the same on the head): a wide flat brim and a low crown, about 0.1 across. */
function strawHatMesh(colour: string): MeshData {
  let m = hatMeshes.get(colour);
  if (m) return m;
  const r = 0.032;
  const b = new MeshBuilder({ ink: 'thrown-hat' });
  b.setPattern(PATTERN.none).setInk('hat').setColor(colour);
  b.lathe([[r * 1.62, 0], [r * 1.62, 0.012], [r * 0.86, 0.016], [r * 0.74, r * 0.62], [0, r * 0.7]], { segments: 12 });
  b.lathe([[0, 0], [r * 1.62, 0]], { segments: 12 });
  m = b.build();
  hatMeshes.set(colour, m);
  return m;
}

/** Speed lines: three ink strokes a unit long down -Z, behind whatever flies. */
let streakMesh: MeshData | null = null;
function speedLinesMesh(): MeshData {
  if (streakMesh) return streakMesh;
  const b = new MeshBuilder({ ink: 'speed-lines' });
  b.setPattern(PATTERN.none).setColor(PALETTE.ink);
  for (const [i, x, y, from, to] of [[0, -0.06, 0.02, 0.2, 0.85], [1, 0.06, -0.02, 0.3, 1], [2, 0, 0.07, 0.45, 0.8]] as const) {
    b.setInk(`line${i}`);
    b.box([x - 0.0035, y - 0.0035, -to], [x + 0.0035, y + 0.0035, -from]);
  }
  return (streakMesh = b.build());
}

interface Art {
  /** Speed lines behind it while it flies. */
  lines?: InstanceHandle | null;
  stars: InstanceHandle[];
  hat: InstanceHandle | null;
  hatColor: string;
}

/** A ring on the ground, about 1 across (the Hand's mark round what it can pick up); a soft dark disc (a shadow). */
let ringMesh: MeshData | null = null;
let shadowMesh: MeshData | null = null;
function handRingMesh(): MeshData {
  if (ringMesh) return ringMesh;
  const b = new MeshBuilder({ ink: 'hand-ring' });
  b.setPattern(PATTERN.none).setInk('ring').setColor('#fff3c4');
  b.lathe([[0.5, 0], [0.5, 0.012], [0.42, 0.012], [0.42, 0]], { segments: 20 });
  return (ringMesh = b.build());
}
function heldShadowMesh(): MeshData {
  if (shadowMesh) return shadowMesh;
  const b = new MeshBuilder({ ink: 'hand-shadow' });
  b.setPattern(PATTERN.none).setInk('shadow').setColor('#9a93a3');
  b.lathe([[0.32, 0], [0.32, 0.006], [0, 0.008]], { segments: 16 });
  b.setInk('line').setColor('#7d7688');
  b.boxAt([0, 0, 0], [0.012, 1, 0.012]);
  return (shadowMesh = b.build());
}

interface State {
  d: Director;
  /** The Hand's mark and the shadows of what it holds. */
  ring: InstanceHandle | null;
  shadows: InstanceHandle[];
  own: Owned;
  crowd: Crowd | null;
  thrower: Thrower | null;
  shape: ShapePlan | null;
  nav: NavGraph | null;
  art: Map<Thrown, Art>;
  critterArt: Map<Critter, InstanceHandle[]>;
  critterLines: Map<Critter, { lines?: InstanceHandle | null }>;
  spouts: { h: InstanceHandle; age: number }[];
  time: number;
  off: () => void;
}

const m3 = new Float32Array(9);
const mat: number[] = new Array<number>(16).fill(0);

function onEvent(st: State, e: MischiefEvent): void {
  const t = st.thrower;
  if (!t) return;
  // A dev switch for measuring what blowing people about costs (src/life/testing/nuke-cost.mjs).
  if ((globalThis as { __lcStill?: boolean }).__lcStill && e.type !== 'reset' && e.type !== 'undo') return;
  if (e.type === 'blast') {
    const [x, y, z] = e.blast.point;
    t.blast(x, y, z, e.nuke ? 'nuke' : 'bomb');
  } else if (e.type === 'strike' && e.strike.struck) {
    const [x, y, z] = e.strike.point;
    t.blast(x, y, z, 'bolt');
  } else if (e.type === 'reset' || e.type === 'undo') {
    t.reset();
  }
}

/** Ink strokes behind a body flying fast, along the way it goes, longer the faster (and drawn bigger as it is). */
function speedLines(stage: LifeStage, a: { lines?: InstanceHandle | null }, b: { x: number; y: number; z: number; vx: number; vy: number; vz: number; upright: boolean; radius: number } | null): void {
  const sp = b ? Math.hypot(b.vx, b.vy, b.vz) : 0;
  if (!b || sp < 2.2) {
    a.lines?.release();
    a.lines = null;
    return;
  }
  a.lines ??= stage.spawnMesh(speedLinesMesh(), HIDE);
  const g = flightGrow(airOf(b as never));
  const len = Math.min(0.7, sp * 0.06) * g;
  // Z along the way it goes (the strokes run back from it), X level across, Y the rest.
  const zx = b.vx / sp, zy = b.vy / sp, zz = b.vz / sp;
  let xx = zz, xz = -zx;
  const xl = Math.hypot(xx, xz) || 1;
  xx /= xl;
  xz /= xl;
  const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
  a.lines.setMatrix([xx * g, 0, xz * g, 0, yx * g, yy * g, yz * g, 0, zx * len, zy * len, zz * len, 0, b.x, b.y, b.z, 1]);
}

function dropArt(a: Art): void {
  a.lines?.release();
  a.lines = null;
  for (const h of a.stars) h.release();
  a.stars = [];
  a.hat?.release();
  a.hat = null;
}

function drawArt(st: State, stage: LifeStage, t: Thrown, a: Art): void {
  const b = t.body;
  speedLines(stage, a, b.phase === 'fly' && !b.upright ? b : null);
  // Stars round the head while they lie dizzy, and for the first moments of sitting up.
  const dizzy = b.upright && (b.phase === 'lie' || b.phase === 'roof' || b.phase === 'slide' || (b.phase === 'up' && t.fetch === null && b.t < 0.7));
  if (dizzy && a.stars.length === 0) {
    starMesh ??= dazeStarMesh();
    for (let i = 0; i < STARS.n; i++) a.stars.push(stage.spawnMesh(starMesh, HIDE));
  } else if (!dizzy && a.stars.length > 0) {
    for (const h of a.stars) h.release();
    a.stars = [];
  }
  if (dizzy) {
    // Where the head is: up over the hips sitting; behind the feet on the back; ahead of them face down.
    const sitting = b.phase === 'up' || (b.phase === 'lie' && b.rest === 'sit');
    const along = sitting ? 0 : b.rest === 'front' && b.phase === 'lie' ? 0.36 : -0.36;
    const hx = b.x + Math.sin(b.heading) * along;
    const hz = b.z + Math.cos(b.heading) * along;
    const hy = b.y + (sitting ? 0.42 : 0.14);
    const tick = Math.floor(st.time * STARS.rate) / STARS.rate;
    const sc = Math.max(1.2, farScale()) * STARS.size;
    const spin = tick * STARS.speed + (b.seed % 7);
    a.stars.forEach((h, i) => {
      const ang = spin + (i / STARS.n) * Math.PI * 2;
      const c = Math.cos(-ang) * sc, s = Math.sin(-ang) * sc;
      h.setMatrix([c, 0, -s, 0, 0, sc, 0, 0, s, 0, c, 0, hx + Math.cos(ang) * STARS.r * sc, hy + Math.sin(ang * 2) * 0.015, hz + Math.sin(ang) * STARS.r * sc, 1]);
    });
  }
  // The hat, off the head.
  const hat = t.hat;
  if (hat && !a.hat) a.hat = stage.spawnMesh(strawHatMesh(t.hatColor), HIDE);
  if (!hat && a.hat) {
    a.hat.release();
    a.hat = null;
  }
  if (hat && a.hat) {
    if (hat.upright) {
      // Lying crown up where it came down (floating, in the water).
      const y = hat.phase === 'swim' ? SEA_Y + 0.005 : hat.y + 0.002;
      a.hat.setMatrix(place(hat.x, y, hat.z, hat.heading, 1, 1, 1, mat));
    } else {
      quatToMat3(hat.q, m3);
      a.hat.setMatrix([m3[0]!, m3[1]!, m3[2]!, 0, m3[3]!, m3[4]!, m3[5]!, 0, m3[6]!, m3[7]!, m3[8]!, 0, hat.x, hat.y, hat.z, 1]);
    }
  }
}

export default defineSystem<State>({
  id: 'mischief.thrown',
  // After the director (the mischief system, 10) has told of a blast; before the people are drawn (20).
  order: 15,
  create(ctx) {
    const st: State = { ring: null, shadows: [], d: mischiefOf(ctx.stage), own: ownStage(ctx.stage), crowd: null, thrower: null, shape: null, nav: null, art: new Map(), critterArt: new Map(), critterLines: new Map(), spouts: [], time: 0, off: () => {} };
    st.off = st.d.on((e) => onEvent(st, e));
    return st;
  },
  sync(st, next) {
    st.shape = next.shape;
    if (next.dressing) st.nav = next.dressing.nav;
    st.thrower?.sync(next.shape, st.nav);
  },
  update(st, dt, _signals, ctx) {
    st.time += dt;
    const crowd = crowdOf(ctx.stage);
    if (crowd !== st.crowd) {
      st.thrower?.reset();
      for (const a of st.art.values()) dropArt(a);
      st.art.clear();
      st.crowd = crowd;
      st.thrower = crowd ? createThrower(crowd, crittersOf(ctx.stage)) : null;
      if (st.thrower) {
        throwers.set(ctx.stage, st.thrower);
        const stage0 = ctx.stage;
        st.thrower.capsize = (c, x, z, yaw) => capsizeBoat(stage0, c.id.slice('boat:'.length), x, z, yaw, st.d.clock);
        // The debug handle (sequences, browser tests), as window.__lcPeople is the crowd's.
        (globalThis as { __lcThrown?: unknown }).__lcThrown = { thrower: st.thrower, critters: crittersOf(ctx.stage) };
        if (st.shape) st.thrower.sync(st.shape, st.nav);
      } else throwers.delete(ctx.stage);
    }
    const t = st.thrower;
    if (!t) return;
    t.step(dt);
    const stage = st.own.stage;
    for (const [k, a] of st.art) {
      if (t.thrown.get(k.person) === k) continue;
      dropArt(a);
      st.art.delete(k);
    }
    for (const th of t.thrown.values()) {
      let a = st.art.get(th);
      if (!a) st.art.set(th, (a = { stars: [], hat: null, hatColor: th.hatColor }));
      // What happened to it since the last frame: a splash, a puff of dust where it hit.
      for (const ev of th.events) {
        const b = th.body;
        if (ev === 'splash') {
          const h = stage.spawnMesh(spoutMesh(), [0.45, 0, 0, 0, 0, 0.001, 0, 0, 0, 0, 0.45, 0, b.x, SEA_Y - 0.02, b.z, 1]);
          st.spouts.push({ h, age: 0 });
        } else if (ev === 'land' || ev === 'bounce' || ev === 'wall' || ev === 'roof') {
          const x = b.x, y = b.upright ? b.y : b.y - b.radius, z = b.z;
          const k = farScale();
          fxOf(ctx.stage).play(DUST, 0.5, (u, m) => place(x, y + 0.03 + u * 0.12 * k, z, 0, (0.2 + u * 0.35) * k, (0.2 + u * 0.35) * k, (0.2 + u * 0.35) * k, m));
        }
      }
      th.events.length = 0;
      drawArt(st, stage, th, a);
    }
    // Animals: a splash, a puff, stars round the head while they lie on their backs.
    for (const [c, hs] of st.critterArt) {
      if (c.body && t.critterEvents.has(c)) continue;
      for (const h of hs) h.release();
      st.critterArt.delete(c);
    }
    for (const [c, l] of st.critterLines) {
      if (c.body && t.critterEvents.has(c)) continue;
      l.lines?.release();
      st.critterLines.delete(c);
    }
    for (const [c, evs] of t.critterEvents) {
      const b = c.body;
      if (!b) continue;
      let l = st.critterLines.get(c);
      if (!l) st.critterLines.set(c, (l = {}));
      speedLines(stage, l, b.phase === 'fly' && !b.upright ? b : null);
      for (const ev of evs) {
        if (ev === 'splash') {
          // As big as what came down (a galleon's is a great one).
          const w = Math.max(0.35, c.height * 1.6);
          st.spouts.push({ h: stage.spawnMesh(spoutMesh(), [w, 0, 0, 0, 0, 0.001, 0, 0, 0, 0, w, 0, b.x, SEA_Y - 0.02, b.z, 1]), age: 0 });
        }
        else if (ev === 'land' || ev === 'bounce' || ev === 'wall' || ev === 'roof') {
          const x = b.x, y = b.upright ? b.y : b.y - b.radius, z = b.z;
          fxOf(ctx.stage).play(DUST, 0.4, (u, m) => place(x, y + 0.03 + u * 0.08, z, 0, 0.14 + u * 0.24, 0.14 + u * 0.24, 0.14 + u * 0.24, m));
        }
      }
      evs.length = 0;
      const dizzy = b.upright && (b.phase === 'lie' || b.phase === 'roof' || b.phase === 'slide');
      let hs = st.critterArt.get(c);
      if (dizzy && !hs) {
        starMesh ??= dazeStarMesh();
        st.critterArt.set(c, (hs = [0, 1, 2].map(() => stage.spawnMesh(starMesh!, HIDE))));
      } else if (!dizzy && hs) {
        for (const h of hs) h.release();
        st.critterArt.delete(c);
        hs = undefined;
      }
      if (hs) {
        const tick = Math.floor(st.time * STARS.rate) / STARS.rate;
        const sc = Math.max(1.2, farScale()) * STARS.size * 0.8;
        const hx = b.x + Math.sin(b.heading) * c.height * 0.4, hz = b.z + Math.cos(b.heading) * c.height * 0.4, hy = b.y + c.height * 0.9;
        hs.forEach((h, i) => {
          const ang = tick * STARS.speed + (i / 3) * Math.PI * 2;
          const cc = Math.cos(-ang) * sc, ss = Math.sin(-ang) * sc;
          h.setMatrix([cc, 0, -ss, 0, 0, sc, 0, 0, ss, 0, cc, 0, hx + Math.cos(ang) * 0.09 * sc, hy, hz + Math.sin(ang) * 0.09 * sc, 1]);
        });
      }
    }
    // The Hand: a ring round what it could pick up; under what it holds, a shadow and a line down to it.
    const hv = t.hover?.() ?? null;
    if (hv) {
      st.ring ??= stage.spawnMesh(handRingMesh(), HIDE);
      const pulse = 1 + 0.08 * (Math.floor(st.time * 6) % 2);
      st.ring.setMatrix(place(hv.x, hv.y + 0.02, hv.z, 0, hv.r * pulse, 1, hv.r * pulse, mat));
    } else if (st.ring) {
      st.ring.release();
      st.ring = null;
    }
    const held: { x: number; y: number; z: number; r: number }[] = [];
    for (const th of t.thrown.values()) if (th.body.phase === 'held') held.push({ x: th.body.x, y: th.body.y, z: th.body.z, r: 0.3 });
    for (const c of t.critterEvents.keys()) if (c.body?.phase === 'held') held.push({ x: c.body.x, y: c.body.y, z: c.body.z, r: Math.max(0.25, c.height * 1.2) });
    while (st.shadows.length > held.length) st.shadows.pop()!.release();
    const g = t.ground;
    held.forEach((hd, i) => {
      const h = (st.shadows[i] ??= stage.spawnMesh(heldShadowMesh(), HIDE));
      const s = g ? g.surface(hd.x, hd.z, hd.y - 0.1) : null;
      const gy = s ? (s.water ? SEA_Y : s.h) + 0.01 : 0;
      const drop = Math.max(0.01, hd.y - 0.25 - gy);
      // The disc flat (scaled in x, z), the line up the y axis to just under it.
      h.setMatrix([hd.r, 0, 0, 0, 0, drop, 0, 0, 0, 0, hd.r, 0, hd.x, gy, hd.z, 1]);
    });
    // Splashes: up and back down into the water.
    for (let i = st.spouts.length - 1; i >= 0; i--) {
      const s = st.spouts[i]!;
      s.age += dt;
      const k = Math.min(1, s.age / 0.9);
      const m = Array.from(s.h.base);
      m[5] = Math.sin(k * Math.PI) * 1.2 * m[0]! + 0.001;
      s.h.setMatrix(m);
      if (k >= 1) {
        s.h.release();
        st.spouts.splice(i, 1);
      }
    }
  },
  dispose(st, ctx) {
    st.off();
    st.thrower?.reset();
    throwers.delete(ctx.stage);
    st.art.clear();
    st.spouts = [];
    st.ring = null;
    st.shadows = [];
    st.own.releaseAll();
  },
});
