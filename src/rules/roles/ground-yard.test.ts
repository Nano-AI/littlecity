import { describe, expect, test } from 'vitest';
import { columnIndex, key, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { resolveTown } from '@/resolve/index';
import { courtyards } from '@/resolve/facts/courtyards.fact';
import { TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { yardAt } from './ground-yard';

function facts(build: (b: TownBuilder) => void, terrain: (t: TerrainBuilder) => void = (t) => t.flat(1)) {
  const t = new TerrainBuilder(4);
  terrain(t);
  const ground = t.build();
  const b = new TownBuilder(emptyWorld(4), ground);
  build(b);
  return resolveTown(b.world, ground, { rules: [] }).shape.facts;
}

describe('yardAt: the courtyards fact, asked one cell at a time', () => {
  const TOWNS: Record<string, { build: (b: TownBuilder) => void; terrain?: (t: TerrainBuilder) => void }> = {
    'a yard ringed by marble': { build: (b) => b.fill('marble', 10, 10, 14, 10).fill('marble', 10, 14, 14, 14).fill('marble', 10, 11, 10, 13).fill('marble', 14, 11, 14, 13) },
    'a yard with a gap': { build: (b) => b.fill('marble', 10, 10, 14, 10).fill('marble', 10, 14, 14, 14).fill('marble', 10, 11, 10, 13).fill('marble', 14, 11, 14, 12) },
    'fenced and walled plots': { build: (b) => b.fenceAround(20, 20, 22, 21).fenceAround(26, 20, 27, 21, 'wall').put('tree', 21, 20).garden(26, 20, 27, 21) },
    'a plot too big to be a courtyard': { build: (b) => b.fenceAround(10, 20, 14, 23, 'wall') },
    'cell walls and houses': { build: (b) => b.house(30, 10, { w: 3 }).house(30, 12, { w: 3 }).put('wall', 30, 11).put('wall', 32, 11).put('fountain', 31, 11) },
    'a hollow in a hill, and a ledge': {
      build: (b) => b.put('tree', 20, 20),
      terrain: (t) => {
        t.flat(1);
        t.rect(18, 18, 22, 22, 3);
        t.rect(20, 20, 20, 20, 1); // closed by cliffs on all sides
        t.rect(30, 18, 32, 20, 2); // a one-level step leaks
      },
    },
  };

  test.each(Object.keys(TOWNS))('%s: agrees with the fact on every ground cell', (name) => {
    const f = facts(TOWNS[name]!.build, TOWNS[name]!.terrain);
    const fact = courtyards(f);
    const open = new Set<CellKey>();
    let yards = 0;
    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        const h = f.terrain.height[columnIndex(x, z)]!;
        if (h === 0) continue;
        const cell = key(x, h, z);
        const mine = yardAt(f, cell), again = yardAt(f, cell, open);
        const theirs = fact.byCell.get(cell);
        expect(mine !== null, `(${x}, ${z})`).toBe(theirs !== undefined);
        expect(again !== null).toBe(mine !== null); // the memo of open ground never changes an answer
        if (mine && theirs) {
          expect([...mine].sort((a, b) => a - b)).toEqual([...theirs.cells]);
          yards++;
        }
      }
    }
    if (name !== 'a yard with a gap' && name !== 'a plot too big to be a courtyard') expect(yards).toBeGreaterThan(0);
    else expect(yards).toBe(0);
  });
});
