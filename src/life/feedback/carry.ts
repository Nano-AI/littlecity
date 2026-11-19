// While a structure is mid-bounce it is drawn through a matrix (squash,
// drop, tilt). Things fixed to it must move with it or they hang in the air
// for a quarter of a second: its flower boxes, its sign, its sails.
//
// The feedback system publishes that matrix here for as long as the bounce
// lasts. Props are moved by the feedback system itself; an ACTOR behaviour
// that poses something fixed to a structure multiplies its matrix by
// carryOf(stage, structure) when it is not null:
//
//   const carry = carryOf(ctx.stage, ctx.item.home);
//   ctx.instance.setMatrix(carry ? multiply(carry, pose) : pose);

import type { Mat4Like } from '@/core/mat4';
import type { StructureId } from '@/resolve/plan';
import type { LifeStage } from '../api';

const byStage = new WeakMap<LifeStage, Map<StructureId, Mat4Like>>();

/** The world-space matrix a bouncing structure is drawn through right now, or null if it stands still. */
export function carryOf(stage: LifeStage, structure: StructureId | undefined): Mat4Like | null {
  if (structure === undefined) return null;
  return byStage.get(stage)?.get(structure) ?? null;
}

/** For the feedback system: the table it writes. */
export function carryTable(stage: LifeStage): Map<StructureId, Mat4Like> {
  let t = byStage.get(stage);
  if (!t) byStage.set(stage, (t = new Map()));
  return t;
}
