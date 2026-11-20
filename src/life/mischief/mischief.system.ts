// Mischief, drawn (design section 13b). Owner: Mischief.
//
// Steps the director's engine and draws what it is doing: flames licking
// from windows and roofs on twos, leaning with the wind; sparks; a column of
// smoke that rises, leans and thins into a soft wash against the sky; embers
// that glow in a burnt-out shell and slowly die; the bomb falling, its fuse
// fizzing; the flash of the blast, dust, every bird in town taking off,
// neighbours shaken; and the building's own chunks flying out on arcs,
// tumbling, and landing where its rubble heap is baked (so they become it).
// A spout in the water. Nothing here is saved; the damage is, by the engine.

import { CELL_H, DIR4, key, keyX, keyY, keyZ, SEA_Y, type CellKey } from '@/core/grid';
import { compose, multiply, rotationY, scaling, translation, type Mat4 } from '@/core/mat4';
import { hash, rand } from '@/core/rand';
import { blastChunks } from '@/gen/damage/damage';
import { chunkMatrix, type Chunk } from '@/gen/damage/debris';
import { AIRBORNE } from '@/gen/airborne';
import { Soup } from '@/gen/damage/poly';
import { allGenerators, allParts } from '@/gen/discover';
import type { MeshData } from '@/gen/mesh';
import type { ShapePlan, StructureId } from '@/resolve/plan';
import { ruinSettling, ruinStage, ruinCause } from '@/world/damage';
import { defineSystem, type InstanceHandle, type LifeStage, type Signals, type SpawnSpec } from '../api';
import { scaresOf } from '../birds/scare';
import { fxOf } from '../fx/fx';
import { mischiefOf, type Director, type MischiefEvent } from './director';
import { bombMesh, emberMesh, firelightMesh, flameMesh, flashMesh, FUSE_TIP, smokeMesh, sparkMesh, spoutMesh } from './meshes';

/** Instances of one mesh, reused: a finished flame is hidden and handed to the next. */
class Pool {
  private free: InstanceHandle[] = [];
  constructor(
    private stage: LifeStage,
    private mesh: () => MeshData,
  ) {}
  take(): InstanceHandle {
    const h = this.free.pop() ?? this.stage.spawnMesh(this.mesh(), HIDDEN);
    return h;
  }
  give(h: InstanceHandle): void {
    h.setVisible(false);
    if (this.free.length < 256) this.free.push(h);
    else h.release();
  }
  dispose(): void {
    for (const h of this.free) h.release();
    this.free = [];
  }
}

/** A phone-sized viewport (as the crowd decides): fewer puffs and sparks, one flame at a window instead of two. */
function phone(): boolean {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  const h = (globalThis as { innerHeight?: number }).innerHeight;
  return typeof w === 'number' && typeof h === 'number' && Math.min(w, h) < 600;
}
const LIGHT = phone();
const PUFF_CAP = LIGHT ? 60 : 160;
const SPARK_CAP = LIGHT ? 50 : 140;

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];
const FPS = 12;

interface Spot {
  x: number;
  y: number;
  z: number;
  /** Facing (radians about up), for a flame at a window. */
  rot: number;
  size: number;
  roof: boolean;
}
interface Flame {
  cell: CellKey;
  spots: Spot[];
  handles: InstanceHandle[];
  looks: number[];
  phase: number;
  intensity: number;
  frame: number;
}
interface Puff {
  ink: InstanceHandle;
  mist: InstanceHandle;
  look: number;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  size: number;
  misted: boolean;
}
interface Spark {
  h: InstanceHandle;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
}
interface Ember {
  h: InstanceHandle;
  age: number;
  life: number;
}
interface BombDraw {
  h: InstanceHandle;
  sparkIn: number;
}
interface Flash {
  h: InstanceHandle;
  age: number;
  x: number;
  y: number;
  z: number;
  power: number;
}
interface Flight {
  chunks: Chunk[];
  handles: InstanceHandle[];
  age: number;
  arcs: { h: number; spin: number; delay: number; dur: number }[];
}
interface Shake {
  id: StructureId;
  h: InstanceHandle | null;
  age: number;
  amp: number;
}
interface Spout {
  h: InstanceHandle;
  age: number;
  x: number;
  z: number;
}

