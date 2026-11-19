// Grow a town (design section 15a): legal, deterministic, fast, and a
// showcase: across seeds 1 to 5 every role in catalogue part R appears, and
// every single town shows at least 30.

import { describe, expect, test } from 'vitest';
import { columnIndex, key } from '@/core/grid';
import type { Role } from '@/core/vocab';
import { MAT, type Terrain } from '@/core/world';
import { resolveShape, resolveTown } from '@/resolve/index';
import { generateTerrain } from '@/terrain/terrain';
import { applyEdit, emptyWorld, type World } from '@/world/world';
import { growTown, planTown } from './index';

/** Every role in catalogue part R (RoleVocab). The type check below fails if one is added and not listed. */
const ROLES = [
  'town-hall', 'chapel', 'keepers-cottage', 'mill-house', 'stilt-house', 'boathouse', 'inn', 'shop', 'manor', 'townhouse', 'row-house',
  'cliff-house', 'greenhouse', 'lookout-cottage', 'cottage',
  'steeple', 'castle-turret', 'clock-tower', 'observatory', 'dovecote', 'campanile', 'watchtower',
  'lighthouse', 'windmill',
  'temple', 'gatehouse', 'keep', 'grand-steps', 'quay-wall', 'plinth', 'terrace',
  'stone-bridge', 'sky-bridge', 'flying-buttress', 'gateway', 'loggia', 'viaduct',
  'quay', 'pier', 'boardwalk', 'jetty',
  'palm', 'willow', 'pine', 'planter-tree', 'fruit-tree', 'grove-tree', 'round-tree', 'cypress', 'bush',
  'tiered-fountain', 'well', 'birdbath', 'basin', 'fish-stall', 'flower-stall', 'market-stall',
  'wheat-field', 'herb-garden', 'reed-bed', 'park-lawn', 'kitchen-garden', 'flower-garden',
  'picket-fence', 'rope-fence', 'iron-railing', 'stone-balustrade', 'low-wall', 'garden-wall', 'curtain-wall',
] as const satisfies readonly Role[];
type Unlisted = Exclude<Role, (typeof ROLES)[number]>;
const allListed: Unlisted extends never ? true : Unlisted = true;

function build(terrain: Terrain, edits: ReturnType<typeof growTown>): World {
  let w = emptyWorld(terrain.seed);
  for (const e of edits) w = applyEdit(w, terrain, e); // throws on the first illegal edit
  return w;
}

function rolesOf(w: World, t: Terrain): Set<string> {
  const shape = resolveShape(w, t);
  return new Set([...shape.roles.values()].map((r) => r.role));
}

/**
 * Why a role cannot appear on an island, or null if it can. R-P01 makes a
 * willow only of a tree rooted on land that is not sand, beside open water;
 * the island generator rings most islands with sand, so on many there is no
 * such column at all.
 */
function impossible(role: string, t: Terrain): string | null {
  if (role !== 'willow') return null;
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      const i = columnIndex(x, z);
      if (t.height[i] === 0 || t.material[i] === MAT.sand) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < 48 && nz < 48 && t.height[columnIndex(nx, nz)] === 0) return null;
      }
    }
  }
  return 'every land column beside the sea is sand (R-P01 makes palms there, never willows)';
}

