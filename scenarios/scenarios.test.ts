// THE SCENARIO RUNNER. Every scenarios/**/*.scenario.ts file is built,
// resolved and checked here; nobody registers anything. A rule's fixture is
// simply a scenario whose expect() asserts what the rule should do.

import { describe, expect, test } from 'vitest';
import { resolveTown } from '@/resolve/index';
import { buildScenario, checkScenario } from '@/scenario';
import { allScenarios } from '@/scenario/discover';

const entries = allScenarios();

describe('scenarios', () => {
  test('there are scenarios, with unique names', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.scenario.name)).size).toBe(entries.length);
  });

  describe.each(entries.map((e) => [e.scenario.name, e] as const))('%s', (_name, entry) => {
    test('builds, resolves and passes its expect()', () => {
      const r = checkScenario(entry.scenario);
      expect(r.cameras.length).toBeGreaterThan(0);
      for (const c of r.cameras) {
        expect(c.pitch).toBeGreaterThanOrEqual(10);
        expect(c.pitch).toBeLessThanOrEqual(85);
        expect(c.zoom).toBeGreaterThan(0);
      }
    });

    test('resolves to the same hashes twice', () => {
      const built = buildScenario(entry.scenario);
      const a = resolveTown(built.world, built.terrain);
      const b = resolveTown(buildScenario(entry.scenario).world, built.terrain);
      expect(b.shape.hash).toBe(a.shape.hash);
      expect(b.dressing.hash).toBe(a.dressing.hash);
    });
  });
});
