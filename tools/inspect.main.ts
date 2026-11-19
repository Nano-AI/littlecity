// The body of `npm run inspect` (run through Vite by tools/inspect.mjs).

import { keyX, keyY, keyZ, unedge, type CellKey } from '@/core/grid';
import { ALL_KINDS, FLOOR_KINDS } from '@/core/kinds';
import { allGenerators, allParts } from '@/gen/discover';
import { allBehaviours, allSystems } from '@/life/discover';
import { allFacts, allRules } from '@/resolve/engine/discover';
import type { Anchor, RuleTrace } from '@/resolve/plan';
import { checkScenario, resolveScenario } from '@/scenario';
import { allScenarios, matchScenarios } from '@/scenario/discover';

type Print = (line: string) => void;
type Flags = Record<string, string | boolean>;

const at = (c: CellKey): string => `(${keyX(c)},${keyY(c)},${keyZ(c)})`;
const DIRS = ['N', 'E', 'S', 'W'];
const dir = (d: number | undefined): string => (d === undefined ? '' : ` ${DIRS[d]}`);
const pad = (s: string | number, n: number): string => String(s).padEnd(n);
const params = (p: object | undefined): string => (p && Object.keys(p).length ? ` ${JSON.stringify(p)}` : '');
const anchor = (a: Anchor | null): string =>
  !a ? 'free' : 'socket' in a ? `socket ${a.socket}` : 'from' in a ? `line ${a.from} → ${a.to}` : `${at(a.cell)} ${a.pos}${dir(a.face)}`;

function table(print: Print, rows: (string | number)[][]): void {
  if (rows.length === 0) return;
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => String(r[i] ?? '').length)));
  for (const r of rows) print(`  ${r.map((c, i) => pad(c ?? '', widths[i]!)).join('  ').trimEnd()}`);
}

function overview(print: Print): void {
  const generators = allGenerators();
  print('Scenarios');
  table(print, allScenarios().map((e) => [e.scenario.name, e.file, e.scenario.about ?? '']));
  print(`\nRules (${allRules().length}), in run order`);
  table(print, allRules().map((r) => [r.id, r.part, `tier ${r.tier}`, `priority ${r.priority}`, r.chance !== undefined ? `p=${r.chance}` : '', r.townWide ? 'town-wide' : '', r.about ?? '']));
  print(`\nFacts (${allFacts().length})`);
  table(print, allFacts().map((f) => [f.factName]));
  print('\nGenerators');
  table(print, [...ALL_KINDS, ...FLOOR_KINDS].map((k) => [k, generators.has(k) ? 'real' : 'placeholder']));
  print(`\nLayers: ${generators.layers().map((l) => l.layer).join(', ') || 'none'}`);
  print(`Parts (${allParts().list().length}): ${allParts().list().map((p) => `${p.category}:${p.type}`).join(', ') || 'none'}`);
  print(`Behaviours (${allBehaviours().length}): ${allBehaviours().map((b) => `${b.category}:${b.type}`).join(', ') || 'none'}`);
  print(`Systems (${allSystems().length}): ${allSystems().map((s) => s.id).join(', ') || 'none'}`);
}

