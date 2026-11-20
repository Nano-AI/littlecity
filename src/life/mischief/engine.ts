// The mischief engine (design section 13b, "Built as"): a seeded, fixed-step
// simulation of fire, blasts, knocks and repairs, with no people and no
// drawing in it. Owner: Mischief.
//
// It reads the town (`sync`) and answers with ordinary edits (`takeEdits`):
// setRuin as things scorch, burn, crack and fall, repair as they are mended.
// The app applies them through the same path as the player's, batched so
// that one act of mischief is one undo step. Flames, heat, smoke and chunks
// in the air are never saved: only the damage they leave is.
//
//   ignite(cell)                  set a block alight
//   blast([x, y, z], power)       a bang: rubble, wrecks, cracks, maybe fire
//   applyDamage(cell, cause, n)   knock a block n stages worse
//   repair(cell, n | 'all')       mend it n stages (scaffolding first), or at once
//   douse(cell, amount)           water on a fire (bucket chains, a spout, rain)
//   step(dt, env)                 advance; any dt, run in fixed steps
//
// Same town, same calls at the same steps, same seed: the same fire.

import { CELL_H, columnIndex, DIR4, edgeOf, inColumnBounds, key, keyX, keyY, keyZ, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import { rand } from '@/core/rand';
import type { Edit, World } from '@/core/world';
import type { ShapePlan, StructureId } from '@/resolve/plan';
import { structureStyle } from '@/resolve/structures';
import { BLAST, FIRE } from '@/style/damage';
import { MEND_STEPS, packRuin, ruinCause, ruinMending, ruinSettling, ruinStage, unpackRuin, type DamageCause, type DamageStage } from '@/world/damage';

/** Fixed simulation step, seconds. */
export const STEP = 0.1;

/** How readily each kind of block catches and burns (0 = never). */
const CATCH: Record<Kind, number> = {
  house: 0.7,
  windmill: 0.9,
  stall: 1,
  fence: 0.95,
  tree: 0.85,
  dock: 0.55,
  arch: 0.04,
  stairs: 0.05,
  tower: 0.08,
  lighthouse: 0.08,
  marble: 0.02,
  pillar: 0.02,
  wall: 0.02,
  fountain: 0,
};
/** Kinds that only ever scorch. */
const STONE = new Set<Kind>(['arch', 'stairs', 'tower', 'lighthouse', 'marble', 'pillar', 'wall', 'fountain']);
/** House styles (style.houses) built of timber and thatch burn like kindling; stone-faced ones less. */
const STYLE_CATCH: Record<number, number> = { 1: 0.65, 2: 1, 3: 1, 4: 0.55, 5: 0.95, 6: 0.5 };

interface Fire {
  cell: CellKey;
  heat: number;
  burning: boolean;
  intensity: number;
  /** Fuel burnt, 0–1. */
  burnt: number;
  /** Seconds since it caught. */
  age: number;
  /** Burnt out, or put out: it will not catch again in this act. */
  done: boolean;
}

export interface Burning {
  cell: CellKey;
  structure: StructureId | undefined;
  /** 0–1: how fiercely. */
  intensity: number;
  /** Fuel burnt so far, 0–1. */
  burnt: number;
}

export interface BlastEvent {
  point: [number, number, number];
  power: number;
  /** In water: a spout, no damage, fires near it soaked. */
  water: boolean;
  /** Blocks that took damage, with their new stage. */
  hit: { cell: CellKey; stage: DamageStage }[];
  /** Blocks that caught fire from it. */
  lit: CellKey[];
}

/** One block's part in a blast, decided at the bang and done when the shockwave reaches it. */
export interface Hit {
  cell: CellKey;
  /** Distance from the blast, cells. */
  d: number;
  stage: DamageStage;
  /** Its chunks fly (near the middle). */
  fly: boolean;
  /** For a tree: falls away from the blast (1–4 = N, E, S, W + 1), else 0. */
  fall: number;
  /** It catches fire. */
  light: boolean;
}

export interface Env {
  wind(x: number, z: number): { dirX: number; dirZ: number; strength: number };
  /** 0–1: rain (when weather exists). */
  rain?: number;
}

export interface MischiefEngine {
  /** The town changed (or first appeared). */
  sync(shape: ShapePlan): void;
  ignite(cell: CellKey): boolean;
  /**
   * A bang. `fly`: blocks further than this from the point change state without chunks in the air (a
   * big blast flies only what is near its middle). `rim`: fires start round the edge rather than near.
   */
  blast(point: readonly [number, number, number], power?: number, opts?: { fly?: number; rim?: boolean }): BlastEvent;
  /** The same blast, decided but not done: every block's hit, nearest first (a shockwave does them as it passes). */
  /** `wet`: a landing in water still hits what stands round it (the nuke); without it a water landing plans nothing (a bomb's spout). */
  blastPlan(point: readonly [number, number, number], power?: number, opts?: { fly?: number; rim?: boolean; wet?: boolean }): { water: boolean; hits: Hit[] };
  /** Does one planned hit. True if the block was damaged. */
  hit(h: Hit): boolean;
  applyDamage(cell: CellKey, cause: DamageCause, amount?: number): boolean;
  repair(cell: CellKey, amount?: number | 'all'): boolean;
  douse(cell: CellKey, amount: number): void;
  step(dt: number, env: Env): void;
  /** The edits since the last call, one per changed block, in cell order. */
  takeEdits(): Edit[];
  /** Something is burning, or chunks are still in the air. */
  readonly busy: boolean;
  burning(): Burning[];
  /** Fires out and forgotten, nothing pending: undo is taking it all back. */
  cancel(): void;
  /** Simulation steps so far. */
  readonly tick: number;
  /** Seconds since this block was last hurt (by fire or blast), Infinity if never in this session. */
  sinceHit(cell: CellKey): number;
}

export function createMischiefEngine(seed: number): MischiefEngine {
  let shape: ShapePlan | null = null;
  let world: World | null = null;
  const fires = new Map<CellKey, Fire>();
  /** Ruin values decided but not yet taken as edits (and so not yet in the world). */
  const pending = new Map<CellKey, number>();
  /** Blocks whose chunks are in the air, and the tick they land. */
  const settling = new Map<CellKey, number>();
  let tick = 0;
  let acc = 0;

  const ruinOf = (cell: CellKey): number => pending.get(cell) ?? world?.blocks.get(cell)?.ruin ?? 0;
  const setRuin = (cell: CellKey, ruin: number): void => {
    if (!world?.blocks.has(cell)) return;
    if ((world.blocks.get(cell)!.ruin ?? 0) === ruin) pending.delete(cell);
    else pending.set(cell, ruin);
  };
  const kindOf = (cell: CellKey): Kind | undefined => shape?.kinds.get(cell);
  const catchOf = (cell: CellKey): number => {
    const k = kindOf(cell);
    if (!k) return 0;
    if (k === 'house' && shape) {
      const sid = shape.structureAt.get(cell);
      const s = sid === undefined ? undefined : shape.structures.get(sid);
      const style = s ? structureStyle(shape.world, s) : 0;
      return STYLE_CATCH[style] ?? CATCH.house;
    }
    return CATCH[k] ?? 0;
  };
  const stoneAt = (cell: CellKey): boolean => {
    const k = kindOf(cell);
    return k !== undefined && STONE.has(k);
  };

  /** Raises a block's damage to at least `stage` (never lowers it); new damage takes down any scaffolding. */
  /** The step each block was last hurt at. */
  const hitAt = new Map<CellKey, number>();
  const worsen = (cell: CellKey, cause: DamageCause, stage: DamageStage, settle = false, fall = 0): boolean => {
    hitAt.set(cell, tick);
    const now = ruinOf(cell);
    const cur = ruinStage(now);
    if (stage <= cur && !(ruinMending(now) && stage > 0)) return false;
    const s = Math.max(stage, cur) as DamageStage;
    const keepCause = stage <= cur ? ruinCause(now) : cause;
    setRuin(cell, packRuin({ stage: s, cause: keepCause, settling: settle || ruinSettling(now), fall }));
    if (settle) settling.set(cell, tick + Math.round(BLAST.settle / STEP));
    return true;
  };

  /** A destroyed block brings down what stands on it in the same building. */
  const collapse = (cell: CellKey, cause: DamageCause, settle: boolean): void => {
    if (!shape) return;
    const sid = shape.structureAt.get(cell);
    for (let y = keyY(cell) + 1; ; y++) {
      const up = key(keyX(cell), y, keyZ(cell));
      if (y >= 32 || shape.structureAt.get(up) !== sid || sid === undefined) break;
      worsen(up, cause, 3, settle);
    }
  };

  const fireAt = (cell: CellKey): Fire => {
    let f = fires.get(cell);
    if (!f) fires.set(cell, (f = { cell, heat: 0, burning: false, intensity: 0, burnt: 0, age: 0, done: false }));
    return f;
  };

  const light = (cell: CellKey): boolean => {
    if (!world?.blocks.has(cell)) return false;
    const c = catchOf(cell);
    if (c <= 0) return false;
    const f = fireAt(cell);
    if (f.burning || f.done) return false;
    // A block already burnt out has nothing left to burn.
    const ruin = ruinOf(cell);
    if (ruinStage(ruin) === 3 && ruinCause(ruin) === 'fire') return false;
    f.burning = true;
    f.heat = 1;
    f.intensity = Math.max(f.intensity, 0.18);
    f.age = 0;
    // A block that was already scorched has less left in it.
    f.burnt = Math.max(f.burnt, ruinCause(ruin) === 'fire' ? [0, FIRE.scorchedAt, FIRE.halfAt, FIRE.outAt][ruinStage(ruin)]! : 0);
    if (ruinMending(ruin)) setRuin(cell, packRuin({ stage: Math.max(1, ruinStage(ruin)) as DamageStage, cause: 'fire' }));
    return true;
  };

  /** Is there a wall (edge piece) or a stone block between two side-by-side or nearly side-by-side cells? */
  const blocked = (a: CellKey, b: CellKey): boolean => {
    if (!world) return false;
    const ax = keyX(a), az = keyZ(a), bx = keyX(b), bz = keyZ(b);
    const dx = bx - ax, dz = bz - az;
    if (Math.abs(dx) + Math.abs(dz) === 1) {
      const d = DIR4.findIndex(([x, z]) => x === dx && z === dz) as Dir4;
      for (const y of [keyY(a), keyY(b)]) {
        const e = edgeOf(key(ax, y, az), d);
        if (e !== NO_CELL && world.edges.get(e) === 'wall') return true;
      }
      return false;
    }
    // Further apart: a stone block or a wall piece in the cell between stops it.
    const mx = ax + Math.round(dx / 2), mz = az + Math.round(dz / 2);
    if ((mx === ax && mz === az) || (mx === bx && mz === bz)) return false;
    const mid = key(mx, keyY(a), mz);
    return stoneAt(mid) || blocked(a, mid);
  };

  const spread = (f: Fire, env: Env, dt: number): void => {
    if (!shape || !world) return;
    const c = f.cell;
    const x = keyX(c), y = keyY(c), z = keyZ(c);
    const sid = shape.structureAt.get(c);
    const wind = env.wind(x + 0.5, z + 0.5);
    const r = Math.ceil(FIRE.reach + FIRE.windReach * wind.strength);
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && dz === 0 && dy === 0) continue;
          const tx = x + dx, ty = y + dy, tz = z + dz;
          if (!inColumnBounds(tx, tz) || ty < 0 || ty >= 32) continue;
          const t = key(tx, ty, tz);
          if (!world.blocks.has(t)) continue;
          const catchT = catchOf(t);
          if (catchT <= 0) continue;
          const other = fires.get(t);
          if (other?.burning || other?.done) continue;
          let rate: number;
          const same = sid !== undefined && shape.structureAt.get(t) === sid;
          const d = Math.hypot(dx, dz);
          if (same && dx === 0 && dz === 0) rate = dy > 0 ? (dy === 1 ? FIRE.climb : 0) : FIRE.within * 0.3;
          else if (same && d <= 1 && dy === 0) rate = FIRE.within;
          else if (same && d <= 1) rate = FIRE.within * 0.4;
          else {
            if (dy > 1 || dy < -1) continue;
            // Downwind it reaches further and catches faster; upwind, hardly at all.
            const cos = d > 0 ? (dx * wind.dirX + dz * wind.dirZ) / d : 0;
            const along = Math.max(0, cos) * wind.strength;
            const limit = FIRE.reach + FIRE.windReach * along;
            if (d > limit) continue;
            const fall = d <= 1 ? 1 : Math.max(0, 1 - (d - 1) / Math.max(0.05, limit - 1 + 0.35));
            rate = FIRE.across * fall * (1 + 1.6 * along - 0.6 * Math.max(0, -cos) * wind.strength) * (dy === 0 ? 1 : 0.6);
            if (rate <= 0) continue;
            if (blocked(c, t)) continue;
          }
          const g = other ?? fireAt(t);
          g.heat += rate * f.intensity * catchT * dt;
        }
      }
    }
  };

  const stageFor = (burnt: number): DamageStage =>
    burnt >= FIRE.outAt ? 3 : burnt >= FIRE.halfAt ? 2 : burnt >= FIRE.scorchedAt ? 1 : 0;

  const fixedStep = (env: Env): void => {
    const dt = STEP;
    tick++;
    // Land what is in the air.
    for (const [cell, at] of settling) {
      if (tick < at) continue;
      settling.delete(cell);
      const r = ruinOf(cell);
      if (ruinSettling(r)) setRuin(cell, r & ~16);
    }
    const list = [...fires.values()];
    // Heat first (from this step's fires), then burning.
    for (const f of list) if (f.burning) spread(f, env, dt);
    for (const f of list) {
      if (!f.burning) {
        if (f.done) continue;
        if (f.heat >= 1) {
          light(f.cell);
          continue;
        }
        f.heat = Math.max(0, f.heat - FIRE.cool * dt);
        if (f.heat === 0) fires.delete(f.cell);
        continue;
      }
      f.age += dt;
      const c = catchOf(f.cell);
      const stone = stoneAt(f.cell);
      const cap = stone ? FIRE.scorchedAt + 0.04 : 1;
      const target = stone ? 0.35 : f.burnt < 0.7 ? 1 : Math.max(0, (1 - f.burnt) / 0.3);
      f.intensity += (target - f.intensity) * Math.min(1, FIRE.growth * (0.4 + c) * dt * (target > f.intensity ? 1 : 2.5));
      f.intensity -= (env.rain ?? 0) * FIRE.rain * dt;
      f.burnt = Math.min(cap, f.burnt + FIRE.burn * Math.max(0, f.intensity) * (0.6 + 0.6 * c) * dt);
      const stage = stageFor(f.burnt);
      if (stage > 0 && worsen(f.cell, 'fire', stage) && stage === 3) collapse(f.cell, 'fire', false);
      if (f.intensity <= 0.02 && f.age > 1) {
        f.burning = false;
        f.intensity = 0;
        f.done = true;
      }
      if (stone && f.burnt >= cap) {
        f.burning = false;
        f.intensity = 0;
        f.done = true;
      }
    }
  };

  const engine: MischiefEngine = {
    sync(next) {
      shape = next;
      world = next.world;
      // Pending values the world now holds are done; blocks that are gone take their fires along.
      for (const [cell, v] of pending) if ((world.blocks.get(cell)?.ruin ?? 0) === v || !world.blocks.has(cell)) pending.delete(cell);
      for (const cell of fires.keys()) if (!world.blocks.has(cell)) fires.delete(cell);
    },
    ignite(cell) {
      return light(cell);
    },
    blast(point, power = 1, opts = {}) {
      const ev: BlastEvent = { point: [point[0], point[1], point[2]], power, water: false, hit: [], lit: [] };
      if (!world || !shape) return ev;
      const px = Math.floor(point[0]), pz = Math.floor(point[2]);
      const groundH = inColumnBounds(px, pz) ? shape.terrain.height[columnIndex(px, pz)]! : 0;
      const atCell = key(px, Math.max(0, Math.floor(point[1] / CELL_H)), pz);
      ev.water = groundH === 0 && !world.blocks.has(atCell) && !world.blocks.has(key(px, 0, pz));
      const shake = BLAST.shake * power;
      const r = Math.ceil(shake) + 1;
      const cells: { cell: CellKey; d: number }[] = [];
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const x = px + dx, z = pz + dz;
        if (!inColumnBounds(x, z)) continue;
        for (let y = 0; y < 32; y++) {
          const c = key(x, y, z);
          if (!world.blocks.has(c)) continue;
          const d = Math.hypot(x + 0.5 - point[0], (y + 0.5) * CELL_H - point[1], z + 0.5 - point[2]);
          if (d <= shake) cells.push({ cell: c, d });
        }
      }
      cells.sort((a, b) => a.cell - b.cell);
      if (ev.water) {
        // A spout: everything near gets soaked, nothing breaks.
        for (const { cell } of cells) engine.douse(cell, 1);
        return ev;
      }
      for (const { cell, d } of cells) {
        const k = stoneAt(cell) ? BLAST.stone : 1;
        const stage: DamageStage = d <= BLAST.rubble * power * k ? 3 : d <= BLAST.wreck * power * k ? 2 : 1;
        const fly = stage >= 2 && d <= (opts.fly ?? Infinity);
        if (worsen(cell, 'blast', stage, fly)) {
          ev.hit.push({ cell, stage });
          if (stage === 3) collapse(cell, 'blast', fly);
        }
        // A blast puts out what it flattens.
        const f = fires.get(cell);
        if (f && stage === 3) {
          f.burning = false;
          f.done = true;
          f.intensity = 0;
        }
      }
      for (const { cell, d } of cells) {
        if (opts.rim && (d < BLAST.rubble * power || d > BLAST.wreck * power * 1.15)) continue;
        if (!opts.rim && d > BLAST.ignite * power) continue;
        if (catchOf(cell) < 0.5 || ruinStage(ruinOf(cell)) >= 3) continue;
        if (rand(seed, 'blast-fire', cell, tick) < BLAST.igniteChance && light(cell)) ev.lit.push(cell);
      }
      return ev;
    },
    blastPlan(point, power = 1, opts = {}) {
      const out: { water: boolean; hits: Hit[] } = { water: false, hits: [] };
      if (!world || !shape) return out;
      const px = Math.floor(point[0]), pz = Math.floor(point[2]);
      const groundH = inColumnBounds(px, pz) ? shape.terrain.height[columnIndex(px, pz)]! : 0;
      const atCell = key(px, Math.max(0, Math.floor(point[1] / CELL_H)), pz);
      out.water = groundH === 0 && !world.blocks.has(atCell) && !world.blocks.has(key(px, 0, pz));
      if (out.water && !opts.wet) return out;
      const shake = BLAST.shake * power;
      const r = Math.ceil(shake) + 1;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const x = px + dx, z = pz + dz;
        if (!inColumnBounds(x, z)) continue;
        for (let y = 0; y < 32; y++) {
          const cell = key(x, y, z);
          if (!world.blocks.has(cell)) continue;
          const ox = x + 0.5 - point[0], oz = z + 0.5 - point[2];
          const d = Math.hypot(ox, (y + 0.5) * CELL_H - point[1], oz);
          if (d > shake) continue;
          const k = stoneAt(cell) ? BLAST.stone : 1;
          const stage: DamageStage = d <= BLAST.rubble * power * k ? 3 : d <= BLAST.wreck * power * k ? 2 : 1;
          const fall = kindOf(cell) === 'tree' ? (Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 2 : 4) : oz > 0 ? 3 : 1) : 0;
          const inRim = opts.rim ? d >= BLAST.rubble * power && d <= BLAST.wreck * power * 1.15 : d <= BLAST.ignite * power;
          const light = inRim && catchOf(cell) >= 0.5 && stage < 3 && rand(seed, 'blast-fire', cell, tick) < BLAST.igniteChance;
          out.hits.push({ cell, d, stage, fly: stage >= 2 && d <= (opts.fly ?? Infinity), fall, light });
        }
      }
      out.hits.sort((a, b) => a.d - b.d || a.cell - b.cell);
      return out;
    },
    hit(h) {
      if (!world?.blocks.has(h.cell)) return false;
      const done = worsen(h.cell, 'blast', h.stage, h.fly, h.fall);
      if (done && h.stage === 3) collapse(h.cell, 'blast', h.fly);
      const f = fires.get(h.cell);
      if (f && h.stage === 3) {
        f.burning = false;
        f.done = true;
        f.intensity = 0;
      }
      if (h.light) light(h.cell);
      return done;
    },
    applyDamage(cell, cause, amount = 1) {
      if (!world?.blocks.has(cell)) return false;
      const now = ruinOf(cell);
      const cur = ruinMending(now) ? 0 : ruinStage(now);
      const cap = cause === 'fire' && stoneAt(cell) ? 1 : 3;
      const stage = Math.min(cap, cur + amount) as DamageStage;
      const done = worsen(cell, cause, stage, cause === 'blast' && stage >= 2);
      if (done && stage === 3) collapse(cell, cause, cause === 'blast');
      return done;
    },
    repair(cell, amount = 1) {
      if (!world?.blocks.has(cell)) return false;
      const f = fires.get(cell);
      if (f?.burning) {
        f.burning = false;
        f.done = true;
        f.intensity = 0;
      }
      const now = ruinOf(cell);
      if (!now) return false;
      settling.delete(cell);
      if (amount === 'all') {
        setRuin(cell, 0);
        return true;
      }
      // Mending goes in MEND_STEPS steps (the first puts the scaffolding up); the step after the last makes it sound.
      const d = unpackRuin(now);
      const progress = d.mending ? d.progress + amount : amount - 1;
      if (progress >= MEND_STEPS) {
        setRuin(cell, 0);
        return true;
      }
      setRuin(cell, packRuin({ ...d, stage: d.stage, mending: true, settling: false, progress }));
      return true;
    },
    douse(cell, amount) {
      const f = fires.get(cell);
      if (!f) return;
      if (f.burning) {
        f.intensity -= amount;
        if (f.intensity <= 0.02) {
          f.burning = false;
          f.intensity = 0;
          f.done = true;
        }
      } else f.heat = Math.max(0, f.heat - amount);
    },
    step(dt, env) {
      acc += dt;
      while (acc >= STEP - 1e-9) {
        acc -= STEP;
        fixedStep(env);
      }
    },
    takeEdits() {
      if (!world) return [];
      const out: Edit[] = [];
      for (const cell of [...pending.keys()].sort((a, b) => a - b)) {
        const v = pending.get(cell)!;
        const b = world.blocks.get(cell);
        if (!b || (b.ruin ?? 0) === v) continue;
        out.push(v === 0 ? { type: 'repair', cell } : { type: 'setRuin', cell, ruin: v });
      }
      return out;
    },
    get busy() {
      if (settling.size > 0) return true;
      for (const f of fires.values()) if (f.burning) return true;
      return false;
    },
    burning() {
      const out: Burning[] = [];
      for (const f of fires.values()) {
        if (!f.burning) continue;
        out.push({ cell: f.cell, structure: shape?.structureAt.get(f.cell), intensity: f.intensity, burnt: f.burnt });
      }
      return out;
    },
    sinceHit(cell) {
      const at = hitAt.get(cell);
      const f = fires.get(cell);
      if (f?.burning) return 0;
      return at === undefined ? Infinity : (tick - at) * STEP;
    },
    cancel() {
      hitAt.clear();
      fires.clear();
      pending.clear();
      settling.clear();
      acc = 0;
    },
    get tick() {
      return tick;
    },
  };
  return engine;
}
