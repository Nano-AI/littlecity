// Grow a town on generator 2's islands (design section 6, "Terrain, second
// generation"): rivers, steep ground, archipelagos. The same promises as on
// generator 1 (legal, deterministic, fast, connected) and a showcase that
// uses what these islands have: bridges over every river, and every role of
// part R somewhere across ten islands.
//
// Written for the kind of island, not exact cells: the terrain generator is
// still being tuned, so nothing here names a column.

import { describe, expect, test, vi } from 'vitest';
import { key } from '@/core/grid';
import type { Terrain } from '@/core/world';
import { resolveShape, resolveTown } from '@/resolve/index';
import { generateTerrain } from '@/terrain/terrain';
import { generateIsland2 } from '@/terrain/terrain2';
import { applyEdit, emptyWorld, type World } from '@/world/world';
import { growTown, planTown } from './index';

vi.setConfig({ testTimeout: 300_000 });

function build(t: Terrain, edits: ReturnType<typeof growTown>): World {
  let w = emptyWorld(t.seed, 2);
  for (const e of edits) w = applyEdit(w, t, e);
  return w;
}

/** Roles a town shows. */
function rolesOf(w: World, t: Terrain): Set<string> {
  return new Set([...resolveShape(w, t).roles.values()].map((r) => r.role));
}

describe('grow a town on generator 2', () => {
  test('seeds 1 to 50: every edit legal, none throws; sizes reported', () => {
    const sizes: string[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const t = generateTerrain(seed, 2);
      const edits = growTown(t, seed);
      let w!: World;
      expect(() => (w = build(t, edits)), `seed ${seed}`).not.toThrow();
      sizes.push(`${seed}:${w.blocks.size}`);
      expect(w.blocks.size, `seed ${seed}`).toBeGreaterThan(180);
    }
    console.log(`generator 2 town sizes (seed:blocks): ${sizes.join(' ')}`);
  });

  test('deterministic, and under 200 ms', () => {
    const t = generateTerrain(12, 2);
    expect(JSON.stringify(growTown(t, 12))).toBe(JSON.stringify(growTown(t, 12)));
    for (const seed of [3, 11, 19, 27]) {
      const ts = generateTerrain(seed, 2);
      let ms = Infinity;
      for (let run = 0; run < 3; run++) {
        const t0 = performance.now();
        growTown(ts, seed);
        ms = Math.min(ms, performance.now() - t0);
      }
      expect(ms, `seed ${seed}`).toBeLessThan(200);
    }
  });

  test('seeds 1 to 10: every role somewhere, 30 or more in each town, a stone bridge wherever there is a river', () => {
    const seen = new Map<string, number[]>();
    for (let seed = 1; seed <= 10; seed++) {
      const isl = generateIsland2(seed, (s) => generateTerrain(s, 1));
      const t = generateTerrain(seed, 2);
      const roles = rolesOf(build(t, growTown(t, seed)), t);
      expect(roles.size, `seed ${seed}`).toBeGreaterThanOrEqual(30);
      expect(roles.has('town-hall'), `seed ${seed}: a town hall`).toBe(true);
      if (isl.rivers > 0) expect(roles.has('stone-bridge'), `seed ${seed} (${isl.character}, ${isl.rivers} rivers): a stone bridge`).toBe(true);
      for (const r of roles) seen.set(r, [...(seen.get(r) ?? []), seed]);
    }
    console.log(`generator 2 role coverage, seeds 1–10:\n${[...seen].map(([r, s]) => `${r.padEnd(18)} ${s.join(' ')}`).join('\n')}`);
    // Every role of part R (the list and its exhaustiveness check live in townmaker.test.ts).
    const want = [
      'chapel', 'keepers-cottage', 'mill-house', 'stilt-house', 'boathouse', 'inn', 'shop', 'manor', 'townhouse', 'row-house',
      'cliff-house', 'greenhouse', 'lookout-cottage', 'cottage', 'town-hall', 'steeple', 'castle-turret', 'clock-tower',
      'observatory', 'dovecote', 'campanile', 'watchtower', 'lighthouse', 'windmill', 'temple', 'gatehouse', 'keep',
      'grand-steps', 'quay-wall', 'plinth', 'terrace', 'stone-bridge', 'sky-bridge', 'flying-buttress', 'gateway', 'loggia',
      'viaduct', 'quay', 'pier', 'boardwalk', 'jetty', 'palm', 'willow', 'pine', 'planter-tree', 'fruit-tree', 'grove-tree',
      'round-tree', 'cypress', 'bush', 'tiered-fountain', 'well', 'birdbath', 'basin', 'fish-stall', 'flower-stall',
      'market-stall', 'wheat-field', 'herb-garden', 'reed-bed', 'park-lawn', 'kitchen-garden', 'flower-garden',
      'picket-fence', 'rope-fence', 'iron-railing', 'stone-balustrade', 'low-wall', 'garden-wall', 'curtain-wall',
    ];
    expect(want.filter((r) => !seen.has(r))).toEqual([]);
  });

  test('a town split by a river is still one town on foot: most houses reach the square', () => {
    let checked = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const isl = generateIsland2(seed, (s) => generateTerrain(s, 1));
      if (isl.rivers === 0) continue;
      const t = generateTerrain(seed, 2);
      const plan = planTown(t, seed);
      const w = build(t, plan.edits);
      const town = resolveTown(w, t);
      const nav = town.dressing.nav;
      const sq = plan.square!;
      // Any plaza cell of the square: the walkers' part the square is in.
      let part = -1;
      for (let dz = -2; dz <= 2 && part < 0; dz++) {
        for (let dx = -2; dx <= 2 && part < 0; dx++) {
          const n = nav.nodeAt.get(key(sq.x + dx, sq.h, sq.z + dz));
          if (n !== undefined && w.floors.get(key(sq.x + dx, sq.h, sq.z + dz)) === 'plaza') part = nav.part[n]!;
        }
      }
      expect(part, `seed ${seed}: the square is walkable`).toBeGreaterThanOrEqual(0);
      let houses = 0, reach = 0;
      for (const s of town.shape.structures.values()) {
        if (s.kind !== 'house') continue;
        const doors = nav.doorsOf.get(s.id) ?? [];
        if (doors.length === 0) continue;
        houses++;
        if (doors.some((d) => nav.doors[d]!.node >= 0 && nav.part[nav.doors[d]!.node] === part)) reach++;
      }
      // Houses on both banks: the river does not cut the town in two.
      expect(reach / houses, `seed ${seed}: ${reach} of ${houses} houses reach the square`).toBeGreaterThan(0.6);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });
});
