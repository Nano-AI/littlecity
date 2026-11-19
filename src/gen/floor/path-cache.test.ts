// The path generator reuses each cell's mesh while the cell's inputs are
// unchanged (Polish). After every one of many random legal edits, a warm
// build of each path region must equal a cold one, byte for byte.

import { describe, expect, test } from 'vitest';
import { registriesFor } from '@/render/registries';
import { resolveShape } from '@/resolve/index';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { randomEdit } from '@/scenario/edits';
import { applyEdit } from '@/world/world';
import type { MeshData } from '../mesh';
import { forgetPathCells } from './path.gen';

const bytes = (m: MeshData): number[] =>
  [m.position, m.normal, m.color, m.pattern, m.inkId, m.edge, m.sway].flatMap((a) => [...new Uint8Array(a.buffer, a.byteOffset, a.byteLength)]);

describe('path cells kept across builds', () => {
  test('warm builds equal cold builds over 120 random edits', () => {
    const scn = findScenario('everything')!;
    const b = buildScenario(scn);
    const opts = scenarioResolveOptions(scn);
    let world = b.world;
    for (let i = 0; i < 120; i++) {
      const e = randomEdit(world, b.terrain, 21, i);
      if (e) world = applyEdit(world, b.terrain, e);
      const shape = resolveShape(world, b.terrain, opts);
      const reg = registriesFor(shape);
      const paths = [...shape.structures.values()].filter((s) => s.kind === 'path');
      const warm = paths.map((s) => reg.generators.build(s, shape, reg.parts).mesh);
      forgetPathCells();
      const cold = paths.map((s) => reg.generators.build(s, shape, reg.parts).mesh);
      paths.forEach((s, k) => expect(bytes(warm[k]!), `edit ${i}, path ${s.id}`).toEqual(bytes(cold[k]!)));
    }
  }, 240_000);
});