interface State {
  d: Director;
  shape: ShapePlan | null;
  flames: Map<CellKey, Flame>;
  puffs: Puff[];
  sparks: Spark[];
  embers: Map<CellKey, Ember>;
  bombs: Map<number, BombDraw>;
  flashes: Flash[];
  flights: Map<StructureId, Flight>;
  /** Structures whose chunks should fly once the town shows them broken. */
  toFly: Set<StructureId>;
  shakes: Shake[];
  toShake: { id: StructureId; amp: number }[];
  spouts: Spout[];
  pools: Map<string, Pool>;
  smokeAcc: Map<StructureId, number>;
  /** Firelight round each burning building. */
  lights: Map<StructureId, InstanceHandle>;
  sparkAcc: number;
  time: number;
  off: () => void;
}

const DUST: readonly SpawnSpec[] = [0, 1, 2, 3].map((look) => ({ actor: 'puff', variant: 'dust', params: { look } }) as SpawnSpec);

function pool(st: State, stage: LifeStage, k: string, mesh: () => MeshData): Pool {
  let p = st.pools.get(k);
  if (!p) st.pools.set(k, (p = new Pool(stage, mesh)));
  return p;
}

/** Where flames show on a burning block: out of its windows and doors, and up from its roof if nothing of its building stands on it. */
function spotsOf(shape: ShapePlan, cell: CellKey): Spot[] {
  const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
  const sid = shape.structureAt.get(cell);
  const kind = shape.kinds.get(cell);
  const out: Spot[] = [];
  const top = sid === undefined || shape.structureAt.get(key(x, y + 1, z)) !== sid;
  const seed = hash(shape.world.seed, 'flames', cell);
  if (kind === 'house' || kind === 'windmill' || kind === 'tower' || kind === 'lighthouse') {
    const feats = (sid === undefined ? [] : shape.featuresByStructure.get(sid) ?? []).filter(
      (f) => f.cell === cell && f.dir !== undefined && (f.type === 'window' || f.type === 'door'),
    );
    // Two openings at most, picked by the seed.
    feats.sort((a, b) => hash(seed, a.id) - hash(seed, b.id));
    for (const f of feats.slice(0, LIGHT ? 1 : 2)) {
      const [dx, dz] = DIR4[f.dir!]!;
      out.push({ x: x + 0.5 + dx * 0.5, y: y * CELL_H + (f.type === 'door' ? 0.05 : 0.3), z: z + 0.5 + dz * 0.5, rot: Math.atan2(dx, dz), size: 0.62, roof: false });
    }
    if (top) out.push({ x: x + 0.5, y: (y + 1) * CELL_H - 0.05, z: z + 0.5, rot: rand(seed, 'rot') * Math.PI, size: 1.45, roof: true });
  } else if (kind === 'tree') {
    out.push({ x: x + 0.5, y: y * CELL_H + 0.35, z: z + 0.5, rot: rand(seed, 'rot') * Math.PI, size: 0.85, roof: true });
  } else if (kind === 'dock') {
    out.push({ x: x + 0.5, y: SEA_Y + 0.35, z: z + 0.5, rot: rand(seed, 'rot') * Math.PI, size: 0.6, roof: true });
  } else {
    out.push({ x: x + 0.5, y: y * CELL_H + 0.05, z: z + 0.5, rot: rand(seed, 'rot') * Math.PI, size: top ? 0.75 : 0.5, roof: top });
  }
  return out;
}

function settlingOf(shape: ShapePlan, id: StructureId): boolean {
  const s = shape.structures.get(id);
  if (!s) return false;
  for (const c of s.cells) if (ruinSettling(shape.world.blocks.get(c)?.ruin)) return true;
  return false;
}

function chunkMesh(ch: Chunk): MeshData {
  const soup = new Soup();
  for (const p of ch.polys) soup.add({ ...p, pattern: p.pattern | AIRBORNE });
  return soup.build();
}

