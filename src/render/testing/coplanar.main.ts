// TEST SUPPORT (Look): lists faces that lie in one plane, face the same way and overlap, with different
// ink ids (coplanar.ts). Run by coplanar.mjs.

import { MeshBuilder } from '@/gen/mesh';
import { resolveShape } from '@/resolve/index';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { coplanarPairs, summarise } from './coplanar-scan';

/** Ink id to the group name it was made from (for `--pairs`): wraps `inkOf` while the meshes are built. */
function nameInks(): Map<number, string> {
  const names = new Map<number, string>();
  const proto = MeshBuilder.prototype as unknown as { inkOf(g: number | string): number };
  const inkOf = proto.inkOf;
  proto.inkOf = function (this: unknown, g: number | string): number {
    const id = inkOf.call(this, g);
    if (!names.has(id)) names.set(id, String(g));
    return id;
  };
  return names;
}

const f = (v: readonly number[]): string => v.map((x) => x.toFixed(3)).join(', ');

export function main(name: string, log: (line: string) => void, opts: { pairs?: boolean; min?: number } = {}): number {
  const scn = findScenario(name);
  if (!scn) {
    log(`no scenario named '${name}'`);
    return 1;
  }
  const inks = opts.pairs ? nameInks() : new Map<number, string>();
  const built = buildScenario(scn);
  const shape = resolveShape(built.world, built.terrain, scenarioResolveOptions(scn));
  const pairs = coplanarPairs(shape);
  const min = opts.min ?? 0;
  log(`${name}: faces in one plane, facing one way, overlapping, with different ink ids (structures and layers)`);
  log(`  ${'who / who'.padEnd(46)} ${'pairs'.padStart(6)} ${'area'.padStart(8)}   e.g. at`);
  for (const [label, s] of summarise(pairs, min)) log(`  ${label.padEnd(46)} ${String(s.pairs).padStart(6)} ${s.area.toFixed(3).padStart(8)}   ${s.at.map((x) => x.toFixed(2)).join(', ')}`);
  if (opts.pairs) {
    const shown = pairs.filter((q) => q.area >= min).sort((x, y) => (x.a + x.b).localeCompare(y.a + y.b) || y.area - x.area);
    for (const p of shown) {
      log(`  ${p.a} [${inks.get(p.inkA) ?? p.inkA}] / ${p.b} [${inks.get(p.inkB) ?? p.inkB}]  area ${p.area.toFixed(4)} shared ${p.shared.toFixed(5)}  n ${f(p.normal)}`);
      log(`      A ${p.triA.map((v) => `(${f(v)})`).join(' ')}`);
      log(`      B ${p.triB.map((v) => `(${f(v)})`).join(' ')}`);
    }
  }
  return 0;
}
