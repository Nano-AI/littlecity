// Town logic entry points. Owner: Logic (Stage 1).
//
//   resolveShape(world, terrain)  passes 1–7: kinds, structures, supports,
//                                 facts, roles, joinery. Synchronous; runs on
//                                 every edit and for the ghost preview.
//   resolveDressing(shape)        passes 8–9: decoration, urban fill, the
//                                 walking graph, life. May run a frame later.
//
// Both are pure: same world and terrain, same plan and same hashes.

import type { Terrain, World } from '@/core/world';
import type { ResolveOptions } from './engine/api';
import { allRules } from './engine/discover';
import { runDressingStage, runShapeStage } from './engine/run';
import { resolveKinds } from './kinds';
import { buildNav } from './nav';
import type { DressingPlan, ShapePlan, TownPlan } from './plan';
import { buildStructures } from './structures';
import { resolveSupports } from './supports';

export type { ResolveOptions } from './engine/api';
export type * from './plan';

export function resolveShape(w: World, t: Terrain, opts: ResolveOptions = {}): ShapePlan {
  const kinds = resolveKinds(w, t);
  const { structures, structureAt, floorAt, edgeAt } = buildStructures(w, t, kinds);
  const supports = resolveSupports(w, t, kinds);
  return runShapeStage(
    { world: w, terrain: t, kinds, structures, structureAt, floorAt, edgeAt, supports },
    opts.rules ?? allRules(),
    opts,
  );
}

export function resolveDressing(shape: ShapePlan, opts: ResolveOptions = {}): DressingPlan {
  return runDressingStage(shape, opts.rules ?? allRules(), { buildNav }, opts);
}

/** Both stages at once (tests, tools, screenshots). */
export function resolveTown(w: World, t: Terrain, opts: ResolveOptions = {}): TownPlan {
  const shape = resolveShape(w, t, opts);
  return { shape, dressing: resolveDressing(shape, opts) };
}
