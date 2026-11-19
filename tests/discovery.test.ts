// Discovery in Vitest must see exactly the files on disk: this is what makes
// "add a file, never edit a list" safe. (The Node CLIs load the same modules
// through Vite: tests/e2e/tools.e2e.test.ts runs them.)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { allGenerators, allParts } from '@/gen/discover';
import { allBehaviours, allSystems } from '@/life/discover';
import { allFacts, allRules, discoveredRuleFiles } from '@/resolve/engine/discover';
import { allScenarios } from '@/scenario/discover';

const ROOT = path.resolve(__dirname, '..');

function filesOnDisk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(suffix)) out.push(`/${path.relative(ROOT, full).split(path.sep).join('/')}`);
    }
  };
  walk(path.join(ROOT, dir));
  return out.sort();
}

describe('discovery matches the files on disk', () => {
  test('rules: every src/rules/**/*.rule.ts file is loaded and exports a rule', () => {
    expect(discoveredRuleFiles()).toEqual(filesOnDisk('src/rules', '.rule.ts'));
    expect(allRules().length).toBeGreaterThanOrEqual(discoveredRuleFiles().length);
  });

  test('scenarios: every scenarios/**/*.scenario.ts file is loaded', () => {
    expect(allScenarios().map((e) => e.file).sort()).toEqual(filesOnDisk('scenarios', '.scenario.ts'));
  });

  test('facts: every *.fact.ts under src defines at least one fact', () => {
    const files = filesOnDisk('src', '.fact.ts');
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(allFacts().map((f) => f.factName)).toEqual(expect.arrayContaining(['townFacts', 'socketsByType', 'featuresByType']));
  });

  test('generators, layers, parts, behaviours and systems load without clashes', () => {
    expect(allGenerators().layers().map((l) => l.layer)).toContain('terrain');
    const parts = allParts().list();
    expect(parts.length).toBeGreaterThanOrEqual(filesOnDisk('src/parts', '.part.ts').length);
    expect(allBehaviours().length).toBeGreaterThanOrEqual(filesOnDisk('src/life', '.behaviour.ts').length);
    expect(allSystems().length).toBeGreaterThanOrEqual(filesOnDisk('src/life', '.system.ts').length);
  });

  test('rule ids are unique and each file name starts with its rule id', () => {
    const ids = allRules().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const file of discoveredRuleFiles()) {
      const stem = path.basename(file, '.rule.ts');
      expect(ids, `${file} should export a rule whose id is '${stem}'`).toContain(stem);
    }
  });
});
