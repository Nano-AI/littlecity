// Extra peals (L57: the wedding bells). A per-stage note of when the last one
// began (life time, seconds); every bell in the town rings it as it rings the
// evening peal (bell.behaviour.ts).

import type { LifeStage } from '../api';

const peals = new WeakMap<object, { at: number }>();

/** Rings every bell in the town from now (`seconds`: life time). */
export function ringPeal(stage: LifeStage, seconds: number): void {
  peals.set(stage, { at: seconds });
}

/** When the last extra peal began, or null. */
export function pealAt(stage: LifeStage): number | null {
  return peals.get(stage)?.at ?? null;
}
