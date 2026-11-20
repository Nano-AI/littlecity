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
import type { LifeStage } from '../api';
import { createMischiefEngine, type BlastEvent, type Env, type MischiefEngine } from './engine';

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
}

export interface Bomb {
  id: number;
  point: [number, number, number];
  /** Seconds since it was dropped. */
  age: number;
  /** Seconds it falls before it lands. */
  fall: number;
}

export type MischiefEvent =
  | { type: 'lit'; cell: CellKey }
  | { type: 'drop'; bomb: Bomb }
  | { type: 'blast'; bomb: number; blast: BlastEvent }
  | { type: 'knock'; structure: StructureId; cell: CellKey }
  | { type: 'mend'; structure: StructureId; cell: CellKey };

export class Director {
  readonly engine: MischiefEngine;
  private host: MischiefHost | null = null;
  private shape: ShapePlan | null = null;
  private act = false;
  readonly bombs: Bomb[] = [];
  private nextBomb = 1;
  private listeners: ((e: MischiefEvent) => void)[] = [];
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
    return this.engine.busy || this.bombs.length > 0;
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

  dropBomb(point: readonly [number, number, number], fall = 0.7): Bomb {
    this.open();
    const bomb: Bomb = { id: this.nextBomb++, point: [point[0], point[1], point[2]], age: 0, fall };
    this.bombs.push(bomb);
    this.emit({ type: 'drop', bomb });
    return bomb;
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
    for (const c of this.cellsOf(cell)) any = this.engine.repair(c, all ? 'all' : 1) || any;
    if (!any) return false;
    const sid = s.structureAt.get(cell);
    if (sid !== undefined) this.emit({ type: 'mend', structure: sid, cell });
    if (!this.act) {
      this.host?.edit(this.engine.takeEdits());
    }
    return true;
  }

  private quietFrames = 0;
  private settleSoon(): void {
    this.quietFrames = 0;
  }

  update(dt: number, env: Env): void {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i]!;
      b.age += dt;
      if (b.age >= b.fall + BLAST.fuse) {
        this.bombs.splice(i, 1);
        const blast = this.engine.blast(b.point, 1);
        this.emit({ type: 'blast', bomb: b.id, blast });
        for (const cell of blast.lit) this.emit({ type: 'lit', cell });
      }
    }
    this.engine.step(dt, env);
  }

  /** The app, once a frame: hands the engine's edits to the game, and closes the act when all is quiet. */
  flush(): void {
    const edits = this.engine.takeEdits();
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

  /** Forgets everything (a new town); does not touch the game. */
  reset(): void {
    this.engine.cancel();
    this.bombs.length = 0;
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
  if (!d) byStage.set(stage, (d = new Director(seed)));
  return d;
}
