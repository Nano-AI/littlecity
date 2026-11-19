// Behaviour and system discovery (Stage 0, real). Nobody edits a list:
//   src/life/**/*.behaviour.ts  exports made with defineBehaviour
//   src/life/**/*.system.ts     exports made with defineSystem

import { collectExports } from '@/core/discover';
import { isBehaviour, isSystem, type Behaviour, type System } from './api';

const behaviourModules = import.meta.glob('/src/life/**/*.behaviour.ts', { eager: true });
const systemModules = import.meta.glob('/src/life/**/*.system.ts', { eager: true });

export function collectBehaviours(modules: Record<string, unknown>): Behaviour[] {
  const found = collectExports(modules, isBehaviour).map((b) => b.item);
  const seen = new Set<string>();
  for (const b of found) {
    const k = `${b.category}:${b.type}`;
    if (seen.has(k)) throw new Error(`two behaviours animate the ${b.category} type '${b.type}'`);
    seen.add(k);
  }
  return found;
}

export function collectSystems(modules: Record<string, unknown>): System[] {
  const found = collectExports(modules, isSystem).map((s) => s.item);
  const seen = new Set<string>();
  for (const s of found) {
    if (seen.has(s.id)) throw new Error(`two systems share the id '${s.id}'`);
    seen.add(s.id);
  }
  return found.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

let behaviours: Behaviour[] | null = null;
let systems: System[] | null = null;

export function allBehaviours(): readonly Behaviour[] {
  return (behaviours ??= collectBehaviours(behaviourModules));
}
export function allSystems(): readonly System[] {
  return (systems ??= collectSystems(systemModules));
}
