// L59, the harvest, really cut: a mown cell of the field has no standing
// wheat in it and has stubble; half mown, the wheat stands only in the half
// not mown; the rows only ever go down within a harvest; every sheaf carried
// came off a stook and the stooks are what is left; the same seed mows the
// same field.

import { describe, expect, test } from 'vitest';
import { keyX, keyY, keyZ, CELL_H, type CellKey } from '@/core/grid';
import { plantGarden } from '@/gen/floor/garden.gen';
import { WHEAT_ROWS, type WheatState } from '@/gen/floor/gardens';
import { MeshBuilder, type MeshData } from '@/gen/mesh';
import harvestTown from '../../../scenarios/life/L59.harvest.scenario';
import { clock, scenarioTown, watch } from '../people/testing';
import { SHEAVES, type HarvestChain } from './chains/harvest';
import { createLivingTown } from './index';

const where = scenarioTown(harvestTown);
const field = [...where.shape.structures.values()].find((s) => where.shape.roles.get(s.id)?.role === 'wheat-field')!;

/** Vertices of an ink in a cell (inside it, off its edges), above the ground by more than `over`. */
function inCell(mesh: MeshData, ink: number, cell: CellKey, over = 0): number {
  const x0 = keyX(cell), z0 = keyZ(cell), y0 = keyY(cell) * CELL_H;
  let n = 0;
  for (let v = 0; v < mesh.inkId.length; v++) {
    if (mesh.inkId[v] !== ink) continue;
    const x = mesh.position[v * 3]!, y = mesh.position[v * 3 + 1]!, z = mesh.position[v * 3 + 2]!;
    if (x > x0 + 0.02 && x < x0 + 0.98 && z > z0 + 0.02 && z < z0 + 0.98 && y > y0 + over) n++;
  }
  return n;
}

function drawField(state: (cell: CellKey) => WheatState): { mesh: MeshData; wheat: number; stubble: number } {
  const b = new MeshBuilder({ ink: field.id });
  plantGarden(b, field, where.shape, state);
  return { mesh: b.build(), wheat: b.inkOf('wheat'), stubble: b.inkOf('stubble') };
}

function harvest(seconds: number, each?: (h: HarvestChain) => void) {
  const c = clock(where.world.seed, 'day');
  const t = createLivingTown({ seed: where.world.seed });
  t.sync(where.shape, where.dressing, c.time);
  const w = watch(t.crowd, { maxStuck: 12 });
  const h = t.board.chains.find((x) => x.id === 'harvest') as HarvestChain;
  let lifted = 0;
  const was = new Map<object, string | null>();
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    each?.(h);
    for (const p of t.crowd.people) {
      const before = was.get(p) ?? null;
      if (p.load === 'sheaf' && before !== 'sheaf' && p.goal?.errand?.tag === 'harvest:lift') lifted++;
      was.set(p, p.load);
    }
  }
  return { t, w, h, lifted };
}

describe('L59 the harvest, cut', () => {
  test('a mown cell has no standing wheat and has stubble; half mown, the wheat stands in the other half only', () => {
    const cell = field.cells.find((c) => !where.shape.kinds.has(c))!;
    const standing = drawField(() => ({ growth: 1, cut: 0, from: 0 }));
    expect(inCell(standing.mesh, standing.wheat, cell, 0.06)).toBeGreaterThan(0);
    expect(inCell(standing.mesh, standing.stubble, cell)).toBe(0);

    const mown = drawField((c) => ({ growth: 1, cut: c === cell ? WHEAT_ROWS : 0, from: 0 }));
    expect(inCell(mown.mesh, mown.wheat, cell)).toBe(0);
    expect(inCell(mown.mesh, mown.stubble, cell)).toBeGreaterThan(0);
    // Stubble is short: nothing of it stands taller than a few centimetres.
    const y0 = keyY(cell) * CELL_H;
    for (let v = 0; v < mown.mesh.inkId.length; v++) if (mown.mesh.inkId[v] === mown.stubble) expect(mown.mesh.position[v * 3 + 1]! - y0).toBeLessThan(0.12);

    // Half mown from the north: standing wheat only in the southern half of the cell.
    const half = drawField((c) => ({ growth: 1, cut: c === cell ? WHEAT_ROWS / 2 : 0, from: 0 }));
    const z0 = keyZ(cell), x0 = keyX(cell);
    for (let v = 0; v < half.mesh.inkId.length; v++) {
      if (half.mesh.inkId[v] !== half.wheat) continue;
      const x = half.mesh.position[v * 3]!, z = half.mesh.position[v * 3 + 2]!;
      if (x > x0 + 0.02 && x < x0 + 0.98 && z > z0 && z < z0 + 1) expect(z).toBeGreaterThan(z0 + 0.5 - 1e-4);
    }
    expect(inCell(half.mesh, half.stubble, cell)).toBeGreaterThan(0);
    // Ploughed in early spring: no wheat at all.
    const ploughed = drawField(() => ({ growth: 0, cut: 0, from: 0 }));
    expect(inCell(ploughed.mesh, ploughed.wheat, cell)).toBe(0);
  });

  test('the rows only go down within a harvest; every sheaf carried came off a stook; the stooks are what is left', () => {
    const last = new Map<CellKey, number>();
    let backwards = 0, cutting = 0;
    const { w, h, t, lifted } = harvest(240, (h) => {
      for (const f of h.fields)
        for (const [cell, n] of f.cut) {
          if (n < (last.get(cell) ?? 0)) backwards++;
          if (n > 0 && n < WHEAT_ROWS) cutting++;
          last.set(cell, n);
        }
    });
    expect(w.problems).toEqual([]);
    expect(backwards).toBe(0);
    // Seen part mown: the rows came down a few at a time, not a cell at once.
    expect(cutting).toBeGreaterThan(30);
    const f = h.fields[0]!;
    const finished = [...f.cut.values()].filter((n) => n >= WHEAT_ROWS).length;
    expect(finished).toBeGreaterThanOrEqual(2);
    const left = [...f.stooks.values()].reduce((n, s) => n + t.board.count(s, 'sheaf'), 0);
    expect(lifted).toBeGreaterThanOrEqual(1);
    expect(lifted).toBe(finished * SHEAVES - left);
  });

  test('the same seed mows the same field', () => {
    const cuts = (): string => {
      const { h } = harvest(120);
      return h.fields.map((f) => [...f.cut].sort((a, b) => a[0] - b[0]).map(([c, n]) => `${c}:${n}:${f.from.get(c)}`).join(',')).join('|');
    };
    const a = cuts();
    expect(a.length).toBeGreaterThan(0);
    expect(cuts()).toBe(a);
  });
});
