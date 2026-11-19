// Who is home (for L07: windows light only where a resident is home).
//
// The People owner calls this as residents come and go; until anyone does,
// every house counts as occupied, so a town with no people still lights up.
//
//   setOccupied(stage, houseStructureId, false);   // everyone is out: its windows go dark
//   setOccupied(stage, houseStructureId, true);    // someone came home: they light (L25)
//
// The window behaviour reads it every drawing; a change fades in over
// DUSKY.houseFade seconds.

import type { StructureId } from '@/resolve/plan';
import type { LifeStage } from '../api';

const byStage = new WeakMap<LifeStage, Map<StructureId, boolean>>();

export function setOccupied(stage: LifeStage, house: StructureId, home: boolean): void {
  let t = byStage.get(stage);
  if (!t) byStage.set(stage, (t = new Map()));
  t.set(house, home);
}

/** True unless someone said the house is empty. */
export function isOccupied(stage: LifeStage, house: StructureId | undefined): boolean {
  if (house === undefined) return true;
  return byStage.get(stage)?.get(house) ?? true;
}

/** Forget everything (a new town). */
export function clearOccupancy(stage: LifeStage): void {
  byStage.delete(stage);
}
