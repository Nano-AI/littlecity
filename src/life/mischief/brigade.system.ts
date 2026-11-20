// The fire brigade, drawn (design section 13b, "The town fights back").
// Owner: Mischief.
//
// The fire chain (./response.ts) decides who does what; this draws what they
// work with: the pump cart parked by the fire, the hose from the water to
// the cart and on to each nozzle, firemen's helmets, the jets of water
// arcing from the nozzles onto the flames, a bucket passed hand to hand
// down the chain and thrown, and steam where the water lands. Big, bright
// shapes, so it reads from the playing zoom.

import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import { compose, frame, rotationY, scaling, translation, type Mat4, type Vec3 } from '@/core/mat4';
import { hash, rand } from '@/core/rand';
import { airborne, MIST } from '@/gen/airborne';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { ball } from '@/parts/actors/kit';
import type { StructureId } from '@/resolve/plan';
import { DAMAGE_COLORS } from '@/style/damage';
import { PALETTE } from '@/style/palette';
import { PERSON } from '@/style/people';
import { defineSystem, type InstanceHandle, type LifeStage } from '../api';
import type { Person } from '../people/crowd';
import { mischiefOf, type Director } from './director';
import type { Brigade } from './response';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];
const DROPS = 20;

let cartMesh: MeshData | null = null;
/** The pump cart: a red box on two wheels with a brass pump, a rocking handle, a hose reel. Origin at the ground, shafts toward +Z. */
function pumpCartMesh(): MeshData {
  if (cartMesh) return cartMesh;
  const b = new MeshBuilder({ ink: 'pump-cart' });
  b.setColor(PALETTE.red).setPattern(PATTERN.planks).setInk('box');
  b.box([-0.17, 0.13, -0.18], [0.17, 0.33, 0.16]);
  b.setColor(PALETTE.yellow).setPattern(PATTERN.metal).setInk('pump');
  b.at(translation(0, 0.33, -0.04), () => b.lathe([[0.06, 0], [0.06, 0.16], [0.04, 0.2], [0, 0.22]], { segments: 10 }));
  b.setColor(PALETTE.wood).setPattern(PATTERN.none).setInk('handle');
  b.box([-0.2, 0.52, -0.06], [0.2, 0.55, -0.02]);
  b.setColor(PALETTE.metal).setInk('wheels');
  for (const x of [-0.21, 0.21]) b.at([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, x, 0.13, 0, 1], () => b.lathe([[0.13, -0.015], [0.13, 0.015]], { segments: 12, capTop: true, capBottom: true }));
  b.setColor(PALETTE.wood).setInk('shafts');
  b.box([-0.13, 0.15, 0.16], [-0.1, 0.18, 0.42]);
  b.box([0.1, 0.15, 0.16], [0.13, 0.18, 0.42]);
  b.setColor(DAMAGE_COLORS.hose).setPattern(PATTERN.none).setInk('reel');
  b.at([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0.25, -0.2, 1], () => b.lathe([[0.08, -0.12], [0.1, -0.1], [0.1, 0.1], [0.08, 0.12]], { segments: 10, capTop: true, capBottom: true }));
  return (cartMesh = b.build());
}

let hoseMesh: MeshData | null = null;
/** One length of hose: 1 long along +X, lying on the ground. */
function hoseSegment(): MeshData {
  if (hoseMesh) return hoseMesh;
  const b = new MeshBuilder({ ink: 'hose' });
  b.setColor(DAMAGE_COLORS.hose).setPattern(PATTERN.none).setInk('hose');
  b.box([0, 0, -0.022], [1, 0.035, 0.022]);
  return (hoseMesh = b.build());
}

let helmetMesh: MeshData | null = null;
/** A fireman's helmet: a brass dome with a broad brim swept down at the back. Origin at the top of the head. */
function fireHelmet(): MeshData {
  if (helmetMesh) return helmetMesh;
  const b = new MeshBuilder({ ink: 'fire-helmet' });
  b.setColor(PALETTE.yellow).setPattern(PATTERN.metal).setInk('helmet');
  b.at(translation(0, -0.03, 0), () => b.lathe([[0.065, 0], [0.06, 0.04], [0.035, 0.07], [0, 0.08]], { segments: 10 }));
  b.setColor(PALETTE.redDark).setPattern(PATTERN.none).setInk('brim');
  b.at(translation(0, -0.035, -0.01), () => b.lathe([[0.1, 0], [0.105, 0.012], [0, 0.014]], { segments: 12, capBottom: true }));
  return (helmetMesh = b.build());
}

