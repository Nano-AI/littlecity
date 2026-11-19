import { describe, expect, test } from 'vitest';
import { edgeKey } from '@/core/grid';
import { findDuplicateFaces, inkGroups, triangleCount, validateMesh } from '@/gen/checks';
import { buildRun } from '@/parts/ground/runs';
import fence from './fence.gen';
import { blockStructure, edgeParts, edgeStructure, town } from './testing';

/** Triangle budgets per cell of run, by style. */
const BUDGET = { 'picket-fence': 160, 'rope-fence': 160, 'iron-railing': 220, 'stone-balustrade': 320 } as const;

describe('the shape of a run (J20)', () => {
  test('a straight run of cell pieces is one stretch between two end posts, and spans its cells', () => {
    const plan = town((b) => { for (let x = 10; x <= 13; x++) b.put('fence', x, 10); });
    const run = buildRun(blockStructure(plan, 10, 1, 10), plan);
    expect(run.nodes.map((n) => n.kind)).toEqual(['post', 'post']);
    expect(run.segments).toHaveLength(1);
    expect(run.segments[0]!.axis).toBe('x');
    expect(run.segments[0]!.length).toBeCloseTo(3 + 2 * 0.42, 6);
  });

  test('a lone piece is a short run across its cell with a post at each end', () => {
    const plan = town((b) => b.put('fence', 10, 10));
    const run = buildRun(blockStructure(plan, 10, 1, 10), plan);
    expect(run.nodes.map((n) => n.kind)).toEqual(['post', 'post']);
    expect(run.segments[0]!.length).toBeCloseTo(0.84, 6);
  });

  test('corners, tees and crossings get a joint; free ends a post', () => {
    const plan = town((b) => {
      for (let x = 10; x <= 14; x++) b.put('fence', x, 10);
      for (let z = 8; z <= 12; z++) if (z !== 10) b.put('fence', 12, z);
      b.put('fence', 14, 11);
    });
    const run = buildRun(blockStructure(plan, 10, 1, 10), plan);
    const kinds = run.nodes.map((n) => n.kind).sort();
    // The crossing at (12, 10) and the corner at (14, 10); four free ends.
    expect(kinds).toEqual(['joint', 'joint', 'post', 'post', 'post', 'post']);
    expect(run.segments).toHaveLength(5);
  });

  test('a run between two houses goes into both walls and has no posts', () => {
    const plan = town((b) => {
      b.house(9, 10).house(13, 10);
      for (let x = 10; x <= 12; x++) b.put('fence', x, 10);
    });
    const run = buildRun(blockStructure(plan, 10, 1, 10), plan);
    expect(run.nodes.map((n) => n.kind)).toEqual(['butt', 'butt']);
    expect(run.segments[0]!.length).toBeCloseTo(3 + 2 * 0.1, 6);
  });

  test('a gate splits the run; a ring of edge pieces is four stretches between four corner joints', () => {
    const gated = town((b) => {
      for (let x = 10; x <= 14; x++) b.put('fence', x, 10);
      b.path(12, 8, 12, 12);
    });
    const run = buildRun(blockStructure(gated, 10, 1, 10), gated);
    expect(run.nodes.map((n) => n.kind)).toEqual(['post', 'gate', 'post']);
    expect(run.segments).toHaveLength(2);

    const ringed = town((b) => b.fenceAround(10, 10, 11, 11));
    const ring = buildRun(edgeStructure(ringed, edgeKey(10, 1, 11, 'S')), ringed);
    expect(ring.nodes.map((n) => n.kind)).toEqual(['joint', 'joint', 'joint', 'joint']);
    expect(ring.segments.map((s) => s.length)).toEqual([2, 2, 2, 2]);
  });

  test('an edge run that points at a house wall ends in it (run-end/butt); on open ground it keeps its post', () => {
    const plan = town((b) => {
      b.house(10, 10, { w: 2 });
      for (let z = 11; z <= 12; z++) b.fenceEdge(10, z, 'E');
    });
    const run = buildRun(edgeStructure(plan, edgeKey(10, 1, 11, 'E')), plan);
    expect(run.nodes.map((n) => n.kind)).toEqual(['butt', 'post']);
    expect(run.segments[0]!.length).toBeCloseTo(2.1, 6);
  });
});

