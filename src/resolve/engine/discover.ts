// Rule and fact discovery (Stage 0, real). Nobody edits a list: a file named
// *.rule.ts under src/rules, or *.fact.ts anywhere under src, is picked up
// here in the Vite app, under Vitest, and in the Node CLIs alike.

import { collectExports } from '@/core/discover';
import { isFact, type Fact } from '../facts/api';
import { isRule, type Rule } from './api';
import { sortRules } from './run';

/** Rules from a glob result, validated (unique ids, at least one rule per file) and in run order. */
export function collectRules(modules: Record<string, unknown>): Rule[] {
  const found = collectExports(modules, isRule);
  const byId = new Map<string, string>();
  for (const { item, file } of found) {
    const other = byId.get(item.id);
    if (other !== undefined && other !== file) {
      throw new Error(`rule id '${item.id}' is defined in both ${other} and ${file}`);
    }
    byId.set(item.id, file);
  }
  const files = new Set(found.map((f) => f.file));
  for (const file of Object.keys(modules)) {
    if (!files.has(file)) throw new Error(`${file} exports no rule; export default defineRule({ ... })`);
  }
  return sortRules([...new Set(found.map((f) => f.item))]);
}

export function collectFacts(modules: Record<string, unknown>): Fact<unknown>[] {
  const found = collectExports(modules, isFact);
  const byName = new Map<string, string>();
  for (const { item, file } of found) {
    const other = byName.get(item.factName);
    if (other !== undefined && other !== file) {
      throw new Error(`fact '${item.factName}' is defined in both ${other} and ${file}`);
    }
    byName.set(item.factName, file);
  }
  return [...new Set(found.map((f) => f.item))];
}

const ruleModules = import.meta.glob('/src/rules/**/*.rule.ts', { eager: true });
const factModules = import.meta.glob('/src/**/*.fact.ts', { eager: true });

let rules: Rule[] | null = null;
let facts: Fact<unknown>[] | null = null;

/** Every rule in src/rules, in run order. */
export function allRules(): readonly Rule[] {
  return (rules ??= collectRules(ruleModules));
}
/** Every fact defined in a *.fact.ts file (for tools; rules import the facts they use). */
export function allFacts(): readonly Fact<unknown>[] {
  return (facts ??= collectFacts(factModules));
}
/** The files discovery saw (for tests and `npm run inspect`). */
export function discoveredRuleFiles(): string[] {
  return Object.keys(ruleModules).sort();
}
