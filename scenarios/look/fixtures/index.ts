// LOOK FIXTURES: the spike's pieces rebuilt with MeshBuilder, to prove the
// look in the real renderer before the real generators exist (Stage 2 owns
// src/gen/<kind>; nothing here is discovered as a real generator).
//
// The look scenarios use seeds in a reserved range. For towns with those
// seeds, and only those, the view draws houses, trees, marble, pillars,
// stairs, paths, plazas and lamps with the fixtures in this directory; every
// other kind and part still comes from discovery (or its placeholder).
// Importing this module installs that (src/render/registries.ts).

import type { GeneratorRegistry, PartRegistry } from '@/gen/api';
import { collectGenerators, collectParts, allGenerators, allParts } from '@/gen/discover';
import { overrideRegistries } from '@/render/registries';

/** Seeds LOOK_SEED … LOOK_SEED + 255 belong to the look scenarios. */
export const LOOK_SEED = 0x100c00;
export const isLookSeed = (seed: number): boolean => seed >= LOOK_SEED && seed < LOOK_SEED + 256;

const fixtureGenerators = collectGenerators(import.meta.glob('./*.gen.ts', { eager: true }));
const fixtureParts = collectParts(import.meta.glob('./*.part.ts', { eager: true }));

/** The fixtures first, then whatever discovery has. */
export const lookGenerators: GeneratorRegistry = {
  has: (kind) => fixtureGenerators.has(kind) || allGenerators().has(kind),
  forKind: (kind) => (fixtureGenerators.has(kind) ? fixtureGenerators.forKind(kind) : allGenerators().forKind(kind)),
  build: (s, plan, parts) => lookGenerators.forKind(s.kind).build(s, plan, parts),
  layers: () => [...allGenerators().layers(), ...fixtureGenerators.layers()],
};

export const lookParts: PartRegistry = {
  has: (category, type) => fixtureParts.has(category, type) || allParts().has(category, type),
  list: () => [...fixtureParts.list(), ...allParts().list()],
  feature: (item, env) => (fixtureParts.has('feature', item.type) ? fixtureParts : allParts()).feature(item, env),
  prop: (item, env) => (fixtureParts.has('prop', item.type) ? fixtureParts : allParts()).prop(item, env),
  actor: (item, env) => (fixtureParts.has('actor', item.type) ? fixtureParts : allParts()).actor(item, env),
};

overrideRegistries({
  name: 'look-fixtures',
  match: (plan) => isLookSeed(plan.world.seed),
  generators: lookGenerators,
  parts: lookParts,
});
