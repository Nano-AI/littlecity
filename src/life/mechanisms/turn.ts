// A windmill's cap turns about its tower's axis; its sails, at the same
// hub, must turn with it. The cap behaviour publishes the turn here as a
// world-space matrix (a rotation about the tower's axis); the sails
// behaviour multiplies its pose by it, as anything fixed to a bouncing
// structure multiplies by carryOf (src/life/feedback/carry.ts).

import type { Mat4Like } from '@/core/mat4';
import type { StructureId } from '@/resolve/plan';
import type { LifeStage } from '../api';

const byStage = new WeakMap<LifeStage, Map<StructureId, Mat4Like>>();

/** How a mill's cap is turned from where its generator built it, as a world matrix; null if it is not. */
export function capTurnOf(stage: LifeStage, mill: StructureId | undefined): Mat4Like | null {
  if (mill === undefined) return null;
  return byStage.get(stage)?.get(mill) ?? null;
}

/** For the cap behaviour: the table it writes. */
export function capTurnTable(stage: LifeStage): Map<StructureId, Mat4Like> {
  let t = byStage.get(stage);
  if (!t) byStage.set(stage, (t = new Map()));
  return t;
}