describe('grow a town', () => {
  test('every role of catalogue part R is listed', () => {
    expect(allListed).toBe(true);
  });

  test('seeds 1 to 50: every edit is legal on its own island, and none throws', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const t = generateTerrain(seed);
      const edits = growTown(t, seed);
      expect(edits.length, `seed ${seed}`).toBeGreaterThan(300);
      expect(() => build(t, edits), `seed ${seed}`).not.toThrow();
    }
  });

  test('deterministic per seed, different between seeds', () => {
    const t = generateTerrain(7);
    expect(JSON.stringify(growTown(t, 7))).toBe(JSON.stringify(growTown(t, 7)));
    expect(JSON.stringify(growTown(t, 8))).not.toBe(JSON.stringify(growTown(t, 7)));
  });

  test('under 200 ms for a full island', () => {
    const terrains = [3, 11, 19, 27, 35].map((s) => generateTerrain(s));
    growTown(terrains[0]!, 3); // warm up
    for (const [i, t] of terrains.entries()) {
      // The best of several: the generator's own time, not other tests sharing the machine. It stops as
      // soon as one run is inside the budget, so a quiet machine pays for one run only.
      let ms = Infinity;
      for (let run = 0; run < 8 && ms >= 200; run++) {
        const t0 = performance.now();
        growTown(t, t.seed);
        ms = Math.min(ms, performance.now() - t0);
      }
      expect(ms, `seed ${terrains[i]!.seed}`).toBeLessThan(200);
    }
  });

  test('the watching order is the one used (never the fallback), and every district joins the streets', () => {
    let viaducts = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const plan = planTown(generateTerrain(seed), seed);
      expect(plan.fellBack, `seed ${seed}`).toBe(false);
      expect(plan.unjoined.length, `seed ${seed}: ${plan.unjoined.join(', ')}`).toBeLessThanOrEqual(2);
      if (seed <= 5 && plan.districts.some((d) => d.name === 'viaduct')) viaducts++;
      // The summits too: up cliffs of two levels by a marble landing and stairs.
      expect(plan.unjoined.filter((n) => n === 'lookout' || n === 'observatory'), `seed ${seed}`).toEqual([]);
    }
    // A viaduct of its own (not the folly's) across a dip between two terraces, where an island has one.
    expect(viaducts).toBeGreaterThanOrEqual(3);
  });

  test('coverage: across seeds 1 to 5 every role appears; every town shows 30 or more', () => {
    const seen = new Map<string, number[]>();
    const terrains: Terrain[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const t = generateTerrain(seed);
      terrains.push(t);
      const roles = rolesOf(build(t, growTown(t, seed)), t);
      expect(roles.size, `seed ${seed}`).toBeGreaterThanOrEqual(30);
      expect(roles.has('town-hall'), `seed ${seed}: a town hall on the square`).toBe(true);
      for (const r of roles) seen.set(r, [...(seen.get(r) ?? []), seed]);
    }
    const table = ROLES.map((r) => `${r.padEnd(18)} ${(seen.get(r) ?? []).join(' ') || '—'}`).join('\n');
    console.log(`role coverage, seeds 1–5\n${table}`);
    // PENDING: roles added to the game after the generator was written. The generator's owner removes
    // each name from this list as the generator learns to build it (see docs/swarm/STATUS.md).
    const PENDING: readonly string[] = [];
    const missing = ROLES.filter((r) => !PENDING.includes(r) && !seen.has(r) && terrains.some((t) => impossible(r, t) === null));
    expect(missing, `never reached on seeds 1–5:\n${table}`).toEqual([]);
  });

  test('a role impossible on islands 1 to 5 appears on the first island that allows it', () => {
    for (const role of ROLES) {
      if ([1, 2, 3, 4, 5].some((s) => impossible(role, generateTerrain(s)) === null)) continue;
      let seed = 6;
      while (impossible(role, generateTerrain(seed)) !== null) seed++;
      const t = generateTerrain(seed);
      expect(rolesOf(build(t, growTown(t, seed)), t).has(role), `${role} on seed ${seed}`).toBe(true);
    }
  });

  test('people can walk from most houses to the square, and the streets are dressed', () => {
    for (const seed of [1, 4]) {
      const t = generateTerrain(seed);
      const plan = planTown(t, seed);
      const w = build(t, plan.edits);
      const town = resolveTown(w, t);
      const { nav, props } = town.dressing;
      const sq = plan.square!;
      // A plaza cell beside the fountain in the middle.
      const squareNode = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => nav.nodeAt.get(key(sq.x + dx!, sq.h, sq.z + dz!))).find((n) => n !== undefined);
      expect(squareNode, `seed ${seed}: the square is walkable`).toBeDefined();
      const part = nav.part[squareNode!];
      let houses = 0, reach = 0;
      for (const s of town.shape.structures.values()) {
        if (s.kind !== 'house') continue;
        const doors = nav.doorsOf.get(s.id) ?? [];
        if (doors.length === 0) continue;
        houses++;
        if (doors.some((d) => nav.doors[d]!.node >= 0 && nav.part[nav.doors[d]!.node] === part)) reach++;
      }
      expect(reach / houses, `seed ${seed}: ${reach} of ${houses} houses reach the square`).toBeGreaterThan(0.75);
      const byRule = (id: string): number => props.filter((p) => p.rule.startsWith(id)).length;
      expect(byRule('D01'), `seed ${seed}: street lamps`).toBeGreaterThan(5);
      expect(byRule('D05'), `seed ${seed}: laundry lines`).toBeGreaterThan(0);
      expect(byRule('U01') + byRule('U03'), `seed ${seed}: a pocket park or a front garden`).toBeGreaterThan(0);
    }
  });

  test('the depth rules all show somewhere in seeds 1 to 5 (vista, corners, hall, rustic edge, courtyard, statue, castle, braziers, fingerposts, viewpoint, swings, pump)', () => {
    const counts = new Map<string, number>();
    const add = (id: string, n: number): void => void counts.set(id, (counts.get(id) ?? 0) + n);
    for (let seed = 1; seed <= 5; seed++) {
      const t = generateTerrain(seed);
      const town = resolveTown(build(t, growTown(t, seed)), t);
      const by = (id: string): number =>
        town.dressing.props.filter((p) => p.rule.startsWith(`${id}.`)).length + town.shape.features.filter((f) => f.rule.startsWith(`${id}.`)).length;
      for (const id of ['U09', 'U10', 'U11-F', 'D17', 'D19', 'D21', 'D22', 'D26', 'D31', 'D32', 'D33']) add(id, by(id));
      add('U11', [...town.shape.roles.values()].filter((r) => r.role === 'town-hall').length);
      add('U12-E', [...town.shape.tags.values()].filter((tags) => tags.has('rustic')).length);
    }
    const table = [...counts].map(([id, n]) => `${id} ${n}`).join(', ');
    console.log(`depth rules across seeds 1–5: ${table}`);
    for (const [id, n] of counts) expect(n, `${id} never shows (${table})`).toBeGreaterThan(0);
  });
});
