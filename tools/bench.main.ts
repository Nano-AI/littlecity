// The Node half of `npm run bench` (run through Vite by tools/bench.mjs):
// both logic stages on the synthetic town, after one edit, with the rule
// engine and every discovered rule loaded.

import { resolveDressing, resolveShape } from '@/resolve/index';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { benchEdit } from '@/scenario/edits';
import { applyEdit } from '@/world/world';

export interface LogicBench {
  scenario: string;
  blocks: number;
  structures: number;
  rules: number;
  runs: number;
  buildMs: number;
  shapeMs: number[];
  dressingMs: number[];
  slowestRules: { rule: string; ms: number }[];
}

export function main(name = 'bench-2000', runs = 30): LogicBench {
  const scn = findScenario(name);
  if (!scn) throw new Error(`no scenario named '${name}'`);
  const t0 = performance.now();
  const built = buildScenario(scn);
  const buildMs = performance.now() - t0;
  let world = built.world;
  const clock = (): number => performance.now();

  const opts = scenarioResolveOptions(scn);
  // Warm up the JIT, then measure one edit at a time.
  for (let i = 0; i < 5; i++) resolveDressing(resolveShape(world, built.terrain, opts), opts);
  const shapeMs: number[] = [];
  const dressingMs: number[] = [];
  const ruleMs = new Map<string, number>();
  let structures = 0;
  let rules = 0;
  for (let i = 0; i < runs; i++) {
    // One edit: an Auto block on top of a column, a legal one for this town, a different column each time.
    const edit = benchEdit(world, built.terrain, i);
    if (!edit) throw new Error(`no legal Auto block left to place in '${name}'`);
    world = applyEdit(world, built.terrain, edit);
    const a = performance.now();
    const shape = resolveShape(world, built.terrain, { ...opts, clock });
    const b = performance.now();
    const dressing = resolveDressing(shape, { ...opts, clock });
    const c = performance.now();
    shapeMs.push(b - a);
    dressingMs.push(c - b);
    structures = shape.structures.size;
    rules = shape.trace.length + dressing.trace.length;
    for (const t of [...shape.trace, ...dressing.trace]) ruleMs.set(t.rule, (ruleMs.get(t.rule) ?? 0) + (t.ms ?? 0) / runs);
  }
  const slowestRules = [...ruleMs].map(([rule, ms]) => ({ rule, ms })).sort((x, y) => y.ms - x.ms).slice(0, 8);
  return { scenario: name, blocks: world.blocks.size, structures, rules, runs, buildMs, shapeMs, dressingMs, slowestRules };
}
