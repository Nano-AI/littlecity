// The damage treatment (mischief): every kind in every state gives sound
// geometry, the same ruin always breaks the same way, and the chunks the
// blast animation flies are exactly what the heap is baked from.

import { describe, expect, test } from 'vitest';
import { resetStyles } from '@/core/style';
import { type PlacedKind } from '@/core/kinds';
import { validateMesh } from '@/gen/checks';
import type { GeneratorRegistry } from '@/gen/api';
import { allGenerators, allParts } from '@/gen/discover';
import { resolveShape } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { packRuin } from '@/world/damage';
import { emptyWorld } from '@/world/world';
import { blastChunks, damageOutput, intactCache, withDamage } from './damage';
import { restMatrix } from './debris';

const STATES = [
  packRuin({ stage: 1, cause: 'fire' }),
  packRuin({ stage: 2, cause: 'fire' }),
  packRuin({ stage: 3, cause: 'fire' }),
  packRuin({ stage: 1, cause: 'blast' }),
  packRuin({ stage: 2, cause: 'blast' }),
  packRuin({ stage: 3, cause: 'blast' }),
  packRuin({ stage: 3, cause: 'blast', settling: true }),
  packRuin({ stage: 3, cause: 'fire', mending: true }),
  packRuin({ stage: 1, cause: 'fire', mending: true }),
  packRuin({ stage: 0, cause: 'fire', mending: true }),
];
const KINDS: PlacedKind[] = ['house', 'tower', 'lighthouse', 'windmill', 'marble', 'pillar', 'stall', 'fountain', 'tree', 'fence'];
const terrain = flatTerrain(3);

function damaged(kind: PlacedKind, ruin: number, floors = 2) {
  const b = new TownBuilder(emptyWorld(3), terrain);
  const f = kind === 'house' || kind === 'tower' || kind === 'lighthouse' || kind === 'windmill' || kind === 'pillar' ? floors : 1;
  b.stack(kind, 10, 10, { floors: f, w: kind === 'house' ? 2 : 1, color: 2 });
  b.house(12, 10, { color: 4 });
  for (const [c] of b.world.blocks) if (b.world.blocks.get(c)!.kind === kind && (kind !== 'house' || c % 64 < 12)) b.edit({ type: 'setRuin', cell: c, ruin });
  const shape = resolveShape(b.world, terrain);
  const s = [...shape.structures.values()].find((x) => x.kind === kind && x.cells.some((c) => (c & 63) === 10))!;
  return { shape, s };
}

