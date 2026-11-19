// The demo fixtures as registries, for tests. Real rules, parts and
// behaviours live under src/ and are discovered there; these exist so the
// contracts can be exercised (and shown in docs/swarm/CONTRACTS.md) before
// any real one is written.
import { collectParts } from '@/gen/discover';
import { collectBehaviours, collectSystems } from '@/life/discover';
import { collectRules } from '@/resolve/engine/discover';

export const demoRuleModules = import.meta.glob('./rules/*.rule.ts', { eager: true });
export const demoRules = collectRules(demoRuleModules);
export const demoParts = collectParts(import.meta.glob('./parts/*.part.ts', { eager: true }));
export const demoBehaviours = collectBehaviours(import.meta.glob('./life/*.behaviour.ts', { eager: true }));
export const demoSystems = collectSystems(import.meta.glob('./life/*.system.ts', { eager: true }));
