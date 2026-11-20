// The fire brigade, drawn (design section 13b, "The town fights back").
// Owner: Mischief.
//
// The fire chain (./response.ts) decides who does what; this draws what they
// work with. The town's pump cart, always somewhere (kept by its well, or
// on the move with the man wheeling it, or set down by a fire); its pump
// handle rocking while it is worked; the suction hose let down into the
// water; the delivery hose lying on the ground along the way the nozzle man
// walked, paying out behind him and wound back in; helmets on the two of
// them; the jet as one tapering stream that breaks into drops only at its
// end; a bucket passed down a chain and thrown as one slosh; and steam where
// water lands. Big, bright shapes, so it reads from the playing zoom.

import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import { compose, frame, rotationY, scaling, translation, type Mat4, type Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { airborne, MIST } from '@/gen/airborne';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { ball } from '@/parts/actors/kit';
import type { StructureId } from '@/resolve/plan';
import { DAMAGE_COLORS } from '@/style/damage';
import { PALETTE } from '@/style/palette';
import { PERSON } from '@/style/people';
import { defineSystem, type InstanceHandle, type LifeStage } from '../api';
import type { Person } from '../people/crowd';
import { ownStage, type Owned } from './owned';
import { mischiefOf, type Director } from './director';
import type { Brigade } from './response';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];

let cartMesh: MeshData | null = null;
/** The pump cart: a red box on two wheels with a brass pump, a rocking handle, a hose reel. Origin at the ground, shafts toward +Z. */
function pumpCartMesh(): MeshData {
  if (cartMesh) return cartMesh;
  const b = new MeshBuilder({ ink: 'pump-cart' });
  b.setColor(PALETTE.red).setPattern(PATTERN.planks).setInk('box');
  b.box([-0.17, 0.13, -0.18], [0.17, 0.33, 0.16]);
  b.setColor(PALETTE.yellow).setPattern(PATTERN.metal).setInk('pump');
  b.at(translation(0, 0.33, -0.04), () => b.lathe([[0.06, 0], [0.06, 0.16], [0.04, 0.2], [0, 0.22]], { segments: 10 }));
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

let handleMesh: MeshData | null = null;
/** The pump's rocking handle: a bar across the top, pivoting on the pump's crown. Origin at the pivot. */
function pumpHandle(): MeshData {
  if (handleMesh) return handleMesh;
  const b = new MeshBuilder({ ink: 'pump-handle' });
  b.setColor(PALETTE.wood).setPattern(PATTERN.none).setInk('handle');
  b.box([-0.22, 0, -0.02], [0.22, 0.03, 0.02]);
  b.box([-0.22, 0, -0.08], [-0.19, 0.03, 0.08]);
  b.box([0.19, 0, -0.08], [0.22, 0.03, 0.08]);
  return (handleMesh = b.build());
}

const JET_INK = 0x3a7e;
let jetMesh: MeshData | null = null;
/** One length of the jet: a round stream 1 long along +X, 1 across; the lengths share one ink, so the stream is one shape. */
function jetSegment(): MeshData {
  if (jetMesh) return jetMesh;
  const b = new MeshBuilder();
  b.setColor(PALETTE.foam).setPattern(airborne(PATTERN.foam)).setInkId(JET_INK);
  // A lathe about y, turned to lie along x, overlapping its neighbours a little at each end.
  b.at([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, -0.04, 0, 0, 1], () => b.lathe([[0.5, 0], [0.5, 1.08]], { segments: 8 }));
  return (jetMesh = b.build());
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
  /** Everything this draws (so dispose takes back all of it). */
  own: Owned;
  cart: InstanceHandle | null;
  handle: InstanceHandle | null;
  helmets: Map<Person, InstanceHandle>;
  hoses: InstanceHandle[];
  jet: InstanceHandle[];
  drops: InstanceHandle[];
  buckets: Map<StructureId, InstanceHandle>;
  steam: Steam[];
  pools: Record<'hose' | 'jet' | 'drop' | 'helmet' | 'bucket' | 'steam', Pool>;
  time: number;
  steamIn: number;
}

/** A length of something 1 long along +X laid from a to b, `thick` across. */
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

/** A laid hose's line, rounded off (two passes of corner cutting) so it lies in curves, not kinks. */
function smooth(pts: readonly Vec3[]): Vec3[] {
  let out = pts.slice();
  for (let pass = 0; pass < 2 && out.length > 2; pass++) {
    const next: Vec3[] = [out[0]!];
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i]!, b = out[i + 1]!;
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75]);
    }
    next.push(out[out.length - 1]!);
    out = next;
  }
  return out;
}

const atWork = (p: Person | null, tag: string): p is Person => !!p && p.mode === 'linger' && (p.goal?.errand?.tag ?? '') === tag;

