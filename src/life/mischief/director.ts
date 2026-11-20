// The mischief director (design section 13b): one per stage, shared by the
// interface (which tools call), the app (which applies its edits to the
// game) and the mischief system (which steps the engine and draws it).
// Owner: Mischief.
//
//   const m = mischiefOf(view.stage);
//   m.connect({ begin, apply, end, abort, edit });   // the app: how edits reach the game
//   m.ignite(cell); m.dropBomb(point); m.knock(cell); m.mend(cell, all)
//   m.flush();                                       // the app, once a frame after life.update
//   m.cancel();                                      // undo in the middle of it
//
// An "act" is everything one click of mischief causes: it opens a batch in
// the game on the click and closes it when the town is quiet again (no
// flames, no fuse, nothing in the air), so one act is one undo step. Undo in
// the middle cancels the act: the fire is out, the bomb gone, and the game
// puts back the town as it was before the click.

import type { CellKey } from '@/core/grid';
import type { Edit } from '@/core/world';
import type { ShapePlan, StructureId } from '@/resolve/plan';
import { BLAST } from '@/style/damage';
import { MEND_STEPS } from '@/world/damage';
import { rand } from '@/core/rand';

/** The town mending itself: seconds of quiet after a building was hurt, a spread on top, seconds a step, a crew's speed. */
export const MEND = { quiet: 6, stagger: 4, step: 2.8, crew: 2.2 };

/** The nuke: its fall and fuse (seconds), its power against a bomb's, how near the middle chunks fly, the crater's radius. */
export const NUKE = { fall: 2.4, fuse: 1.1, power: 7, fly: 2.2, crater: 2.6 };

/** A click of the Mend tool: a quarter of the way. */
const MEND_CLICK = MEND_STEPS / 4;
import type { LifeStage } from '../api';
import type { Brigade, PumpCart } from './response';
import { createMischiefEngine, type BlastEvent, type Env, type Hit, type MischiefEngine } from './engine';
import { NUKE_TIME, waveRadius } from './nuke-timing';
import { mischiefDrawn } from './owned';
import { harbourOf } from '../ships/visit';
import { boatNear } from './boatwreck';

/** Seconds between the batches of hits a shockwave does on its way out. */
const WAVE_BATCH = 0.2;

export interface MischiefHost {
  /** Opens a batch: what follows is one undo step. */
  begin(): void;
  /** Applies edits inside the open batch. */
  apply(edits: readonly Edit[]): void;
  /** Closes the batch. */
  end(): void;
  /** Closes the batch without keeping it: the town as it was. */
  abort(): void;
  /** Applies edits as one undo step of their own (a mend outside an act). */
  edit(edits: readonly Edit[]): void;
  /** Applies edits without an undo step of their own (the town mending itself: undo goes back past the damage). */
  amend(edits: readonly Edit[]): void;
}

/**
 * The Lightning tool's strike (the owner: "it summons a little storm cloud and then strikes it with
 * lightning"): a cloud gathers over the building, the bolt comes down at `STRIKE.at` seconds and the block
 * catches then (if it can; a stone one only flashes), and the cloud thins and drifts off.
 */
export interface Strike {
  id: number;
  cell: CellKey;
  /** Where the bolt lands (where the building was clicked). */
  point: [number, number, number];
  age: number;
  /** It will catch. */
  ok: boolean;
  /** The bolt has come down. */
  struck: boolean;
}

/** The strike's clock: the cloud gathers, the bolt at `at`, the cloud gone by `gone` (seconds from the click). */
export const STRIKE = { at: 0.6, flash: 0.22, bolt: 0.28, linger: 1.4, gone: 4.2, height: 3.2 } as const;

export interface Bomb {
  id: number;
  point: [number, number, number];
  /** Seconds since it was dropped. */
  age: number;
  /** Seconds it falls before it lands. */
  fall: number;
  /** The big one (design section 13b, the owner's nuke): a far bigger blast, a mushroom cloud, a crater. */
  nuke?: boolean;
}