export function main(name: string | undefined, flags: Flags, print: Print): number {
  if (!name) {
    overview(print);
    return 0;
  }
  const matches = matchScenarios(name);
  const entry = matches.find((e) => e.scenario.name === name) ?? (matches.length === 1 ? matches[0] : undefined);
  if (!entry) {
    print(matches.length > 1 ? `'${name}' matches several scenarios: ${matches.map((e) => e.scenario.name).join(', ')}` : `No scenario matches '${name}'. Run \`npm run inspect\` to list them.`);
    return 1;
  }
  const r = resolveScenario(entry.scenario);
  const { shape, dressing, world } = r;

  if (flags.json) {
    print(
      JSON.stringify(
        {
          scenario: entry.scenario.name,
          kinds: [...shape.kinds].map(([c, k]) => ({ cell: [keyX(c), keyY(c), keyZ(c)], placed: world.blocks.get(c)!.kind, kind: k })),
          structures: [...shape.structures.values()].map((s) => ({ ...s, role: shape.roles.get(s.id) ?? null, tags: [...(shape.tags.get(s.id) ?? [])] })),
          supports: shape.supports,
          features: shape.features,
          sockets: [...shape.sockets, ...dressing.sockets],
          props: dressing.props,
          actors: dressing.actors,
          nav: { nodes: dressing.nav.nodes.length, links: dressing.nav.links.length },
          trace: [...shape.trace, ...dressing.trace],
          hash: { shape: shape.hash, dressing: dressing.hash },
        },
        null,
        2,
      ),
    );
    return 0;
  }

  print(`Scenario ${entry.scenario.name}  (${entry.file})  seed ${world.seed}`);
  print(`  ${world.blocks.size} blocks, ${world.floors.size} floor cells, ${world.edges.size} edge pieces`);
  print(`  shape hash ${shape.hash.toString(16)}  dressing hash ${dressing.hash.toString(16)}`);

  print('\nKinds (placed → resolved)');
  const kindCounts = new Map<string, number>();
  for (const [c, k] of shape.kinds) {
    const label = `${world.blocks.get(c)!.kind} → ${k}`;
    kindCounts.set(label, (kindCounts.get(label) ?? 0) + 1);
  }
  table(print, [...kindCounts].sort().map(([label, n]) => [label, n]));
  if (flags.cells) {
    table(print, [...shape.kinds].sort((a, b) => a[0] - b[0]).map(([c, k]) => [at(c), world.blocks.get(c)!.kind, '→', k, `structure ${shape.structureAt.get(c)}`]));
  }

  print(`\nStructures (${shape.structures.size})`);
  table(
    print,
    [...shape.structures.values()]
      .sort((a, b) => a.id - b.id)
      .map((s) => {
        const role = shape.roles.get(s.id);
        const where = s.cells.length ? at(s.cells[0]!) : `edge ${at(unedge(s.edges[0]!).cell)} ${unedge(s.edges[0]!).side}`;
        return [
          `#${s.id}`,
          s.kind,
          `${s.cells.length} cells${s.edges.length ? ` + ${s.edges.length} edges` : ''}`,
          `from ${where}`,
          `colour ${s.color}`,
          role ? `role ${role.role} [${role.rule}]` : 'no role',
          [...(shape.tags.get(s.id) ?? [])].join(' '),
          `hash ${s.hash.toString(16)}`,
        ];
      }),
  );

  print(`\nSupports (${shape.supports.length})`);
  table(print, shape.supports.map((s) => [s.type, `carries ${at(s.carries)}`, `down to level ${s.bottomY}`, s.against !== undefined ? `against ${DIRS[s.against]}` : '', s.arcadeTo?.length ? `arcade ${s.arcadeTo.map((d) => DIRS[d]).join('')}` : '']));

  print(`\nFeatures (${shape.features.length})`);
  table(print, shape.features.map((f) => [f.type, f.variant ?? '', `#${f.structure}`, f.cell !== undefined ? `${at(f.cell)}${dir(f.dir)}` : f.region !== undefined ? `region ${f.region}` : '', params(f.params).trim(), `[${f.rule}]`]));

  const sockets = [...shape.sockets, ...dressing.sockets];
  print(`\nSockets (${sockets.length})`);
  table(print, sockets.map((s) => [s.type, s.id, `${at(s.cell)}${dir(s.dir)}`, s.owner ? `owner ${s.owner}` : '', `[${s.rule}]`]));

  print(`\nProps (${dressing.props.length})`);
  table(print, dressing.props.map((p) => [p.type, p.variant ?? '', anchor(p.at), params(p.params).trim(), `[${p.rule}]`, p.id]));

  print(`\nActors (${dressing.actors.length})`);
  table(print, dressing.actors.map((a) => [a.type, a.variant ?? '', anchor(a.at), a.home !== undefined ? `home #${a.home}` : '', params(a.params).trim(), `[${a.rule}]`, a.id]));

  print(`\nWalking graph: ${dressing.nav.nodes.length} nodes, ${dressing.nav.links.length} links`);

  const trace: RuleTrace[] = [...shape.trace, ...dressing.trace];
  const fired = flags.rules ? trace : trace.filter((t) => t.candidates > 0);
  print(`\nRules (${trace.length} ran, ${trace.filter((t) => t.applied > 0).length} applied)${flags.rules ? '' : '  — rules with candidates; --rules shows all'}`);
  table(print, [['rule', 'part', 'candidates', 'applied', 'chance-skipped', 'claim-skipped'], ...fired.map((t) => [t.rule, t.part, t.candidates, t.applied, t.chanceSkipped, t.claimSkipped])]);

  if (entry.scenario.expect) {
    try {
      checkScenario(entry.scenario);
      print('\nexpect(): passed');
    } catch (err) {
      print(`\nexpect(): FAILED: ${(err as Error).message}`);
      return 1;
    }
  }
  return 0;
}