describe('ruins are sound geometry', () => {
  for (const kind of KINDS) {
    test(`${kind} in every state`, () => {
      for (const ruin of STATES) {
        const { shape, s } = damaged(kind, ruin);
        const out = allGenerators().build(s, shape, allParts());
        expect(validateMesh(out.mesh), `${kind} ruin ${ruin}`).toEqual([]);
        expect(out.mesh.position.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('the same ruin, the same break', () => {
  test('building a ruin twice gives the same mesh', () => {
    const { shape, s } = damaged('house', packRuin({ stage: 3, cause: 'blast' }));
    const a = allGenerators().build(s, shape, allParts()).mesh;
    const b = damageOutput((allGenerators() as GeneratorRegistry & { intact: GeneratorRegistry }).intact.build(s, shape, allParts()), s, shape).mesh;
    for (const k of Object.keys(a) as (keyof typeof a)[]) expect(Array.from(a[k] as ArrayLike<number>), String(k)).toEqual(Array.from(b[k] as ArrayLike<number>));
  });

  test('the flying chunks come to rest exactly where the heap is baked', () => {
    const settling = damaged('house', packRuin({ stage: 3, cause: 'blast', settling: true }));
    const landed = damaged('house', packRuin({ stage: 3, cause: 'blast' }));
    const reg = allGenerators() as ReturnType<typeof allGenerators> & { intact: ReturnType<typeof allGenerators> };
    const intact = reg.intact.build(settling.s, settling.shape, allParts()).mesh;
    const chunks = blastChunks(intact, settling.s, settling.shape);
    expect(chunks.length).toBeGreaterThan(10);
    // Every chunk's resting first vertex is a vertex of the landed mesh.
    const landedMesh = allGenerators().build(landed.s, landed.shape, allParts()).mesh;
    const verts = new Set<string>();
    for (let i = 0; i < landedMesh.position.length; i += 3) {
      verts.add(`${landedMesh.position[i]!.toFixed(2)},${landedMesh.position[i + 1]!.toFixed(2)},${landedMesh.position[i + 2]!.toFixed(2)}`);
    }
    let found = 0;
    for (const ch of chunks) {
      const m = restMatrix(ch);
      const v = ch.polys[0]!.v[0]!;
      const x = m[0]! * v[0]! + m[4]! * v[1]! + m[8]! * v[2]! + m[12]!;
      const y = m[1]! * v[0]! + m[5]! * v[1]! + m[9]! * v[2]! + m[13]!;
      const z = m[2]! * v[0]! + m[6]! * v[1]! + m[10]! * v[2]! + m[14]!;
      if (verts.has(`${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`)) found++;
    }
    expect(found).toBe(chunks.length);
  });
});

describe('the intact drawing is kept apart from its damage', () => {
  const A = packRuin({ stage: 2, cause: 'fire' });
  const B = packRuin({ stage: 3, cause: 'fire' });
  const arrays = (m: ReturnType<typeof allGenerators>['build'] extends (...a: never[]) => infer R ? (R extends { mesh: infer M } ? M : never) : never) => [
    Array.from(m.position),
    Array.from(m.color),
    Array.from(m.normal),
  ];

  test('a damaged build from the cache is byte-identical to a fresh one, twice', () => {
    const reg = allGenerators() as GeneratorRegistry & { intact: GeneratorRegistry };
    for (const ruin of [A, B, A]) {
      const { shape, s } = damaged('house', ruin);
      const fresh = damageOutput(reg.intact.build(s, shape, allParts()), s, shape);
      expect(arrays(reg.build(s, shape, allParts()).mesh)).toEqual(arrays(fresh.mesh));
    }
  });

  test('changing only the ruin reuses the intact drawing', () => {
    let calls = 0;
    const base = allGenerators() as GeneratorRegistry & { intact: GeneratorRegistry };
    const reg = withDamage({ ...base.intact, build: (s, p, parts) => (calls++, base.intact.build(s, p, parts)) });
    for (const ruin of [A, B]) {
      const { shape, s } = damaged('house', ruin);
      reg.build(s, shape, allParts());
    }
    expect(calls).toBe(1);
  });

  test('the same hash returns the same output', () => {
    const { shape, s } = damaged('house', A);
    const reg = allGenerators();
    expect(reg.build(s, shape, allParts())).toBe(reg.build(s, shape, allParts()));
  });

  test('the intact cache follows the style version', () => {
    let calls = 0;
    const base = allGenerators() as GeneratorRegistry & { intact: GeneratorRegistry };
    const reg = withDamage({ ...base.intact, build: (s, p, parts) => (calls++, base.intact.build(s, p, parts)) });
    const { shape, s } = damaged('house', A);
    reg.build(s, shape, allParts());
    resetStyles();
    reg.build(s, shape, allParts());
    expect(calls).toBe(2);
  });

  test('eviction keeps the newest entries', () => {
    const was = intactCache.maxFloats;
    try {
      let calls = 0;
      const base = allGenerators() as GeneratorRegistry & { intact: GeneratorRegistry };
      const reg = withDamage({ ...base.intact, build: (s, p, parts) => (calls++, base.intact.build(s, p, parts)) });
      const one = damaged('house', A);
      const two = damaged('tower', A);
      const parts = allParts();
      intactCache.maxFloats = 1;
      reg.build(one.s, one.shape, parts);
      reg.build(two.s, two.shape, parts); // evicts the house, keeps itself
      reg.build(two.s, two.shape, parts);
      expect(calls).toBe(2);
      reg.build(one.s, one.shape, parts); // the house was evicted
      expect(calls).toBe(3);
    } finally {
      intactCache.maxFloats = was;
    }
  });
});
