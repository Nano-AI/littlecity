// What frightens birds (L16): a block landing, a person walking by. One
// table per stage, written by scare.system.ts from the signals' events and
// read by every bird behaviour:
//
//   const table = scaresOf(ctx.stage);
//   if (table.seq !== state.seen) {                 // something new happened
//     for (const s of table.since(state.seen)) if (near(s)) takeOff();
//     state.seen = table.seq;
//   }
//
// so a bird pays one comparison a frame, and nothing subscribes per bird.

import { CELL_H, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import type { LifeStage } from '../api';

export interface Scare {
  /** Counts up from 1; a bird remembers the last one it has dealt with. */
  seq: number;
  /** Where, in world units (the middle of the cell). */
  x: number;
  y: number;
  z: number;
  /** Birds within this many cells (on the ground plan) take off. */
  radius: number;
  /** True for a person walking by: only birds on the ground mind. */
  person: boolean;
  /** Life time it happened at, seconds. */
  at: number;
}

export class ScareTable {
  /** The newest event's number (0: nothing has happened yet). */
  seq = 0;
  private list: Scare[] = [];

  add(cell: CellKey, radius: number, person: boolean, at: number): void {
    this.list.push({ seq: ++this.seq, x: keyX(cell) + 0.5, y: (keyY(cell) + 0.5) * CELL_H, z: keyZ(cell) + 0.5, radius, person, at });
  }

  /** The events a bird has not dealt with yet (those after `seen`), oldest first. */
  since(seen: number): readonly Scare[] {
    const list = this.list;
    let i = list.length;
    while (i > 0 && list[i - 1]!.seq > seen) i--;
    return i === 0 ? list : list.slice(i);
  }

  /** Forgets events older than `keep` seconds. */
  expire(now: number, keep = 2): void {
    const list = this.list;
    let drop = 0;
    while (drop < list.length && now - list[drop]!.at > keep) drop++;
    if (drop > 0) list.splice(0, drop);
  }

  clear(): void {
    this.list.length = 0;
  }
}

const byStage = new WeakMap<LifeStage, ScareTable>();

export function scaresOf(stage: LifeStage): ScareTable {
  let t = byStage.get(stage);
  if (!t) byStage.set(stage, (t = new ScareTable()));
  return t;
}

/** Distance on the ground plan from (x, z) to a scare, in cells. */
export function scareDistance(s: Scare, x: number, z: number): number {
  return Math.hypot(s.x - x, s.z - z);
}