describe('the fence generator', () => {
  test('a picket run is one ink group, sound, with no doubled faces, in budget', () => {
    const plan = town((b) => {
      for (let x = 10; x <= 15; x++) b.put('fence', x, 10);
      b.put('fence', 15, 11).put('fence', 15, 12);
    });
    const s = blockStructure(plan, 10, 1, 10);
    expect(plan.roles.get(s.id)?.role).toBe('picket-fence');
    const { mesh } = fence.build(s, plan, edgeParts);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(inkGroups(mesh).size).toBe(1);
    expect(triangleCount(mesh)).toBeGreaterThan(8 * 60);
    expect(triangleCount(mesh)).toBeLessThan(8 * BUDGET['picket-fence']);
  });

  test('every style: one ink group, sound, no doubled faces, in budget', () => {
    const plan = town((b) => {
      b.fill('house', 10, 10, 14, 10, { color: 1 });
      b.fill('marble', 10, 13, 14, 13);
      for (let x = 10; x <= 14; x++) b.put('arch', x, 16);
      for (const z of [10, 13, 16]) for (let x = 10; x <= 14; x++) b.put('fence', x, z);
    });
    const cases = [[10, 'iron-railing'], [13, 'stone-balustrade'], [16, 'rope-fence']] as const;
    for (const [z, role] of cases) {
      const s = blockStructure(plan, 10, 2, z);
      expect(plan.roles.get(s.id)?.role).toBe(role);
      const { mesh } = fence.build(s, plan, edgeParts);
      expect(validateMesh(mesh)).toEqual([]);
      expect(findDuplicateFaces(mesh)).toBe(0);
      expect(inkGroups(mesh).size).toBe(1);
      expect(triangleCount(mesh)).toBeLessThan(5 * BUDGET[role]);
    }
  });

  test('a gate and a ring of edge pieces are sound too, and the same town always gives the same mesh', () => {
    const build = () =>
      town((b) => {
        b.garden(10, 10, 12, 11);
        b.path(12, 10, 14, 10);
        b.fenceAround(10, 10, 12, 11);
      });
    const plan = build();
    const s = edgeStructure(plan, edgeKey(10, 1, 11, 'S'));
    expect(plan.features.filter((f) => f.type === 'gate' && f.structure === s.id)).toHaveLength(1);
    const { mesh } = fence.build(s, plan, edgeParts);
    expect(validateMesh(mesh)).toEqual([]);
    expect(findDuplicateFaces(mesh)).toBe(0);
    expect(inkGroups(mesh).size).toBe(1);
    const again = build();
    expect(fence.build(edgeStructure(again, edgeKey(10, 1, 11, 'S')), again, edgeParts).mesh.position).toEqual(mesh.position);
  });
});

describe('the railing part (J19)', () => {
  test('railings in a row share one ink group and their posts', () => {
    const plan = town((b) => {
      b.fill('marble', 10, 10, 12, 10, { floors: 2 });
      b.plaza(10, 10, 12, 10);
    });
    const rails = plan.features.filter((f) => f.type === 'railing');
    expect(rails).toHaveLength(8);
    const ids = new Set<number>();
    let triangles = 0;
    for (const f of rails) {
      const out = edgeParts.feature(f, { plan, structure: plan.structures.get(f.structure) });
      expect(validateMesh(out.mesh)).toEqual([]);
      expect(findDuplicateFaces(out.mesh)).toBe(0);
      for (const id of inkGroups(out.mesh).keys()) ids.add(id);
      triangles += triangleCount(out.mesh);
    }
    expect(ids.size).toBe(1);
    expect(triangles).toBeLessThan(8 * BUDGET['stone-balustrade']);
    // Eight railings round a 3 × 1 block: eight places where two meet, so eight posts, one each.
    const posts = rails.reduce((n, f) => {
      const p = f.params as { from: number; to: number };
      return n + [p.from, p.to].filter((c) => c === 1 || c === 2 || c === 4 || c === 6).length;
    }, 0);
    expect(posts).toBe(8);
  });
});
