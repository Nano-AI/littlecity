// Scenario discovery (Stage 0, real). Nobody edits a list: every
// scenarios/**/*.scenario.ts file's default export is a scenario.

import { collectExports } from '@/core/discover';
import { isScenario, type Scenario } from './scenario';

const modules = import.meta.glob('/scenarios/**/*.scenario.ts', { eager: true });

export interface ScenarioEntry {
  scenario: Scenario;
  /** Path from the repo root, e.g. /scenarios/rules/D05.laundry-line.scenario.ts */
  file: string;
}

export function collectScenarios(mods: Record<string, unknown>): ScenarioEntry[] {
  const found = collectExports(mods, isScenario).map(({ item, file }) => ({ scenario: item, file }));
  const byName = new Map<string, string>();
  for (const { scenario, file } of found) {
    const other = byName.get(scenario.name);
    if (other !== undefined) throw new Error(`scenario name '${scenario.name}' is used by both ${other} and ${file}`);
    byName.set(scenario.name, file);
  }
  const files = new Set(found.map((f) => f.file));
  for (const file of Object.keys(mods)) {
    if (!files.has(file)) throw new Error(`${file} exports no scenario; export default scenario({ ... })`);
  }
  return found.sort((a, b) => (a.scenario.name < b.scenario.name ? -1 : a.scenario.name > b.scenario.name ? 1 : 0));
}

let cached: ScenarioEntry[] | null = null;

/** Every scenario, sorted by name. */
export function allScenarios(): readonly ScenarioEntry[] {
  return (cached ??= collectScenarios(modules));
}

export function findScenario(name: string): Scenario | undefined {
  return allScenarios().find((e) => e.scenario.name === name)?.scenario;
}

function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
    } else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/**
 * Scenarios whose name or file path matches a glob. `*` matches within a
 * path segment, `**` across segments. A pattern with no wildcard also
 * matches as a substring. Examples: 'R-H*', 'rules/**', 'laundry'.
 */
export function matchScenarios(pattern: string | undefined, entries: readonly ScenarioEntry[] = allScenarios()): ScenarioEntry[] {
  if (!pattern) return [...entries];
  const re = globToRegExp(pattern);
  const plain = !/[*?]/.test(pattern);
  return entries.filter(({ scenario, file }) => {
    const rel = file.replace(/^\/?scenarios\//, '');
    const stem = rel.replace(/\.scenario\.ts$/, '');
    return (
      re.test(scenario.name) || re.test(rel) || re.test(stem) || re.test(file) ||
      (plain && (scenario.name.includes(pattern) || rel.includes(pattern)))
    );
  });
}