function startFlight(st: State, stage: LifeStage, id: StructureId): void {
  const shape = st.shape;
  const s = shape?.structures.get(id);
  if (!shape || !s) return;
  const reg = allGenerators() as ReturnType<typeof allGenerators> & { intact?: ReturnType<typeof allGenerators> };
  const intact = (reg.intact ?? reg).build(s, shape, allParts());
  const chunks = blastChunks(intact.mesh, s, shape);
  if (chunks.length === 0) return;
  const old = st.flights.get(id);
  if (old) for (const h of old.handles) h.release();
  const flight: Flight = { chunks, handles: [], age: 0, arcs: [] };
  for (const ch of chunks) {
    const h = stage.spawnMesh(chunkMesh(ch), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    flight.handles.push(h);
    const r = (n: string): number => rand(ch.key, n);
    flight.arcs.push({
      h: ch.topple ? 0 : 0.6 + r('arc') * 1.6,
      spin: ch.topple ? 0 : (r('spin') < 0.5 ? -1 : 1) * Math.PI * 2 * Math.floor(1 + r('turns') * 2),
      delay: ch.topple ? 0.05 : r('delay') * 0.12,
      dur: ch.topple ? 1.0 : 0.8 + r('dur') * 0.45,
    });
  }
  st.flights.set(id, flight);
}

function endFlight(st: State, id: StructureId): void {
  const f = st.flights.get(id);
  if (!f) return;
  for (const h of f.handles) h.release();
  st.flights.delete(id);
}

function onEvent(st: State, stage: LifeStage, signals: Signals, e: MischiefEvent): void {
  const fx = fxOf(stage);
  if (e.type === 'drop') {
    const h = stage.spawnMesh(bombMesh(), HIDDEN);
    st.bombs.set(e.bomb.id, { h, sparkIn: 0 });
  } else if (e.type === 'blast') {
    const b = st.bombs.get(e.bomb);
    if (b) {
      b.h.release();
      st.bombs.delete(e.bomb);
    }
    const [x, y, z] = e.blast.point;
    // Every bird in town takes off.
    scaresOf(stage).add(key(Math.floor(x), Math.max(0, Math.floor(y / CELL_H)), Math.floor(z)), 99, false, signals.time.seconds);
    if (e.blast.water) {
      st.spouts.push({ h: stage.spawnMesh(spoutMesh(), HIDDEN), age: 0, x, z });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        fx.play({ actor: 'puff', variant: 'mist' } as SpawnSpec, 1.6, (t, m) => {
          const s = 0.4 + t * 0.6;
          setPlace(m, x + Math.cos(a) * (0.3 + t * 0.7), SEA_Y + 0.9 * Math.sin(t * Math.PI) + 0.2, z + Math.sin(a) * (0.3 + t * 0.7), s);
        }, { glow: (t) => 0.8 * (1 - t) });
      }
      return;
    }
    st.flashes.push({ h: stage.spawnMesh(flashMesh(), HIDDEN), age: 0, x, y: y + 0.3, z, power: e.blast.power });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rand(e.bomb, 'dust', i) * 0.4;
      const far = 0.9 + rand(e.bomb, 'far', i) * 1.6;
      const look = DUST[i % 4]!;
      fx.play(look, 2.6 + rand(e.bomb, 'life', i) * 1.6, (t, m) => {
        const ease = 1 - (1 - t) * (1 - t);
        const s = (0.6 + ease * 1.1) * (1 - Math.max(0, t - 0.75) * 2.5);
        setPlace(m, x + Math.cos(a) * far * ease, y + 0.15 + ease * (0.5 + (i % 3) * 0.3), z + Math.sin(a) * far * ease, Math.max(0.01, s));
      }, { delay: rand(e.bomb, 'delay', i) * 0.15 });
    }
    const hitStructures = new Map<StructureId, number>();
    for (const h of e.blast.hit) {
      const sid = st.shape?.structureAt.get(h.cell);
      if (sid !== undefined) hitStructures.set(sid, Math.max(hitStructures.get(sid) ?? 0, h.stage));
    }
    for (const [sid, stg] of hitStructures) {
      if (stg >= 2) st.toFly.add(sid);
      else st.toShake.push({ id: sid, amp: 0.05 });
    }
  } else if (e.type === 'knock') {
    st.toFly.add(e.structure);
    st.toShake.push({ id: e.structure, amp: 0.06 });
    const x = keyX(e.cell) + 0.5, y = keyY(e.cell) * CELL_H, z = keyZ(e.cell) + 0.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      fx.play(DUST[i % 4]!, 1.4, (t, m) => {
        const ease = 1 - (1 - t) * (1 - t);
        setPlace(m, x + Math.cos(a) * 0.6 * ease, y + 0.1 + ease * 0.4, z + Math.sin(a) * 0.6 * ease, Math.max(0.01, (0.3 + ease * 0.4) * (1 - Math.max(0, t - 0.75) * 4)));
      });
    }
  }
}