export type MischiefEvent =
  | { type: 'lit'; cell: CellKey }
  | { type: 'drop'; bomb: Bomb }
  /** A storm cloud gathering over a building (the bolt comes down STRIKE.at later). */
  | { type: 'cloud'; strike: Strike }
  /** The bolt comes down (the building catches now, if it can). */
  | { type: 'strike'; strike: Strike }
  | { type: 'blast'; bomb: number; blast: BlastEvent; nuke?: boolean }
  | { type: 'knock'; structure: StructureId; cell: CellKey }
  | { type: 'mend'; structure: StructureId; cell: CellKey }
  /** Everything going on was called off (undo mid-act, or a different town): drop whatever is still showing. */
  | { type: 'reset' }
  /** The player pressed undo (after any act was over): a show tied to nothing in the town (a nuke over the sea) ends. */
  | { type: 'undo' };

export class Director {
  readonly engine: MischiefEngine;
  /** The stage it was made for (by mischiefOf). */
  stage: LifeStage | null = null;
  private host: MischiefHost | null = null;
  private shape: ShapePlan | null = null;
  private act = false;
  readonly bombs: Bomb[] = [];
  private nextBomb = 1;
  private listeners: ((e: MischiefEvent) => void)[] = [];
  /** The fire brigades at work (set by the fire chain, src/life/mischief/response.ts; drawn by brigade.system.ts). */
  brigades: ReadonlyMap<StructureId, Brigade> | null = null;
  /** The town's pump cart (set by the fire chain; drawn by brigade.system.ts), or null if it has none. */
  pump: PumpCart | null = null;
  /** The town mends its own damage when things are quiet (the menu's Rebuild switch). */
  rebuild = true;
  /** Where the reader looks from (degrees; the app sets it each frame): flames are drawn turned toward them. */
  camera = { yaw: 45, pitch: 35 };

  constructor(seed: number) {
    this.engine = createMischiefEngine(seed);
  }

  connect(host: MischiefHost | null): void {
    this.host = host;
  }

  /** Something is happening (an act is open): undo cancels it. */
  get active(): boolean {
    return this.act;
  }

  /** Burning, a fuse fizzing, or chunks in the air. */
  get busy(): boolean {
    return this.engine.busy || this.bombs.length > 0 || this.waves.length > 0 || this.strikes.length > 0;
  }

