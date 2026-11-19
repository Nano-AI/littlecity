// Generator, layer and part discovery (Stage 0, real). Nobody edits a list:
//   src/gen/**/*.gen.ts    exports made with defineGenerator or defineLayer
//   src/parts/**/*.part.ts exports made with definePart
// Works in the Vite app, under Vitest and in the Node CLIs.

import { collectExports } from '@/core/discover';
import {
  createGeneratorRegistry,
  createPartRegistry,
  isGenerator,
  isLayer,
  isPart,
  type GeneratorRegistry,
  type PartRegistry,
} from './api';
import { fallbackGenerator, fallbackPart } from './fallback';

const genModules = import.meta.glob('/src/gen/**/*.gen.ts', { eager: true });
const partModules = import.meta.glob('/src/parts/**/*.part.ts', { eager: true });

/** Builds registries from glob results (tests pass their own fixtures). */
export function collectGenerators(modules: Record<string, unknown>): GeneratorRegistry {
  return createGeneratorRegistry(
    collectExports(modules, isGenerator).map((g) => g.item),
    collectExports(modules, isLayer).map((l) => l.item),
    fallbackGenerator,
  );
}
export function collectParts(modules: Record<string, unknown>): PartRegistry {
  return createPartRegistry(
    collectExports(modules, isPart).map((p) => p.item),
    fallbackPart,
  );
}

let generators: GeneratorRegistry | null = null;
let parts: PartRegistry | null = null;

/** Every generator and layer in src/gen. */
export function allGenerators(): GeneratorRegistry {
  return (generators ??= collectGenerators(genModules));
}
/** Every part in src/parts. */
export function allParts(): PartRegistry {
  return (parts ??= collectParts(partModules));
}
