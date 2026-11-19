// The Node half of `node tools/profile.mjs [scenario]`: where the time goes in
// one resolve after one edit, by pass, by fact and by rule (medians).

import { allRules } from '@/resolve/engine/discover';
import { hashStructure } from '@/resolve/engine/hash';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { resolveKinds } from '@/resolve/kinds';
import { buildStructures } from '@/resolve/structures';
import { resolveSupports } from '@/resolve/supports';
import { buildScenario } from '@/scenario';
import { benchEdit } from '@/scenario/edits';
import { applyEdit } from '@/world/world';
import type { World } from '@/core/world';
import { findScenario } from '@/scenario/discover';

const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;

export function main(name = 'bench-2000', runs = 20, log: (s: string) => void = console.log, shapeOnly = false): void {
  const scn = findScenario(name);
  if (!scn) throw new Error(`no scenario named '${name}'`);
  const built = buildScenario(scn);
  let world = built.world;
  const t = built.terrain;
  const clock = (): number => performance.now();
  const next = (w: World, i: number): World => {
    const e = benchEdit(w, t, i);
    if (!e) throw new Error(`no legal edit in '${name}'`);
    return applyEdit(w, t, e);
  };
  for (let i = 0; i < 5; i++) resolveDressing(resolveShape(world, t));
  if (shapeOnly) {
    // For a CPU profile of the shape stage alone.
    for (let i = 0; i < runs; i++) {
      world = next(world, i);
      resolveShape(world, t);
    }
    return;
  }
  const phase = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, v: number): void => {
    let list = m.get(k);
    if (!list) m.set(k, (list = []));
    list.push(v);
  };
  const ruleMs = new Map<string, number[]>();
  for (let i = 0; i < runs; i++) {
    world = next(world, i);
    let a = clock();
    const kinds = resolveKinds(world, t);
    push(phase, 'kinds', clock() - a);
    a = clock();
    buildStructures(world, t, kinds);
    push(phase, 'structures', clock() - a);
    a = clock();
    resolveSupports(world, t, kinds);
    push(phase, 'supports', clock() - a);
    a = clock();
    const shape = resolveShape(world, t, { clock });
    push(phase, 'resolveShape total', clock() - a);
    a = clock();
    for (const s of shape.structures.values()) hashStructure(s, shape);
    push(phase, '  hash all structures', clock() - a);
    a = clock();
    const dressing = resolveDressing(shape, { clock });
    push(phase, 'resolveDressing total', clock() - a);
    let rs = 0;
    let rd = 0;
    for (const tr of shape.trace) {
      rs += tr.ms ?? 0;
      push(ruleMs, tr.rule, tr.ms ?? 0);
    }
    for (const tr of dressing.trace) {
      rd += tr.ms ?? 0;
      push(ruleMs, tr.rule, tr.ms ?? 0);
    }
    push(phase, '  shape rules (incl. facts)', rs);
    push(phase, '  dressing rules (incl. facts)', rd);
  }
  log(`profile ${name}: ${world.blocks.size} blocks, ${allRules().length} rules, median over ${runs} edits`);
  for (const [k, v] of phase) log(`  ${k.padEnd(36)} ${med(v).toFixed(2)} ms`);
  log('rules (incl. facts first read there):');
  const partOf = new Map(allRules().map((r) => [r.id, r.part]));
  for (const stage of [['roles', 'joinery'], ['decoration', 'urban', 'life']]) {
    const rows = [...ruleMs].filter(([k]) => stage.includes(partOf.get(k) ?? '')).sort((x, y) => med(y[1]) - med(x[1]));
    const total = rows.reduce((n, [, v]) => n + med(v), 0);
    log(`  ${stage.join(' + ')}: ${rows.length} rules, ${total.toFixed(2)} ms (sum of medians)`);
    for (const [k, v] of rows.slice(0, 30)) log(`    ${k.padEnd(36)} ${(partOf.get(k) ?? '').padEnd(10)} ${med(v).toFixed(2)} ms`);
  }
}