function setPlace(m: Mat4, x: number, y: number, z: number, s: number): void {
  m.fill(0);
  m[0] = s;
  m[5] = s;
  m[10] = s;
  m[12] = x;
  m[13] = y;
  m[14] = z;
  m[15] = 1;
}

/** A flame's matrix: at the spot, turned to face out, leaning downwind, stretched by how fiercely it burns. */
function flameMatrix(sp: Spot, sx: number, sy: number, windX: number, windZ: number): Mat4 {
  const shear: Mat4 = [1, 0, 0, 0, windX, 1, windZ, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return compose(translation(sp.x, sp.y, sp.z), shear, rotationY(sp.rot), scaling(sx, sy, sx));
}

export default defineSystem<State>({
  id: 'mischief',
  order: 10,
  create(ctx) {
    const d = mischiefOf(ctx.stage);
    const st: State = {
      d,
      shape: null,
      flames: new Map(),
      puffs: [],
      sparks: [],
      embers: new Map(),
      bombs: new Map(),
      flashes: [],
      flights: new Map(),
      toFly: new Set(),
      shakes: [],
      toShake: [],
      spouts: [],
      pools: new Map(),
      smokeAcc: new Map(),
      lights: new Map(),
      sparkAcc: 0,
      time: 0,
      off: () => {},
    };
    st.off = d.on((e) => onEvent(st, ctx.stage, ctx.signals, e));
    return st;
  },
  sync(st, next, _prev, ctx) {
    st.shape = next.shape;
    st.d.sync(next.shape);
    // Chunks fly once the town shows the building broken (and without its heap); they land as the heap.
    for (const id of st.toFly) {
      if (settlingOf(next.shape, id)) {
        startFlight(st, ctx.stage, id);
        st.toFly.delete(id);
      }
    }
    for (const id of [...st.flights.keys()]) if (!settlingOf(next.shape, id)) endFlight(st, id);
    // Neighbours shaken by a blast wobble once they are redrawn.
    for (const s of st.toShake) {
      if (!next.shape.structures.has(s.id)) continue;
      st.shakes.push({ id: s.id, h: ctx.stage.liftStructure(s.id), age: 0, amp: s.amp });
    }
    st.toShake = [];
    // A block that is gone (erased, undone) takes its embers with it.
    for (const [cell, e] of st.embers) {
      const r = next.shape.world.blocks.get(cell)?.ruin;
      if (ruinStage(r) !== 3 || ruinCause(r) !== 'fire') {
        st.pools.get('ember')?.give(e.h);
        st.embers.delete(cell);
      }
    }
  },
  update(st, dt, signals, ctx) {
    const stage = ctx.stage;
    st.time += dt;
    const rain = (signals as unknown as { rain?: () => number }).rain?.() ?? 0;
    st.d.update(dt, { wind: (x, z) => signals.wind(x, z), rain });
    const shape = st.shape;
    if (!shape) return;
    const flamePools = [0, 1, 2].map((look) => pool(st, stage, `flame${look}`, () => flameMesh(look)));

    // ── flames ──────────────────────────────────────────────────────────
    const burning = st.d.engine.burning();
    const live = new Set<CellKey>();
    const fierce = new Map<StructureId, { i: number; x: number; y: number; z: number }>();
    for (const b of burning) {
      live.add(b.cell);
      let f = st.flames.get(b.cell);
      if (!f) {
        const spots = spotsOf(shape, b.cell);
        const seed = hash(shape.world.seed, 'flame', b.cell);
        const looks = spots.map((_, i) => Math.floor(rand(seed, 'look', i) * 3));
        f = { cell: b.cell, spots, handles: [], looks, phase: rand(seed, 'phase'), intensity: 0, frame: -1 };
        for (let i = 0; i < spots.length; i++) {
          const h = flamePools[looks[i]!]!.take();
          h.setParams(1);
          f.handles.push(h);
        }
        st.flames.set(b.cell, f);
      }
      f.intensity = b.intensity;
      if (b.structure !== undefined) {
        const top = f.spots.find((s) => s.roof) ?? f.spots[0];
        const cur = fierce.get(b.structure);
        if (top && (!cur || top.y > cur.y)) fierce.set(b.structure, { i: (cur?.i ?? 0) + b.intensity, x: top.x, y: top.y, z: top.z });
        else if (cur) cur.i += b.intensity;
      }
    }
    for (const [cell, f] of st.flames) {
      if (live.has(cell)) continue;
      f.handles.forEach((h, i) => flamePools[f.looks[i]!]!.give(h));
      st.flames.delete(cell);
      // A burnt-out block keeps glowing embers in its ash for a while.
      const r = shape.world.blocks.get(cell)?.ruin;
      const kind = shape.kinds.get(cell);
      if (ruinStage(r) >= 2 && ruinCause(r) === 'fire' && (kind === 'house' || kind === 'windmill' || kind === 'stall') && !st.embers.has(cell)) {
        const h = pool(st, stage, 'ember', emberMesh).take();
        const y = keyY(cell) * CELL_H + 0.05;
        h.setMatrix(compose(translation(keyX(cell) + 0.5, y, keyZ(cell) + 0.5), rotationY(rand(cell, 'ember') * 6)));
        h.setParams(1);
        h.setVisible(true);
        st.embers.set(cell, { h, age: 0, life: 35 + rand(cell, 'ember-life') * 20 });
      }
    }
    for (const f of st.flames.values()) {
      const frame = Math.floor(st.time * FPS + f.phase * 2);
      if (frame === f.frame) continue;
      f.frame = frame;
      f.spots.forEach((sp, i) => {
        const w = signals.wind(sp.x, sp.z);
        const j = rand(f.cell, 'jit', frame, i);
        const k = rand(f.cell, 'jit2', frame, i);
        const grow = 0.3 + 0.7 * Math.min(1, f.intensity * 1.2);
        const sy = sp.size * grow * (0.82 + 0.36 * j);
        const sx = sp.size * (0.75 + 0.25 * grow) * (0.9 + 0.2 * k);
        const lean = 0.45 * w.strength;
        const h = f.handles[i]!;
        h.setMatrix(flameMatrix(sp, sx, sy, w.dirX * lean, w.dirZ * lean));
        h.setVisible(true);
        // A flame swaps its drawing now and then (a new lick), rather than morphing.
        if (k < 0.18) {
          const look = (f.looks[i]! + 1) % 3;
          flamePools[f.looks[i]!]!.give(h);
          const nh = flamePools[look]!.take();
          nh.setParams(1);
          nh.setMatrix(flameMatrix(sp, sx, sy, w.dirX * lean, w.dirZ * lean));
          nh.setVisible(true);
          f.handles[i] = nh;
          f.looks[i] = look;
        }
      });
    }

    // ── smoke: a column per burning building, leaning with the wind ─────
    const smokeInk = [0, 1, 2].map((l) => pool(st, stage, `smoke${l}`, () => smokeMesh(false, l)));
    const smokeMist = [0, 1, 2].map((l) => pool(st, stage, `mist${l}`, () => smokeMesh(true, l)));
    for (const [sid, src] of fierce) {
      const acc = (st.smokeAcc.get(sid) ?? rand(sid, 'smoke')) + dt * (1.2 + 2.2 * Math.min(2.5, src.i)) * (LIGHT ? 0.5 : 1);
      let n = Math.floor(acc);
      st.smokeAcc.set(sid, acc - n);
      while (n-- > 0 && st.puffs.length < PUFF_CAP) {
        const look = Math.floor(rand(sid, 'look', st.time * 100) * 3);
        const p: Puff = {
          ink: smokeInk[look]!.take(),
          mist: smokeMist[look]!.take(),
          look,
          x: src.x + (rand(sid, 'px', st.time * 97) - 0.5) * 0.3,
          y: src.y + 0.5,
          z: src.z + (rand(sid, 'pz', st.time * 89) - 0.5) * 0.3,
          age: 0,
          life: 5.5 + rand(sid, 'pl', st.time * 83) * 2.5,
          size: 0.32 + 0.25 * Math.min(1, src.i),
          misted: false,
        };
        st.puffs.push(p);
      }
    }
    for (const sid of [...st.smokeAcc.keys()]) if (!fierce.has(sid)) st.smokeAcc.delete(sid);
    // Firelight: stronger as the day goes, so a fire at night lights the walls about it.
    const lightPool = pool(st, stage, 'firelight', firelightMesh);
    const dark = 1 - signals.time.light;
    for (const [sid, src] of fierce) {
      let h = st.lights.get(sid);
      if (!h) st.lights.set(sid, (h = lightPool.take()));
      const r = 1.6 + 0.7 * Math.min(2, src.i);
      h.setMatrix([r, 0, 0, 0, 0, r * 0.8, 0, 0, 0, 0, r, 0, src.x, src.y - 0.2, src.z, 1]);
      h.setParams((0.1 + 0.4 * dark) * Math.min(1, src.i) * (0.9 + 0.1 * Math.sin(st.time * 9 + sid)));
      h.setVisible(true);
    }
    for (const [sid, h] of st.lights) {
      if (fierce.has(sid)) continue;
      lightPool.give(h);
      st.lights.delete(sid);
    }
    let kept = 0;
    for (const p of st.puffs) {
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        smokeInk[p.look]!.give(p.ink);
        smokeMist[p.look]!.give(p.mist);
        continue;
      }
      st.puffs[kept++] = p;
      const w = signals.wind(p.x, p.z);
      p.y += dt * (0.75 - 0.35 * t);
      p.x += dt * w.dirX * (0.25 + 0.9 * w.strength) * Math.min(1, t * 3);
      p.z += dt * w.dirZ * (0.25 + 0.9 * w.strength) * Math.min(1, t * 3);
      const s = p.size * (1 + 2.6 * t);
      // Drawn puffs low down; past a third of the way up, a soft wash that thins to nothing.
      const misted = t > 0.32;
      if (misted && !p.misted) {
        p.misted = true;
        p.ink.setVisible(false);
        p.mist.setVisible(true);
      } else if (!misted) p.ink.setVisible(true);
      const h = misted ? p.mist : p.ink;
      // Drawn on twos.
      if (Math.floor(st.time * FPS) !== Math.floor((st.time - dt) * FPS) || p.age === dt) {
        h.setMatrix([s, 0, 0, 0, 0, s * 0.9, 0, 0, 0, 0, s, 0, p.x, p.y, p.z, 1]);
        if (misted) h.setParams(0.75 * (1 - (t - 0.32) / 0.68) ** 1.3);
      }
    }
    st.puffs.length = kept;

    // ── sparks ──────────────────────────────────────────────────────────
    const sparkPool = pool(st, stage, 'spark', sparkMesh);
    for (const f of st.flames.values()) {
      for (const sp of f.spots) {
        if (!sp.roof) continue;
        if (rand(f.cell, 'spark', Math.floor(st.time * 30)) > dt * 6 * f.intensity) continue;
        if (st.sparks.length >= SPARK_CAP) break;
        const h = sparkPool.take();
        h.setParams(1);
        const a = rand(f.cell, 'sa', st.time) * Math.PI * 2;
        st.sparks.push({ h, x: sp.x, y: sp.y + 0.4, z: sp.z, vx: Math.cos(a) * 0.25, vy: 0.9 + rand(f.cell, 'sv', st.time) * 0.8, vz: Math.sin(a) * 0.25, age: 0, life: 1 + rand(f.cell, 'sl', st.time) * 1.2 });
      }
    }
    kept = 0;
    for (const s of st.sparks) {
      s.age += dt;
      if (s.age >= s.life) {
        sparkPool.give(s.h);
        continue;
      }
      st.sparks[kept++] = s;
      const w = signals.wind(s.x, s.z);
      s.vx += w.dirX * w.strength * dt * 0.8 + Math.sin(st.time * 7 + s.life * 9) * dt * 0.6;
      s.vz += w.dirZ * w.strength * dt * 0.8;
      s.vy -= dt * 0.25;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const k = 0.07 * (1 - (s.age / s.life) * 0.7);
      s.h.setMatrix([k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, s.x, s.y, s.z, 1]);
      s.h.setVisible(true);
    }

    // ── embers dying down ───────────────────────────────────────────────
    for (const [cell, e] of st.embers) {
      e.age += dt;
      const t = e.age / e.life;
      if (t >= 1) {
        pool(st, stage, 'ember', emberMesh).give(e.h);
        st.embers.delete(cell);
        continue;
      }
      // Glow pulses gently and fades; the specks stay (they are ash).
      e.h.setParams((1 - t) * (0.75 + 0.25 * Math.sin(st.time * 3 + cell)));
    }

    // ── bombs: falling, landing, fizzing ────────────────────────────────
    for (const [id, draw] of st.bombs) {
      if (st.d.bombs.some((b) => b.id === id)) continue;
      // Taken back (undo) before it went off.
      draw.h.release();
      st.bombs.delete(id);
    }
    for (const b of st.d.bombs) {
      const draw = st.bombs.get(b.id);
      if (!draw) continue;
      const [x, y, z] = b.point;
      let m: Mat4;
      if (b.age < b.fall) {
        const t = b.age / b.fall;
        m = compose(translation(x, y + 6 * (1 - t * t), z), rotationY(t * 3));
      } else {
        const t = b.age - b.fall;
        // A bounce and a squash on landing, then a nervous wobble that grows as the fuse burns down.
        const bounce = Math.max(0, Math.sin(Math.min(1, t / 0.35) * Math.PI)) * 0.12 * Math.max(0, 1 - t / 0.35);
        const squash = t < 0.12 ? 1 - 0.25 * Math.sin((t / 0.12) * Math.PI) : 1;
        const wob = Math.sin(t * 30) * 0.04 * Math.min(1, t / 1.5);
        m = compose(translation(x, y + bounce, z), rotationY(3), [1, 0, 0, 0, wob, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], scaling(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash)));
        draw.sparkIn -= dt;
        if (draw.sparkIn <= 0 && st.sparks.length < SPARK_CAP + 20) {
          draw.sparkIn = 0.04;
          const tip = multiply(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, FUSE_TIP[0], FUSE_TIP[1] * (1 - 0.6 * Math.min(1, t / 1.8)), FUSE_TIP[2], 1]);
          const h = sparkPool.take();
          h.setParams(1);
          const a = rand(b.id, 'fs', st.time) * Math.PI * 2;
          st.sparks.push({ h, x: tip[12]!, y: tip[13]!, z: tip[14]!, vx: Math.cos(a) * 0.6, vy: 0.5 + rand(b.id, 'fv', st.time), vz: Math.sin(a) * 0.6, age: 0, life: 0.35 });
        }
      }
      draw.h.setMatrix(m);
      draw.h.setVisible(true);
    }

    // ── the flash ───────────────────────────────────────────────────────
    kept = 0;
    for (const f of st.flashes) {
      f.age += dt;
      if (f.age > 0.55) {
        f.h.release();
        continue;
      }
      st.flashes[kept++] = f;
      const t = f.age / 0.55;
      // On twos, like a drawn burst: big at once, a second bigger drawing, then it breaks up.
      const tt = Math.floor(t * 0.55 * FPS) / (0.55 * FPS);
      const s = (1.4 + 1.4 * Math.min(1, tt * 2.5)) * f.power * (tt > 0.6 ? Math.max(0.05, 1 - (tt - 0.6) / 0.4) : 1);
      f.h.setMatrix(compose(translation(f.x, f.y, f.z), rotationY(t * 0.8), scaling(Math.max(0.01, s))));
      f.h.setParams(1);
      f.h.setVisible(true);
    }
    st.flashes.length = kept;

    // ── spouts ──────────────────────────────────────────────────────────
    kept = 0;
    for (const s of st.spouts) {
      s.age += dt;
      if (s.age > 1.6) {
        s.h.release();
        continue;
      }
      st.spouts[kept++] = s;
      const t = s.age / 1.6;
      const hgt = 2.2 * Math.sin(Math.min(1, t * 1.4) * Math.PI);
      s.h.setMatrix(compose(translation(s.x, SEA_Y - 0.05, s.z), scaling(0.6 + t * 0.6, Math.max(0.01, hgt), 0.6 + t * 0.6)));
      s.h.setVisible(true);
    }
    st.spouts.length = kept;

    // ── chunks in the air ───────────────────────────────────────────────
    for (const f of st.flights.values()) {
      f.age += dt;
      f.chunks.forEach((ch, i) => {
        const arc = f.arcs[i]!;
        const t = Math.max(0, Math.min(1, (f.age - arc.delay) / arc.dur));
        let m: Mat4;
        if (ch.topple) {
          // Falling over: slow at first, fast at the end, a little bounce.
          const e = t * t;
          const bounce = t >= 1 ? 0 : 0;
          m = chunkMatrix(ch, ch.tip * e + bounce, 0, ch.to);
        } else {
          const at: [number, number, number] = [
            ch.from[0] + (ch.to[0] - ch.from[0]) * t,
            ch.from[1] + (ch.to[1] - ch.from[1]) * t + arc.h * 4 * t * (1 - t),
            ch.from[2] + (ch.to[2] - ch.from[2]) * t,
          ];
          const ease = 1 - (1 - t) ** 2;
          m = chunkMatrix(ch, ch.tip * ease + arc.spin * ease, ch.yaw * ease, at);
          // The rest pose's tip and yaw are reached exactly at t = 1 (spin is whole turns).
          if (t >= 1) m = chunkMatrix(ch, ch.tip, ch.yaw, ch.to);
        }
        f.handles[i]!.setMatrix(m);
        f.handles[i]!.setVisible(true);
      });
    }

    // ── shaken neighbours ───────────────────────────────────────────────
    kept = 0;
    for (const s of st.shakes) {
      s.age += dt;
      if (!s.h || s.age > 0.7) {
        s.h?.release();
        continue;
      }
      st.shakes[kept++] = s;
      const k = s.amp * (1 - s.age / 0.7) * Math.sin(s.age * 45);
      s.h.setMatrix(multiply(translation(k, 0, k * 0.6), s.h.base));
    }
    st.shakes.length = kept;
  },
  dispose(st) {
    st.off();
    st.d.detach();
    for (const f of st.flames.values()) for (const h of f.handles) h.release();
    for (const p of st.puffs) {
      p.ink.release();
      p.mist.release();
    }
    for (const sp of st.sparks) sp.h.release();
    for (const e of st.embers.values()) e.h.release();
    for (const h of st.lights.values()) h.release();
    for (const f of st.flights.values()) for (const h of f.handles) h.release();
    for (const b of st.bombs.values()) b.h.release();
    for (const f of st.flashes) f.h.release();
    for (const s of st.spouts) s.h.release();
    for (const s of st.shakes) s.h?.release();
    for (const p of st.pools.values()) p.dispose();
  },
});
