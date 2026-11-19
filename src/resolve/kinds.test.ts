// K1–K5 (design section 8): every worked example, as arrangement → expected kinds.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import type { Terrain } from '@/core/world';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { explainAuto, resolveKinds } from './kinds';

const flat = flatTerrain(3); // land at height 1 on columns 4–43; open water at x ≤ 3

function town(build: (b: TownBuilder) => void, t: Terrain = flat): { b: TownBuilder; kinds: Map<number, Kind> } {
  const b = new TownBuilder(emptyWorld(3), t);
  build(b);
  return { b, kinds: resolveKinds(b.world, t) };
}
const column = (kinds: Map<number, Kind>, x: number, z: number, y0: number, y1: number): Kind[] => {
  const out: Kind[] = [];
  for (let y = y0; y <= y1; y++) out.push(kinds.get(key(x, y, z))!);
  return out;
};

describe('K1–K5 worked examples', () => {
  test('three Auto blocks stacked on open ground: all three become a tower (K4)', () => {
    const { kinds } = town((b) => b.auto(20, 20, { floors: 3 }));
    expect(column(kinds, 20, 20, 1, 3)).toEqual(['tower', 'tower', 'tower']);
  });

  test('a fourth near the sea: the run becomes a lighthouse (K3)', () => {
    const { kinds, b } = town((b) => b.auto(7, 20, { floors: 4 })); // water at x ≤ 3: within 4 columns
    expect(column(kinds, 7, 20, 1, 4)).toEqual(['lighthouse', 'lighthouse', 'lighthouse', 'lighthouse']);
    expect(explainAuto(b.world, flat, key(7, 2, 20)).rule).toBe('K3');
  });

  test('four far from the sea stay a tower; the sea must be within 4 columns', () => {
    expect(column(town((b) => b.auto(20, 20, { floors: 4 })).kinds, 20, 20, 1, 4)).toEqual(Array(4).fill('tower'));
    expect(town((b) => b.auto(8, 20, { floors: 4 })).kinds.get(key(8, 1, 20))).toBe('tower');
  });

  test('K3 needs the cell above the run empty', () => {
    const { kinds } = town((b) => b.auto(7, 20, { floors: 4 }).put('house', 7, 20));
    expect(column(kinds, 7, 20, 1, 4)).toEqual(Array(4).fill('tower'));
  });

  test('one or two Auto blocks on open ground are houses (K5)', () => {
    expect(column(town((b) => b.auto(20, 20, { floors: 2 })).kinds, 20, 20, 1, 2)).toEqual(['house', 'house']);
  });

  test('a house with a thin Auto stack rising from its roof: the free part is a tower, the rest stays house', () => {
    const { kinds } = town((b) => b.house(10, 10, { floors: 2, w: 2, d: 2, color: 1 }).auto(10, 10, { floors: 3 }));
    expect(column(kinds, 10, 10, 1, 5)).toEqual(['house', 'house', 'tower', 'tower', 'tower']);
  });

  test('an Auto stack beside a house: the part beside it is house, the free part above a tower', () => {
    const { kinds } = town((b) => b.house(10, 10, { floors: 2 }).auto(11, 10, { floors: 5 }));
    expect(column(kinds, 11, 10, 1, 5)).toEqual(['house', 'house', 'tower', 'tower', 'tower']);
  });

  test('Auto blocks bridging a gap between two solid things become an arch (K2)', () => {
    const { kinds } = town((b) => {
      b.house(10, 10, { floors: 3, color: 0 }).house(14, 10, { floors: 3, color: 0 });
      for (let x = 11; x <= 13; x++) b.block('auto', x, 3, 10);
    });
    expect([11, 12, 13].map((x) => kinds.get(key(x, 3, 10)))).toEqual(['arch', 'arch', 'arch']);
  });

  test('a span of up to 6 is valid; 7 is not', () => {
    const span = (n: number) =>
      town((b) => {
        b.house(10, 10, { floors: 2 }).house(11 + n, 10, { floors: 2 });
        for (let x = 11; x < 11 + n; x++) b.block('auto', x, 2, 10);
      }).kinds.get(key(11, 2, 10));
    expect(span(6)).toBe('arch');
    expect(span(7)).toBe('house');
  });

  test('a span along z works the same way, and placed arches count as span candidates', () => {
    const { kinds } = town((b) => {
      b.house(10, 10, { floors: 2 }).house(10, 14, { floors: 2 });
      b.block('auto', 10, 2, 11).block('arch', 10, 2, 12).block('auto', 10, 2, 13);
    });
    expect(kinds.get(key(10, 2, 11))).toBe('arch');
    expect(kinds.get(key(10, 2, 13))).toBe('arch');
  });

  test('one Auto block hung off a wall is not a valid span, so it is a house (a jettied room)', () => {
    const { kinds, b } = town((b) => b.house(10, 10, { floors: 2 }).block('auto', 11, 2, 10));
    expect(kinds.get(key(11, 2, 10))).toBe('house');
    expect(explainAuto(b.world, flat, key(11, 2, 10)).rule).toBe('K5');
  });

  test('an Auto block standing on solid ground is never a span candidate', () => {
    const { kinds } = town((b) => b.house(10, 10).house(12, 10).auto(11, 10));
    expect(kinds.get(key(11, 1, 10))).toBe('house');
  });

  test('K1: an Auto block at y = 0 on open water is a dock, even between anchors', () => {
    const { kinds } = town((b) => b.block('auto', 2, 0, 10).block('auto', 1, 0, 10));
    expect(kinds.get(key(2, 0, 10))).toBe('dock');
    expect(kinds.get(key(1, 0, 10))).toBe('dock');
  });

  test('Auto blocks never read another Auto block’s resolved kind: neighbours count by placed kind', () => {
    // An Auto stack beside an Auto block is not free (Auto is a building block), whatever that block becomes.
    const { kinds } = town((b) => b.auto(20, 20, { floors: 4 }).auto(21, 20));
    expect(column(kinds, 20, 20, 1, 4)).toEqual(['house', 'tower', 'tower', 'tower']);
    expect(kinds.get(key(21, 1, 20))).toBe('house');
    // The result does not depend on the order of placement.
    const other = town((b) => b.auto(21, 20).auto(20, 20, { floors: 4 })).kinds;
    expect(column(other, 20, 20, 1, 4)).toEqual(['house', 'tower', 'tower', 'tower']);
  });

  test('placed tower and lighthouse blocks are column candidates too; non-Auto blocks keep their kind', () => {
    const { kinds } = town((b) => b.put('tower', 20, 20).auto(20, 20, { floors: 2 }).put('marble', 25, 25));
    expect(column(kinds, 20, 20, 1, 3)).toEqual(['tower', 'tower', 'tower']);
    expect(kinds.get(key(25, 1, 25))).toBe('marble');
  });

  test('a cliff anchors a span like any solid thing', () => {
    const t = new TerrainBuilder(3).flat(1).rect(10, 4, 12, 43, 3).rect(16, 4, 18, 43, 3).build();
    const { kinds } = town((b) => {
      for (let x = 13; x <= 15; x++) b.block('auto', x, 2, 20);
    }, t);
    expect(kinds.get(key(14, 2, 20))).toBe('arch');
  });
});
