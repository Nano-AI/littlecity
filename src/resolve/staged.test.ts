// The staged resolver (Review Focus 1), determinism and locality of hashes.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import type { World } from '@/core/world';
import { buildScenario, flatTerrain, TownBuilder } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { emptyWorld } from '@/world/world';
import { resolveShape } from './index';
import { createStagedResolver, diffShapes } from './staged';

const terrain = flatTerrain(8);
const start = new TownBuilder(emptyWorld(8), terrain).house(10, 10, { floors: 2, w: 2 }).path(9, 12, 14, 12).world;
const add = (w: World, x: number, z: number): World => new TownBuilder(w, terrain).put('auto', x, z).world;

describe('staged resolve', () => {
  test('staged resolve drops stale dressing: the newest edit wins, nothing flickers back', () => {
    const r = createStagedResolver(terrain);
    expect(r.shape).toBeNull();
    expect(r.poll()).toBeNull();
    const w1 = add(start, 20, 20);
    const w2 = add(w1, 21, 20);
    const s1 = r.update(w1);
    const s2 = r.update(w2); // a second edit before the first one's dressing
    expect(s1.world).toBe(w1);
    expect(r.shape).toBe(s2);
    const ready = r.poll();
    expect(ready?.shape).toBe(s2);
    expect(ready?.shape.world).toBe(w2);
    expect(r.poll()).toBeNull(); // delivered once
    const w3 = add(w2, 22, 20);
    r.update(w3);
    expect(r.poll()?.shape.world).toBe(w3);
    expect(r.poll()).toBeNull();
  });

  test('preview does not disturb update and poll', () => {
    const r = createStagedResolver(terrain);
    const s1 = r.update(start);
    const ghost = r.preview(add(start, 30, 30));
    expect(ghost.world.blocks.size).toBe(start.blocks.size + 1);
    expect(r.shape).toBe(s1);
    expect(r.poll()?.shape).toBe(s1);
  });

  test('updating with the same world is free and queues nothing new', () => {
    const r = createStagedResolver(terrain);
    const s = r.update(start);
    r.poll();
    expect(r.update(start)).toBe(s);
    expect(r.poll()).toBeNull();
  });

  test('unchanged structures keep their object; diffShapes lists what changed', () => {
    const r = createStagedResolver(terrain);
    const a = r.update(start);
    const house = a.structureAt.get(key(10, 1, 10))!;
    const b = r.update(add(start, 30, 30));
    expect(b.structures.get(house)).toBe(a.structures.get(house));
    const d = diffShapes(a, b);
    expect(d.added).toHaveLength(1);
    expect(d.changed).toEqual([]);
    expect(d.removed).toEqual([]);
    const c = r.update(add(b.world, 12, 10)); // touches the house
    const d2 = diffShapes(b, c);
    expect(d2.changed).toContain(house);
    expect(diffShapes(null, a).added).toHaveLength(a.structures.size);
  });
});

describe('content hashes', () => {
  test('same world, same hashes', () => {
    const { world, terrain: t } = buildScenario(findScenario('harbour-sketch')!);
    const a = resolveShape(world, t);
    const b = resolveShape(world, t);
    expect(a.hash).toBe(b.hash);
    for (const [id, s] of a.structures) expect(b.structures.get(id)!.hash).toBe(s.hash);
    // A copy of the world built separately hashes the same too.
    const again = buildScenario(findScenario('harbour-sketch')!);
    expect(resolveShape(again.world, again.terrain).hash).toBe(a.hash);
  });

  test('far edit leaves hash unchanged', () => {
    const { world, terrain: t } = buildScenario(findScenario('bench-2000')!);
    const before = resolveShape(world, t, { skipTownWide: true });
    // An edit in the far corner: every structure more than 8 cells away keeps its hash.
    const after = resolveShape(new TownBuilder(world, t).put('auto', 43, 43).world, t, { skipTownWide: true });
    let compared = 0;
    for (const [id, s] of before.structures) {
      const far = s.cells.every((c) => Math.max(Math.abs((c & 63) - 43), Math.abs(((c >> 6) & 63) - 43)) > 8);
      if (!far || s.cells.length === 0) continue;
      expect(after.structures.get(id)?.hash, `structure ${id}`).toBe(s.hash);
      compared++;
    }
    expect(compared).toBeGreaterThan(100);
  });
});
