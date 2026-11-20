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
//
// A fright that goes on (a fire is reported every 0.4 s for as long as it
// burns) is ONE event: the same place frightened again while its last
// fright is still fresh only keeps it fresh. Birds react once, when it
// starts, and keep away from it while it lasts (`danger`): a bird must not
// take off, wheel, come down and take off again every few seconds, and a
// fright must never be counted twice in one bird's start.

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

/** Seconds a fright stays fresh after it was last reported: reported again within this, it is the same one. */
export const SCARE_FRESH = 1.5;

interface Zone {
  x: number;
  z: number;
  radius: number;
  person: boolean;
  until: number;
}

export class ScareTable {
  /** The newest event's number (0: nothing has happened yet). */
  seq = 0;
  /**
   * Dressed towns life has been given (scare.system.ts counts them). A bird made when this is above 1
   * was not there when the town opened: its home was built, or stands again after a wreck. It flies in.
   */
  towns = 0;
  private list: Scare[] = [];
  /** Frights still fresh, by cell: what keeps birds away while a fire burns. */
  private zones = new Map<CellKey, Zone>();

  add(cell: CellKey, radius: number, person: boolean, at: number): void {
    const z = this.zones.get(cell);
    if (z && z.until >= at && z.person === person && z.radius >= radius) {
      z.until = at + SCARE_FRESH; // the same fright going on: no new event
      return;
    }
    this.zones.set(cell, { x: keyX(cell) + 0.5, z: keyZ(cell) + 0.5, radius: Math.max(radius, z && z.until >= at ? z.radius : 0), person, until: at + SCARE_FRESH });
    this.list.push({ seq: ++this.seq, x: keyX(cell) + 0.5, y: (keyY(cell) + 0.5) * CELL_H, z: keyZ(cell) + 0.5, radius, person, at });
  }

  /**
   * Is (x, z) within a fright that is still going on (not a person walking by)? Where a bird should not
   * come down yet. Loops over the few fresh frights; called when a bird decides to land, not every frame.
   */
  danger(x: number, z: number, now: number, margin = 0): boolean {
    for (const [cell, d] of this.zones) {
      if (d.until < now) {
        this.zones.delete(cell);
        continue;
      }
      if (!d.person && Math.hypot(d.x - x, d.z - z) <= Math.min(d.radius, 12) + margin) return true;
    }
    return false;
  }

  /** The events a bird has not dealt with yet (those after `seen`), oldest first. */
  since(seen: number): readonly Scare[] {
    const list = this.list;
    let i = list.length;
    while (i > 0 && list[i - 1]!.seq > seen) i--;
    return i === 0 ? list : list.slice(i);
  }

  /** The newest fright still remembered (not a person walking by), or null: what a leaving bird flies away from. */
  latest(): Scare | null {
    for (let i = this.list.length - 1; i >= 0; i--) if (!this.list[i]!.person) return this.list[i]!;
    return null;
  }

  /** Forgets events older than `keep` seconds. */
  expire(now: number, keep = 2): void {
    const list = this.list;
    let drop = 0;
    while (drop < list.length && now - list[drop]!.at > keep) drop++;
    if (drop > 0) list.splice(0, drop);
    if (this.zones.size > 0) for (const [cell, z] of this.zones) if (z.until < now) this.zones.delete(cell);
  }

  clear(): void {
    this.list.length = 0;
    this.zones.clear();
    this.towns = 0;
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
