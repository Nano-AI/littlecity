// Which generators and parts draw a town (Look, Stage 1). Normally: every
// one discovery found (src/gen, src/parts). A look fixture or a gallery
// entry may stand in its own for the towns it recognises, so pieces can be
// shown before (or instead of) the real ones, with no change to the app,
// the shot page or discovery:
//
//   overrideRegistries({ match: (plan) => plan.world.seed === MY_SEED, generators, parts });
//
// No Three.js here: scenario files import this in Node too.

import type { GeneratorRegistry, PartRegistry } from '@/gen/api';
import { allGenerators, allParts } from '@/gen/discover';
import type { ShapePlan } from '@/resolve/plan';

export interface Registries {
  generators: GeneratorRegistry;
  parts: PartRegistry;
}

export interface RegistryOverride {
  /** A name, so installing the same override twice (hot reload) replaces it. */
  name: string;
  /** True for the towns this override draws. */
  match(plan: ShapePlan): boolean;
  generators?: GeneratorRegistry;
  parts?: PartRegistry;
}

const overrides = new Map<string, RegistryOverride>();

export function overrideRegistries(o: RegistryOverride): void {
  overrides.set(o.name, o);
}

/** The generators and parts that draw this plan. */
export function registriesFor(plan: ShapePlan): Registries {
  for (const o of overrides.values()) {
    if (o.match(plan)) return { generators: o.generators ?? allGenerators(), parts: o.parts ?? allParts() };
  }
  return { generators: allGenerators(), parts: allParts() };
}
