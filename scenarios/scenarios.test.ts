// THE SCENARIO RUNNER. Every scenarios/**/*.scenario.ts file is built,
// resolved and checked here; nobody registers anything. A rule's fixture is
// simply a scenario whose expect() asserts what the rule should do.

import { describe, expect, test } from 'vitest';
import { checkScenario, resolveScenario, type ResolvedScenario } from '@/scenario';
import { allScenarios } from '@/scenario/discover';

const entries = allScenarios();
/** What the first test resolved, by scenario name: the second compares a fresh resolve with it. */
const checked = new Map<string, ResolvedScenario>();

describe('scenarios', () => {
  test('there are scenarios, with unique names', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.scenario.name)).size).toBe(entries.length);
  });

  describe.each(entries.map((e) => [e.scenario.name, e] as const))('%s', (_name, entry) => {
    test('builds, resolves and passes its expect()', () => {
      const r = checkScenario(entry.scenario);
      checked.set(entry.scenario.name, r);
      expect(r.cameras.length).toBeGreaterThan(0);
      for (const c of r.cameras) {
        expect(c.pitch).toBeGreaterThanOrEqual(10);
        expect(c.pitch).toBeLessThanOrEqual(85);
        expect(c.zoom).toBeGreaterThan(0);
      }
    });

    test('resolves to the same hashes twice', () => {
      // Built and resolved again from scratch (with the scenario's own rules, as checked above).
      const a = checked.get(entry.scenario.name) ?? resolveScenario(entry.scenario);
      checked.delete(entry.scenario.name);
      const b = resolveScenario(entry.scenario);
      expect(b.shape.hash).toBe(a.shape.hash);
      expect(b.dressing.hash).toBe(a.dressing.hash);
    });
  });
});