let dropMesh: MeshData | null = null;
/** A gout of water in a jet: a bright foamy blob. */
function waterDrop(): MeshData {
  if (dropMesh) return dropMesh;
  const b = new MeshBuilder({ ink: 'water-jet' });
  b.setColor(PALETTE.foam).setPattern(airborne(PATTERN.foam)).setInkId(0x3a7e);
  ball(b, 0, 0, 0, 0.5, 0.42, 0.5, 8, 4);
  b.setColor(PALETTE.shallow).setInkId(0x3a7e);
  ball(b, 0.18, -0.08, 0.1, 0.3, 0.26, 0.3, 6, 3);
  return (dropMesh = b.build());
}

let bucketMesh: MeshData | null = null;
function bucket(): MeshData {
  if (bucketMesh) return bucketMesh;
  const b = new MeshBuilder({ ink: 'fire-bucket' });
  b.setColor(PALETTE.wood).setPattern(PATTERN.planks).setInk('bucket');
  b.lathe([[0.04, 0], [0.05, 0.08]], { segments: 8, capBottom: true });
  b.setColor(PALETTE.shallow).setPattern(PATTERN.water).setInk('water');
  b.at(translation(0, 0.07, 0), () => b.lathe([[0.046, 0], [0, 0.002]], { segments: 8 }));
  return (bucketMesh = b.build());
}

let steamMesh: MeshData | null = null;
function steam(): MeshData {
  if (steamMesh) return steamMesh;
  const b = new MeshBuilder({ ink: 'steam' });
  b.setColor(PALETTE.white).setPattern(MIST).setInk('steam');
  ball(b, 0, 0, 0, 0.45, 0.4, 0.45, 9, 5);
  ball(b, 0.25, 0.1, 0, 0.3, 0.28, 0.3, 7, 4);
  return (steamMesh = b.build());
}

class Pool {
  private free: InstanceHandle[] = [];
  constructor(
    private stage: LifeStage,
    private mesh: () => MeshData,
  ) {}
  take(): InstanceHandle {
    return this.free.pop() ?? this.stage.spawnMesh(this.mesh(), HIDDEN);
  }
  give(h: InstanceHandle): void {
    h.setVisible(false);
    this.free.push(h);
  }
  dispose(): void {
    for (const h of this.free) h.release();
    this.free = [];
  }
}

interface Drawn {
  cart: InstanceHandle | null;
  hoses: InstanceHandle[];
  drops: InstanceHandle[];
  helmets: Map<Person, InstanceHandle>;
  bucket: InstanceHandle | null;
}
interface Steam {
  h: InstanceHandle;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
}
interface State {
  d: Director;
  drawn: Map<StructureId, Drawn>;
  steam: Steam[];
  pools: Record<'cart' | 'hose' | 'drop' | 'helmet' | 'bucket' | 'steam', Pool>;
  time: number;
  steamIn: number;
}

/** A segment of hose (or anything 1 long along +X) laid from a to b. */
function along(a: Vec3, b: Vec3, thick = 1): Mat4 {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz) || 1e-3;
  const x: Vec3 = [dx / len, dy / len, dz / len];
  let sx = -x[2], sz = x[0];
  const sl = Math.hypot(sx, sz) || 1;
  sx /= sl;
  sz /= sl;
  const z: Vec3 = [sx, 0, sz];
  const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return compose(frame(a, x, y, z), scaling(len, thick, thick));
}

/** Where a person's hands are, about: in front of them at chest height. */
function hands(p: Person, reach = 0.12, up = 0.24): Vec3 {
  return [p.x + Math.sin(p.heading) * reach, p.y + up, p.z + Math.cos(p.heading) * reach];
}

/** The top of a burning block, where the water lands. */
function landing(cell: number): Vec3 {
  return [keyX(cell) + 0.5, (keyY(cell) + 0.85) * CELL_H, keyZ(cell) + 0.5];
}

