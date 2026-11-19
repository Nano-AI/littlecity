// STUB (Stage 0). Owner: Interface (Stage 1).
//
// The gallery shell: lists what discovery found. The Interface owner turns
// it into the real gallery (every generator, part and prop in isolation,
// with sliders bound to the style modules from allStyles()).

import { allStyles } from '@/core/style';
import { ALL_KINDS, FLOOR_KINDS } from '@/core/kinds';
import { allGenerators, allParts } from '@/gen/discover';
import { allBehaviours, allSystems } from '@/life/discover';
import { allFacts, allRules } from '@/resolve/engine/discover';
import { allScenarios } from '@/scenario/discover';

const root = document.getElementById('gallery')!;
const section = (title: string, rows: string[][]): void => {
  const h = document.createElement('h2');
  h.textContent = `${title} (${rows.length})`;
  h.style.fontSize = '15px';
  const table = document.createElement('table');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.append(td);
    }
    table.append(tr);
  }
  root.append(h, table);
};

const generators = allGenerators();
section('Generators', [...ALL_KINDS, ...FLOOR_KINDS].map((k) => [k, generators.has(k) ? 'real' : 'placeholder box']));
section('Layers', generators.layers().map((l) => [l.layer]));
section('Parts', allParts().list().map((p) => [p.category, p.type]));
section('Rules', allRules().map((r) => [r.id, r.part, `tier ${r.tier}`, `priority ${r.priority}`, r.about ?? '']));
section('Facts', allFacts().map((f) => [f.factName]));
section('Behaviours', allBehaviours().map((b) => [b.category, b.type]));
section('Systems', allSystems().map((s) => [s.id]));
section('Scenarios', allScenarios().map((e) => [e.scenario.name, e.file, e.scenario.about ?? '']));
section('Style modules', allStyles().map((s) => [s.name, Object.keys(s.values).join(', ')]));