export default defineSystem<State>({
  id: 'mischief.brigade',
  order: 11,
  create(ctx) {
    const d = mischiefOf(ctx.stage);
    const own = ownStage(ctx.stage);
    const pool = (m: () => MeshData): Pool => new Pool(own.stage, m);
    return {
      d,
      own,
      cart: null,
      handle: null,
      helmets: new Map(),
      hoses: [],
      jet: [],
      drops: [],
      buckets: new Map(),
      steam: [],
      pools: { hose: pool(hoseSegment), jet: pool(jetSegment), drop: pool(waterDrop), helmet: pool(fireHelmet), bucket: pool(bucket), steam: pool(steam) },
      time: 0,
      steamIn: 0,
    };
  },
  update(st, dt, signals) {
    st.time += dt;
    const P = st.pools;
    const twos = Math.floor(st.time * 12);
    const pump = st.d.pump;
    st.steamIn -= dt;
    const puffSteam = st.steamIn <= 0;
    if (puffSteam) st.steamIn = 0.2;
    const splashes: Vec3[] = [];

    // ── the pump cart ──────────────────────────────────────────────────
    if (pump) {
      if (!st.cart) st.cart = st.own.stage.spawnMesh(pumpCartMesh(), HIDDEN);
      if (!st.handle) st.handle = st.own.stage.spawnMesh(pumpHandle(), HIDDEN);
      const { x, y, z, face } = pump.at;
      const rolling = pump.state === 'wheel' || pump.state === 'return';
      // A little bounce over the cobbles while it rolls.
      const bob = rolling ? 0.01 * Math.abs(Math.sin(st.time * 14)) : 0;
      st.cart.setMatrix(compose(translation(x, y + bob, z), rotationY(face)));
      st.cart.setVisible(true);
      // The handle rocks while the pump is worked (on twos).
      const working = pump.state === 'work' || pump.state === 'lay';
      const rock = working && atWork(pump.pumper, 'fire:pump') ? Math.sin(Math.floor(st.time * 6) * 1.6) * 0.32 : 0;
      st.handle.setMatrix(compose(translation(x, y + bob + 0.55, z), rotationY(face), [Math.cos(rock), Math.sin(rock), 0, 0, -Math.sin(rock), Math.cos(rock), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
      st.handle.setVisible(true);
    } else {
      st.cart?.release();
      st.handle?.release();
      st.cart = st.handle = null;
    }

    // Helmets on the cart's two hands while they are about it.
    const crew = pump ? [pump.pumper, pump.nozzle].filter((p): p is Person => !!p) : [];
    for (const [p, h] of st.helmets) {
      if (crew.includes(p)) continue;
      P.helmet.give(h);
      st.helmets.delete(p);
    }
    for (const p of crew) {
      let h = st.helmets.get(p);
      if (!h) st.helmets.set(p, (h = P.helmet.take()));
      const top = p.y + PERSON.height * 0.97 + (p.mode === 'walk' ? 0.006 * Math.sin(p.stride * Math.PI * 4) : 0);
      h.setMatrix(compose(translation(p.x, top, p.z), rotationY(p.heading)));
      h.setVisible(p.visible);
    }

    // ── hoses: the suction hose into the water, the delivery hose as laid ──
    const lines: Vec3[][] = [];
    if (pump && pump.water && pump.suction > 0) {
      const c = pump.at, w = pump.water;
      const n = 6;
      const pts: Vec3[] = [];
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * pump.suction;
        // Off the reel at the back, down over the ground in a slack curve to the water.
        pts.push([c.x + (w.x - c.x) * t + Math.sin(t * Math.PI) * 0.12, c.y + 0.25 * (1 - Math.min(1, t * 4)) + 0.02, c.z + (w.z - c.z) * t]);
      }
      lines.push(pts);
    }
    if (pump && pump.hose.length > 0) {
      const pts: Vec3[] = [[pump.at.x, pump.at.y + 0.22, pump.at.z], ...pump.hose.map((q) => [q.x, q.y, q.z] as Vec3)];
      // To his hands, if he still holds it.
      const n = pump.nozzle;
      if (n && ((pump.state === 'lay' && (n.goal?.errand?.tag ?? '') === 'fire:hose') || pump.state === 'work' || pump.state === 'reel')) pts.push(hands(n, 0.16, 0.22));
      lines.push(smooth(pts));
    }
    let used = 0;
    for (const pts of lines) {
      for (let i = 0; i + 1 < pts.length; i++) {
        if (st.hoses.length <= used) st.hoses.push(P.hose.take());
        const h = st.hoses[used++]!;
        h.setMatrix(along(pts[i]!, pts[i + 1]!, 1));
        h.setVisible(true);
      }
    }
    while (st.hoses.length > used) P.hose.give(st.hoses.pop()!);

    // ── the jet: one stream from the nozzle, breaking up at its end ──
    let segs = 0;
    let dropN = 0;
    const arc = (from: Vec3, to: Vec3, t: number, waver: number): Vec3 => {
      const rise = 0.55 + 0.25 * Math.hypot(to[0] - from[0], to[2] - from[2]);
      const side = Math.sin(st.time * 5 + t * 6) * waver * t;
      const dx = to[0] - from[0], dz = to[2] - from[2], l = Math.hypot(dx, dz) || 1;
      return [from[0] + dx * t - (dz / l) * side, from[1] + (to[1] - from[1]) * t + rise * 4 * t * (1 - t), from[2] + dz * t + (dx / l) * side];
    };
    if (pump && pump.flowing && pump.nozzle && pump.aim !== null) {
      const from = hands(pump.nozzle, 0.22, 0.24);
      const to = landing(pump.aim);
      // Drawn on twos: the stream wavers a little drawing to drawing.
      const waver = 0.06 + 0.03 * Math.sin(twos * 1.7);
      const N = 14;
      const whole = 0.78; // the stream holds together this far, then breaks into drops
      for (let i = 0; i < N; i++) {
        const t0 = (i / N) * whole, t1 = ((i + 1) / N) * whole;
        if (st.jet.length <= segs) st.jet.push(P.jet.take());
        const h = st.jet[segs++]!;
        h.setMatrix(along(arc(from, to, t0, waver), arc(from, to, t1, waver), 0.075 - 0.035 * (i / N)));
        h.setVisible(true);
      }
      for (let k = 0; k < 9; k++) {
        const t = whole + ((st.time * 1.4 + k / 9 + rand(k, 'drop') * 0.1) % 1) * (1 - whole);
        const p = arc(from, to, t, waver * 1.5);
        if (st.drops.length <= dropN) st.drops.push(P.drop.take());
        const h = st.drops[dropN++]!;
        const sc = 0.07 * (1.1 - (t - whole) / (1 - whole) * 0.5);
        h.setMatrix([sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, p[0] + (rand(k, twos) - 0.5) * 0.08, p[1], p[2] + (rand(k, 'z', twos) - 0.5) * 0.08, 1]);
        h.setVisible(true);
      }
      splashes.push(to);
    }

    // ── bucket chains: a bucket passed hand to hand, thrown as one slosh ──
    const brigades: ReadonlyMap<StructureId, Brigade> = st.d.brigades ?? new Map();
    for (const [sid, h] of st.buckets) {
      if (brigades.has(sid)) continue;
      P.bucket.give(h);
      st.buckets.delete(sid);
    }
    for (const [sid, b] of brigades) {
      const ready = b.buckets.length > 0 && b.buckets.every((p) => atWork(p, 'fire:bucket'));
      let h = st.buckets.get(sid);
      if (ready && b.buckets.length > 1) {
        if (!h) st.buckets.set(sid, (h = P.bucket.take()));
        const pos = (st.time * 2.6) % b.buckets.length;
        const i = Math.floor(pos), f = pos - i;
        const a = hands(b.buckets[i]!, 0.1, 0.2);
        const c = hands(b.buckets[Math.min(b.buckets.length - 1, i + 1)]!, 0.1, 0.2);
        h.setMatrix(translation(a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f + 0.05 * Math.sin(f * Math.PI), a[2] + (c[2] - a[2]) * f));
        h.setVisible(true);
      } else if (h) {
        P.bucket.give(h);
        st.buckets.delete(sid);
      }
      const last = b.buckets[b.buckets.length - 1];
      const aim = last ? b.aim.get(last) : undefined;
      if (!last || aim === undefined || !ready) continue;
      const beat = (st.time % 1.4) / 1.4;
      if (beat >= 0.45) continue;
      // The slosh: one stretched gout along its flight, a couple of drops trailing.
      const from = hands(last, 0.15, 0.3);
      const to = landing(aim);
      const t = Math.min(1, beat / 0.45);
      const p = arc(from, to, t, 0);
      const q = arc(from, to, Math.min(1, t + 0.06), 0);
      if (st.drops.length <= dropN) st.drops.push(P.drop.take());
      const g = st.drops[dropN++]!;
      g.setMatrix(along([p[0] - (q[0] - p[0]), p[1] - (q[1] - p[1]), p[2] - (q[2] - p[2])], q, 0.14 * (1 - t * 0.4)));
      g.setVisible(true);
      for (let k = 0; k < 2; k++) {
        const r = arc(from, to, Math.max(0, t - 0.08 * (k + 1)), 0);
        if (st.drops.length <= dropN) st.drops.push(P.drop.take());
        const dh = st.drops[dropN++]!;
        const sc = 0.05 - k * 0.012;
        dh.setMatrix([sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, r[0], r[1], r[2], 1]);
        dh.setVisible(true);
      }
      if (t > 0.9) splashes.push(to);
    }
    while (st.jet.length > segs) P.jet.give(st.jet.pop()!);
    while (st.drops.length > dropN) P.drop.give(st.drops.pop()!);

    // ── steam and spray where the water lands ──
    if (puffSteam) for (const to of splashes) st.steam.push({ h: P.steam.take(), x: to[0] + (rand(twos, to[0]) - 0.5) * 0.3, y: to[1], z: to[2] + (rand(twos, to[2]) - 0.5) * 0.3, age: 0, life: 1.6 });
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
    st.cart?.release();
    st.handle?.release();
    for (const h of [...st.hoses, ...st.jet, ...st.drops, ...st.helmets.values(), ...st.buckets.values()]) h.release();
    for (const s of st.steam) s.h.release();
    for (const p of Object.values(st.pools)) p.dispose();
    st.own.releaseAll();
  },
});