const atSpot = (p: Person | null): p is Person => !!p && p.mode === 'linger' && (p.goal?.errand?.tag ?? '').startsWith('fire:');

export default defineSystem<State>({
  id: 'mischief.brigade',
  order: 11,
  create(ctx) {
    const d = mischiefOf(ctx.stage);
    const pool = (m: () => MeshData): Pool => new Pool(ctx.stage, m);
    return {
      d,
      drawn: new Map(),
      steam: [],
      pools: { cart: pool(pumpCartMesh), hose: pool(hoseSegment), drop: pool(waterDrop), helmet: pool(fireHelmet), bucket: pool(bucket), steam: pool(steam) },
      time: 0,
      steamIn: 0,
    };
  },
  update(st, dt, signals) {
    st.time += dt;
    const brigades: ReadonlyMap<StructureId, Brigade> = st.d.brigades ?? new Map();
    const P = st.pools;
    // Gone brigades: their things are put away.
    for (const [sid, dr] of st.drawn) {
      if (brigades.has(sid)) continue;
      if (dr.cart) P.cart.give(dr.cart);
      for (const h of dr.hoses) P.hose.give(h);
      for (const h of dr.drops) P.drop.give(h);
      for (const h of dr.helmets.values()) P.helmet.give(h);
      if (dr.bucket) P.bucket.give(dr.bucket);
      st.drawn.delete(sid);
    }
    st.steamIn -= dt;
    const puffSteam = st.steamIn <= 0;
    if (puffSteam) st.steamIn = 0.18;
    for (const [sid, b] of brigades) {
      let dr = st.drawn.get(sid);
      if (!dr) st.drawn.set(sid, (dr = { cart: null, hoses: [], drops: [], helmets: new Map(), bucket: null }));
      // Helmets on the brigade (the pumper and the nozzles).
      const crew = [b.pumper, ...b.nozzles].filter((p): p is Person => !!p);
      for (const p of crew) {
        let h = dr.helmets.get(p);
        if (!h) dr.helmets.set(p, (h = P.helmet.take()));
        const top = p.y + PERSON.height * 0.97 + (p.mode === 'walk' ? 0.006 * Math.sin(p.stride * Math.PI * 4) : 0);
        h.setMatrix(compose(translation(p.x, top, p.z), rotationY(p.heading)));
        h.setVisible(p.visible);
      }
      // The cart, once it is parked and the pump is going.
      const pumping = atSpot(b.pumper) && !!b.cart;
      if (pumping && b.cart) {
        if (!dr.cart) dr.cart = P.cart.take();
        dr.cart.setMatrix(compose(translation(b.cart.x, b.cart.y, b.cart.z), rotationY(b.cart.face + Math.PI)));
        dr.cart.setVisible(true);
      } else if (dr.cart) {
        P.cart.give(dr.cart);
        dr.cart = null;
      }
      // Hoses: water → cart, cart → each nozzle at work.
      const lines: [Vec3, Vec3][] = [];
      if (pumping && b.cart) {
        const c: Vec3 = [b.cart.x, b.cart.y + 0.02, b.cart.z];
        lines.push([[b.water.x, b.water.y + 0.02, b.water.z], c]);
        for (const p of b.nozzles) if (atSpot(p)) lines.push([c, [p.x, p.y + 0.02, p.z]]);
      }
      while (dr.hoses.length < lines.length) dr.hoses.push(P.hose.take());
      while (dr.hoses.length > lines.length) P.hose.give(dr.hoses.pop()!);
      lines.forEach(([a, c], i) => {
        dr.hoses[i]!.setMatrix(along(a, c));
        dr.hoses[i]!.setVisible(true);
      });
      // Jets: a stream of gouts on an arc from each working nozzle (and a thrown bucketful from the chain's end).
      const jets: { from: Vec3; to: Vec3; seed: number; n: number; size: number; speed: number }[] = [];
      for (const p of b.nozzles) {
        const aim = b.aim.get(p);
        if (aim === undefined || !atSpot(p) || !pumping) continue;
        jets.push({ from: hands(p, 0.2, 0.26), to: landing(aim), seed: hash(sid, p.seed), n: DROPS, size: 0.15, speed: 1.3 });
      }
      const last = b.buckets[b.buckets.length - 1];
      const chainAim = last ? b.aim.get(last) : undefined;
      const chainReady = b.buckets.length > 0 && b.buckets.every(atSpot);
      if (last && chainAim !== undefined && chainReady) {
        // A bucketful flies once every 1.4 s (the chain's own beat, ./response.ts).
        const beat = (st.time % 1.4) / 1.4;
        if (beat < 0.45) jets.push({ from: hands(last, 0.15, 0.3), to: landing(chainAim), seed: hash(sid, 'bucket'), n: 7, size: 0.2 * (1 - beat * 0.6), speed: 0 });
      }
      let used = 0;
      for (const j of jets) {
        for (let k = 0; k < j.n; k++) {
          if (dr.drops.length <= used) dr.drops.push(P.drop.take());
          const h = dr.drops[used++]!;
          // Along the arc: a jet streams (t runs on); a thrown bucketful flies as one clump.
          const t = j.speed > 0 ? ((st.time * j.speed + k / j.n + rand(j.seed, k) * 0.03) % 1) : Math.min(1, ((st.time % 1.4) / 1.4) / 0.45) * (0.92 + 0.08 * (k / j.n));
          const x = j.from[0] + (j.to[0] - j.from[0]) * t;
          const z = j.from[2] + (j.to[2] - j.from[2]) * t;
          const rise = 0.6 + 0.25 * Math.hypot(j.to[0] - j.from[0], j.to[2] - j.from[2]);
          const y = j.from[1] + (j.to[1] - j.from[1]) * t + rise * 4 * t * (1 - t);
          const s = j.size * (0.75 + 0.5 * Math.sin((t + k) * 7) ** 2) * (j.speed > 0 ? 1 - 0.3 * t : 1);
          h.setMatrix([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, x, y, z, 1]);
          h.setVisible(true);
        }
        if (puffSteam) st.steam.push({ h: P.steam.take(), x: j.to[0] + (rand(j.seed, st.time) - 0.5) * 0.3, y: j.to[1], z: j.to[2] + (rand(j.seed, 'z', st.time) - 0.5) * 0.3, age: 0, life: 1.6 });
      }
      while (dr.drops.length > used) P.drop.give(dr.drops.pop()!);
      // The bucket passed down the chain, hand to hand.
      if (chainReady && b.buckets.length > 1) {
        if (!dr.bucket) dr.bucket = P.bucket.take();
        const pos = ((st.time * 2.6) % b.buckets.length);
        const i = Math.floor(pos), f = pos - i;
        const a = hands(b.buckets[i]!, 0.1, 0.2);
        const c = hands(b.buckets[Math.min(b.buckets.length - 1, i + 1)]!, 0.1, 0.2);
        dr.bucket.setMatrix(translation(a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f + 0.05 * Math.sin(f * Math.PI), a[2] + (c[2] - a[2]) * f));
        dr.bucket.setVisible(true);
      } else if (dr.bucket) {
        P.bucket.give(dr.bucket);
        dr.bucket = null;
      }
    }
    // Steam where the water lands, rising and thinning.
    let kept = 0;
    for (const s of st.steam) {
      s.age += dt;
      const t = s.age / s.life;
      if (t >= 1) {
        P.steam.give(s.h);
        continue;
      }
      st.steam[kept++] = s;
      const w = signals.wind(s.x, s.z);
      const sc = 0.25 + 0.5 * t;
      s.h.setMatrix([sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, s.x + w.dirX * t * 0.4, s.y + 0.15 + t * 0.7, s.z + w.dirZ * t * 0.4, 1]);
      s.h.setParams(0.8 * (1 - t));
      s.h.setVisible(true);
    }
    st.steam.length = kept;
  },
  dispose(st) {
    for (const dr of st.drawn.values()) {
      dr.cart?.release();
      for (const h of [...dr.hoses, ...dr.drops, ...dr.helmets.values()]) h.release();
      dr.bucket?.release();
    }
    for (const s of st.steam) s.h.release();
    for (const p of Object.values(st.pools)) p.dispose();
  },
});
