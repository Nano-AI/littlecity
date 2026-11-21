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
import { ownStage, type Owned } from './owned';
import { createThrower, type Thrown, type Thrower } from './thrower';
import { quatToMat3 } from './thrown';
import { crittersOf, type Critter } from './critters';
import type { NavGraph, ShapePlan } from '@/resolve/plan';

const HIDE: Mat4Like = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];
const DUST = { actor: 'puff', variant: 'dust' } as const;
/** Stars round a dizzy head: how many, how far out, how fast round (radians a second). */
const STARS = { n: 3, r: 0.12, speed: 4.5, rate: 12, size: 1.5 };

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

/** How much bigger to draw the stars from far off (as the scuffle's balloons are): 1 close in, up to 1.8. */
function farScale(): number {
  const view = (globalThis as { __lc?: { view?: { getCamera?(): { zoom: number }; getEyeCamera?(): unknown } } }).__lc?.view;
  if (!view?.getCamera || view.getEyeCamera?.()) return 1;
  const z = view.getCamera().zoom;
  return 1 + 0.8 * Math.max(0, Math.min(1, (6 - z) / (6 - 1.6)));
}

interface Art {
  stars: InstanceHandle[];
  hat: InstanceHandle | null;
  hatColor: string;
}

interface State {
  d: Director;
  own: Owned;
  crowd: Crowd | null;
  thrower: Thrower | null;
  shape: ShapePlan | null;
  nav: NavGraph | null;
  art: Map<Thrown, Art>;
  critterArt: Map<Critter, InstanceHandle[]>;
  spouts: { h: InstanceHandle; age: number }[];
  time: number;
  off: () => void;
}

const m3 = new Float32Array(9);
const mat: number[] = new Array<number>(16).fill(0);

function onEvent(st: State, e: MischiefEvent): void {
  const t = st.thrower;
  if (!t) return;
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

function dropArt(a: Art): void {
  for (const h of a.stars) h.release();
  a.stars = [];
  a.hat?.release();
  a.hat = null;
}

function drawArt(st: State, stage: LifeStage, t: Thrown, a: Art): void {
  const b = t.body;
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
    const sitting = b.phase === 'up';
    const hx = sitting ? b.x : b.x - Math.sin(b.heading) * 0.36;
    const hz = sitting ? b.z : b.z - Math.cos(b.heading) * 0.36;
    const hy = b.y + (sitting ? 0.42 : 0.12);
    const tick = Math.floor(st.time * STARS.rate) / STARS.rate;
    const sc = farScale() * STARS.size;
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
    const st: State = { d: mischiefOf(ctx.stage), own: ownStage(ctx.stage), crowd: null, thrower: null, shape: null, nav: null, art: new Map(), critterArt: new Map(), spouts: [], time: 0, off: () => {} };
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
          fxOf(ctx.stage).play(DUST, 0.45, (u, m) => place(x, y + 0.03 + u * 0.1, z, 0, 0.18 + u * 0.3, 0.18 + u * 0.3, 0.18 + u * 0.3, m));
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
    for (const [c, evs] of t.critterEvents) {
      const b = c.body;
      if (!b) continue;
      for (const ev of evs) {
        if (ev === 'splash') st.spouts.push({ h: stage.spawnMesh(spoutMesh(), [0.35, 0, 0, 0, 0, 0.001, 0, 0, 0, 0, 0.35, 0, b.x, SEA_Y - 0.02, b.z, 1]), age: 0 });
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
        const sc = farScale() * STARS.size * 0.8;
        const hx = b.x + Math.sin(b.heading) * c.height * 0.4, hz = b.z + Math.cos(b.heading) * c.height * 0.4, hy = b.y + c.height * 0.9;
        hs.forEach((h, i) => {
          const ang = tick * STARS.speed + (i / 3) * Math.PI * 2;
          const cc = Math.cos(-ang) * sc, ss = Math.sin(-ang) * sc;
          h.setMatrix([cc, 0, -ss, 0, 0, sc, 0, 0, ss, 0, cc, 0, hx + Math.cos(ang) * 0.09 * sc, hy, hz + Math.sin(ang) * 0.09 * sc, 1]);
        });
      }
    }
    // Splashes: up and back down into the water.
    for (let i = st.spouts.length - 1; i >= 0; i--) {
      const s = st.spouts[i]!;
      s.age += dt;
      const k = Math.min(1, s.age / 0.9);
      const m = Array.from(s.h.base);
      m[5] = Math.sin(k * Math.PI) * 0.55 + 0.001;
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
    st.own.releaseAll();
  },
});