  on(fn: (e: MischiefEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  private emit(e: MischiefEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  sync(shape: ShapePlan): void {
    this.shape = shape;
    this.engine.sync(shape);
  }

  get town(): ShapePlan | null {
    return this.shape;
  }

  private open(): void {
    if (this.act) return;
    this.act = true;
    this.host?.begin();
  }

  /** The cells of the structure in a cell (just the cell if it has none). */
  cellsOf(cell: CellKey): CellKey[] {
    const s = this.shape;
    const sid = s?.structureAt.get(cell);
    const st = sid === undefined ? undefined : s!.structures.get(sid);
    return st ? [...st.cells] : [cell];
  }

  ignite(cell: CellKey): boolean {
    if (!this.shape?.world.blocks.has(cell)) return false;
    this.open();
    const ok = this.engine.ignite(cell);
    if (ok) this.emit({ type: 'lit', cell });
    else this.settleSoon();
    return ok;
  }

  /** Lightning: a storm cloud over the building and, a moment later, a bolt that sets it alight. True if it will catch. */
  strike(cell: CellKey, point: readonly [number, number, number]): boolean {
    if (!this.shape?.world.blocks.has(cell)) return false;
    this.open();
    const ok = this.engine.canLight(cell);
    const s: Strike = { id: this.nextBomb++, cell, point: [point[0], point[1], point[2]], age: 0, ok, struck: false };
    this.strikes.push(s);
    this.emit({ type: 'cloud', strike: s });
    return ok;
  }

  /**
   * Lightning on a ship or a boat (no block): the same cloud and bolt at `point`; when it comes down the
   * vessel's sails catch (shipwreck.system hears the strike: `cell` is -1).
   */
  strikeVessel(point: readonly [number, number, number]): void {
    this.open();
    const s: Strike = { id: this.nextBomb++, cell: -1 as CellKey, point: [point[0], point[1], point[2]], age: 0, ok: false, struck: false };
    this.strikes.push(s);
    this.emit({ type: 'cloud', strike: s });
  }

  /** The ship or boat under (x, z), if any (the Lightning tool can strike one): its middle. */
  vesselAt(x: number, z: number): [number, number] | null {
    if (!this.stage) return null;
    const h = harbourOf(this.stage);
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const s of h?.ships ?? []) {
      if (s.phase === 'idle' || s.phase === 'sinking' || !s.body) continue;
      const sin = Math.sin(s.pose.yaw), cos = Math.cos(s.pose.yaw);
      const along = Math.max(s.hull.stern, Math.min(s.hull.bow, (x - s.pose.x) * sin + (z - s.pose.z) * cos));
      const cx = s.pose.x + sin * along, cz = s.pose.z + cos * along;
      const d = Math.hypot(x - cx, z - cz) - s.hull.halfBeam;
      if (d < 0.6 && d < bestD) {
        bestD = d;
        best = [cx, cz];
      }
    }
    if (best) return best;
    const b = boatNear(this.stage, x, z, 0.8, this.clock);
    return b ? [b.x, b.z] : null;
  }

  /** The signals' clock, as the mischief systems last saw it (for the small boats' registry). */
  clock = 0;

  /** Strikes on their way (a cloud gathering, the bolt not yet down). */
  readonly strikes: Strike[] = [];

  dropBomb(point: readonly [number, number, number], fall = 0.7): Bomb {
    this.open();
    const bomb: Bomb = { id: this.nextBomb++, point: [point[0], point[1], point[2]], age: 0, fall };
    this.bombs.push(bomb);
    this.emit({ type: 'drop', bomb });
    return bomb;
  }

  /** The nuke: a longer fall with a whistle, a beat of silence, and the big one. */
  dropNuke(point: readonly [number, number, number]): Bomb {
    this.open();
    const bomb: Bomb = { id: this.nextBomb++, point: [point[0], point[1], point[2]], age: 0, fall: NUKE.fall, nuke: true };
    this.bombs.push(bomb);
    this.emit({ type: 'drop', bomb });
    return bomb;
  }

  /** Shockwaves on their way out, and the hits still ahead of each. */
  private waves: { t: number; hits: Hit[]; next: number }[] = [];
  /** Edits the director makes itself (the crater), handed to the game with the engine's on the next flush. */
  private extra: Edit[] = [];

  /** A crater: the ground goes down a level round the point, two at the middle (never below the sea, never at the map's edge). */
  private crater(point: readonly [number, number, number]): void {
    const shape = this.shape;
    if (!shape) return;
    const cx = point[0], cz = point[2];
    for (const [r, pass] of [[NUKE.crater, 0], [NUKE.crater * 0.5, 1]] as const) {
      const down: number[] = [];
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (x < 1 || z < 1 || x > 46 || z > 46) continue;
          // A rough bowl: the rim wanders a little by the column.
          const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) * (0.85 + rand(x, z, pass, 'rim') * 0.3);
          if (d > r) continue;
          if (shape.terrain.height[x + z * 48]! - pass <= 0) continue;
          down.push(x + z * 48);
        }
      }
      if (down.length > 0) this.extra.push({ type: 'land', up: [], down });
    }
  }

  /** The mallet: the whole building a stage worse. */
  knock(cell: CellKey): boolean {
    const s = this.shape;
    if (!s?.world.blocks.has(cell)) return false;
    this.open();
    let any = false;
    for (const c of this.cellsOf(cell)) any = this.engine.applyDamage(c, 'blast', 1) || any;
    const sid = s.structureAt.get(cell);
    if (any && sid !== undefined) this.emit({ type: 'knock', structure: sid, cell });
    return any;
  }

  /** The trowel: the whole building a stage better (scaffolding first), or all at once. */
  mend(cell: CellKey, all = false): boolean {
    const s = this.shape;
    if (!s?.world.blocks.has(cell)) return false;
    let any = false;
    for (const c of this.cellsOf(cell)) any = this.engine.repair(c, all ? 'all' : MEND_CLICK) || any;
    if (!any) return false;
    const sid = s.structureAt.get(cell);
    if (sid !== undefined) this.emit({ type: 'mend', structure: sid, cell });
    if (!this.act) {
      this.host?.edit(this.engine.takeEdits());
    }
    return true;
  }

  /** The town's builders: one step of mending on a whole building, no undo step of its own. */
  autoMend(cell: CellKey): boolean {
    let any = false;
    for (const c of this.cellsOf(cell)) any = this.engine.repair(c, 1) || any;
    if (!any) return false;
    const edits = this.engine.takeEdits();
    if (this.act) this.host?.apply(edits);
    else this.host?.amend(edits);
    return true;
  }

  private quietFrames = 0;
  private settleSoon(): void {
    this.quietFrames = 0;
  }

  update(dt: number, env: Env): void {
    // Lightning: the bolt comes down, and the block catches.
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i]!;
      s.age += dt;
      if (s.age < STRIKE.at) continue;
      this.strikes.splice(i, 1);
      s.struck = true;
      this.emit({ type: 'strike', strike: s });
      if (s.ok && this.engine.ignite(s.cell)) this.emit({ type: 'lit', cell: s.cell });
      else this.settleSoon();
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i]!;
      b.age += dt;
      if (b.age >= b.fall + (b.nuke ? NUKE.fuse : BLAST.fuse)) {
        this.bombs.splice(i, 1);
        if (b.nuke) {
          // The big one: decided now, done block by block as the shockwave reaches each (./nuke-timing.ts).
          // It does not matter that it landed in a river, a pond or the sea: the town round it goes all the
          // same (a nuke on water used to plan no hits at all: the cloud rose and nothing was touched).
          // The crater takes the land round the point; columns that are water already are left as they are.
          const plan = this.engine.blastPlan(b.point, NUKE.power, { fly: NUKE.fly, rim: true, wet: true });
          this.crater(b.point);
          this.waves.push({ t: 0, hits: plan.hits, next: 0 });
          const blast: BlastEvent = { point: [...b.point], power: NUKE.power, water: plan.water, hit: plan.hits.map((h) => ({ cell: h.cell, stage: h.stage })), lit: [] };
          this.emit({ type: 'blast', bomb: b.id, blast, nuke: true });
          continue;
        }
        const blast = this.engine.blast(b.point, 1);
        this.emit({ type: 'blast', bomb: b.id, blast });
        for (const cell of blast.lit) this.emit({ type: 'lit', cell });
      }
    }
    // Shockwaves on their way: each block is hit as the ring reaches it (in a few batches, not every
    // frame, so the town is redrawn a handful of times as the ring crosses it, not sixty).
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      const was = w.t;
      w.t += dt;
      if (Math.floor(w.t / WAVE_BATCH) === Math.floor(was / WAVE_BATCH) && w.t < NUKE_TIME.waveTime) continue;
      const r = w.t >= NUKE_TIME.waveTime ? Infinity : waveRadius(w.t);
      while (w.next < w.hits.length && w.hits[w.next]!.d <= r) {
        const h = w.hits[w.next++]!;
        this.engine.hit(h);
        if (h.light) this.emit({ type: 'lit', cell: h.cell });
      }
      if (w.next >= w.hits.length) this.waves.splice(i, 1);
    }
    this.engine.step(dt, env);
    this.mendClock += dt;
    if (this.mendClock >= 0.5) {
      this.mendTick(this.mendClock);
      this.mendClock = 0;
    }
  }

  /** Structures with a crew at work on them now (set by the rebuild chain): they mend faster. */
  crewed: ReadonlySet<StructureId> = new Set();
  /** Structures being mended that no crew can stand near (set by the rebuild chain): they mend at a crew's pace. */
  remote: ReadonlySet<StructureId> = new Set();
  private mendClock = 0;
  /** Seconds of mending owed per structure. */
  private mendOwed = new Map<StructureId, number>();

  /**
   * The town mends its own damage (design section 13b): every damaged building that is not burning starts
   * mending a short while after it was last hurt (staggered by the building, so a bombed street does not
   * tick in unison) and goes on a step at a time, faster with a crew on it. No undo step of its own.
   */
  private mendTick(dt: number): void {
    const shape = this.shape;
    if (!this.rebuild || !shape) return;
    const burning = new Set<StructureId | undefined>(this.engine.burning().map((b) => b.structure));
    const bySid = new Map<StructureId, CellKey[]>();
    for (const [cell, b] of shape.world.blocks) {
      if (!b.ruin) continue;
      const sid = shape.structureAt.get(cell);
      if (sid === undefined || burning.has(sid)) continue;
      let l = bySid.get(sid);
      if (!l) bySid.set(sid, (l = []));
      l.push(cell);
    }
    for (const sid of [...this.mendOwed.keys()]) if (!bySid.has(sid)) this.mendOwed.delete(sid);
    let any = false;
    for (const [sid, cells] of [...bySid].sort((a, b) => a[0] - b[0])) {
      const since = Math.min(...cells.map((c) => this.engine.sinceHit(c)));
      const wait = MEND.quiet + rand(sid, 'mend-wait') * MEND.stagger;
      if (since < wait) {
        this.mendOwed.delete(sid);
        continue;
      }
      const ruins = cells.map((c) => shape.world.blocks.get(c)!.ruin!);
      if (ruins.some((r) => (r & 16) !== 0)) continue; // chunks still in the air
      const owed = this.mendOwed.get(sid);
      if (owed === undefined || !ruins.every((r) => (r & 8) !== 0)) {
        // First: the scaffolding goes up.
        for (const c of cells) any = this.engine.repair(c, 1) || any;
        this.mendOwed.set(sid, rand(sid, 'mend-phase') * MEND.step);
        continue;
      }
      let left = owed + dt * (this.crewed.has(sid) || this.remote.has(sid) ? MEND.crew : 1);
      while (left >= MEND.step) {
        left -= MEND.step;
        for (const c of cells) any = this.engine.repair(c, 1) || any;
      }
      this.mendOwed.set(sid, left);
    }
    if (!any) return;
    const edits = this.engine.takeEdits();
    if (edits.length === 0) return;
    if (this.act) this.host?.apply(edits);
    else this.host?.amend(edits);
  }

  /** The app, once a frame: hands the engine's edits to the game, and closes the act when all is quiet. */
  flush(): void {
    const edits = [...this.engine.takeEdits(), ...this.extra];
    this.extra = [];
    if (edits.length > 0) {
      if (this.act) this.host?.apply(edits);
      else this.host?.edit(edits);
    }
    if (this.act && !this.busy && edits.length === 0) {
      // Wait a couple of frames so the last edits have come back through sync.
      if (++this.quietFrames > 2) {
        this.act = false;
        this.quietFrames = 0;
        this.host?.end();
      }
    } else this.quietFrames = 0;
  }

  /** Undo while it is happening: everything stops, and the town goes back to before the click. */
  cancel(): void {
    this.reset();
    if (this.act) {
      this.act = false;
      this.host?.abort();
    }
  }

  /** The player is undoing (nothing of mischief is going on): see the 'undo' event. */
  undoing(): void {
    this.emit({ type: 'undo' });
  }

  /** How many things the mischief systems have drawn and not given back (the debug handle, browser tests). */
  drawn(): number {
    return this.stage ? mischiefDrawn(this.stage) : 0;
  }

  /** Forgets everything (a new town); does not touch the game. */
  reset(): void {
    this.emit({ type: 'reset' });
    this.extra = [];
    this.waves = [];
    this.engine.cancel();
    this.mendOwed.clear();
    this.bombs.length = 0;
    this.strikes.length = 0;
    this.quietFrames = 0;
  }

  /** The town is leaving: drop the act without touching the game (it starts over anyway). */
  detach(): void {
    this.reset();
    this.act = false;
  }
}

const byStage = new WeakMap<LifeStage, Director>();

/** The director of a stage (made on first use). */
export function mischiefOf(stage: LifeStage, seed = 0x6d15c): Director {
  let d = byStage.get(stage);
  if (!d) {
    byStage.set(stage, (d = new Director(seed)));
    d.stage = stage;
  }
  return d;
}
