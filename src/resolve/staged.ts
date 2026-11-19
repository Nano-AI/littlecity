// STUB (Stage 0). Owner: Logic (Stage 1). Final signatures.
//
// Staged resolve for the app: the shape is resolved at once on every edit,
// the dressing a little later, and dressing for a superseded world is never
// delivered (plan Review Focus 1: the newest edit wins, nothing flickers
// back). The app calls update() on each edit and poll() once per frame.

import type { Terrain, World } from '@/core/world';
import { resolveDressing, resolveShape } from './index';
import type { DressingPlan, ShapePlan } from './plan';

export interface StagedResolver {
  /** Resolves the shape for this world now and queues its dressing. */
  update(world: World): ShapePlan;
  /**
   * Returns the dressing for the NEWEST world once, when it is ready;
   * otherwise null. Dressing for an older world is dropped, never returned.
   */
  poll(): { shape: ShapePlan; dressing: DressingPlan } | null;
  /** A what-if shape for the ghost preview. Does not disturb update/poll. */
  preview(world: World): ShapePlan;
  /** The latest shape passed back from update(), or null before the first. */
  readonly shape: ShapePlan | null;
}

export function createStagedResolver(terrain: Terrain): StagedResolver {
  let shape: ShapePlan | null = null;
  let pending = false;
  return {
    update(world) {
      shape = resolveShape(world, terrain);
      pending = true;
      return shape;
    },
    poll() {
      if (!pending || !shape) return null;
      pending = false;
      return { shape, dressing: resolveDressing(shape) };
    },
    preview(world) {
      return resolveShape(world, terrain);
    },
    get shape() {
      return shape;
    },
  };
}
