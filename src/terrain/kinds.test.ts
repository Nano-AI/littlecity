// Choosing a kind of island (design section 7, "New island"): the search
// finds a seed whose island, generated exactly as a new island is, really is
// that kind, within its budget; the kinds look as they are named.

import { describe, expect, test } from 'vitest';
import { FULL, sized } from '../../tests/helpers/tier';
import { findIsland, highest, island2, islandKindOf, ISLAND_KINDS, runSearch, SEARCH_BUDGET, type IslandKind } from './kinds';
import { generateTerrain } from './terrain';
import { checkTerrain2 } from './terrain2';

const DRAWS = sized(10, 200);

/** What each kind must look like, measured on the island itself. */
function looksLike(kind: IslandKind, seed: number): string[] {
  const isl = island2(seed);
  const top = highest(isl);
  const masses = checkTerrain2(isl.terrain).islands;
  const bad: string[] = [];
  const want = (ok: boolean, what: string): void => void (ok || bad.push(`${kind} ${seed}: ${what}`));
  want(!isl.fellBack, 'not generator 1');
  if (kind === 'plains') {
    want(isl.rivers === 0, 'no river');
    want(top <= 4, `low (highest ${top})`);
    want(masses === 1, 'one landmass');
  }
  if (kind === 'hills') {
    want(top >= 5 && top <= 6, `hills of 5 (highest ${top})`);
    want(isl.through === 0, 'no river right across');
  }
  if (kind === 'mountain') want(top >= 7, `high (highest ${top})`);
  if (kind === 'valley') {
    want(isl.through >= 1, 'a river right across');
    want(masses >= 2, 'the river splits the land');
    want(top <= 6, 'not a mountain');
  }
  if (kind === 'islands') want(isl.character === 'archipelago', 'an archipelago');
  return bad;
}

describe('a kind of island', () => {
  test('every kind is found, within the budget, and the seed opens on an island of that kind', () => {
    const bad: string[] = [];
    for (const kind of ISLAND_KINDS) {
      for (let n = 0; n < DRAWS; n++) {
        const found = runSearch(findIsland(kind, n * 7919 + 1));
        if (!found.exact) bad.push(`${kind} from ${n}: not found`);
        if (found.generated > SEARCH_BUDGET.islands) bad.push(`${kind} from ${n}: ${found.generated} islands`);
        // The island the game opens for this seed: generator 2 through the same door as a new island.
        const opened = generateTerrain(found.seed, 2);
        expect(opened.height).toEqual(found.island.terrain.height);
        if (islandKindOf(island2(found.seed)) !== kind) bad.push(`${kind} from ${n}: seed ${found.seed} is ${islandKindOf(island2(found.seed))}`);
        bad.push(...looksLike(kind, found.seed));
      }
    }
    expect(bad).toEqual([]);
  });

  test('the same start finds the same seed; different starts find different ones', () => {
    const a = runSearch(findIsland('mountain', 42));
    expect(runSearch(findIsland('mountain', 42)).seed).toBe(a.seed);
    expect(runSearch(findIsland('mountain', 43)).seed).not.toBe(a.seed);
  });

  test('a search that cannot match settles for the closest, within its budget', () => {
    // A budget of one island: whatever it generated first, of the right character at best.
    const found = runSearch(findIsland('islands', 7, { draws: 3, islands: 1 }));
    expect(found.generated).toBeLessThanOrEqual(1);
    expect(typeof found.seed).toBe('number');
  });

  test.runIf(FULL)('how often each kind occurs, and what a search costs (printed; a loose budget asserted)', () => {
    const counts = new Map<string, number>();
    const N = 500;
    for (let n = 0; n < N; n++) {
      const k = islandKindOf(island2((n * 2654435761) | 0)) ?? 'none';
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const lines = [`natural shares over ${N} seeds: ${[...counts].map(([k, c]) => `${k} ${((100 * c) / N).toFixed(0)}%`).join(', ')}`];
    for (const kind of ISLAND_KINDS) {
      const ms: number[] = [];
      for (let n = 0; n < 100; n++) {
        const t0 = performance.now();
        runSearch(findIsland(kind, n));
        ms.push(performance.now() - t0);
      }
      ms.sort((a, b) => a - b);
      lines.push(`${kind}: median ${ms[50]!.toFixed(1)} ms, p95 ${ms[95]!.toFixed(1)} ms, worst ${ms[99]!.toFixed(1)} ms`);
      expect(ms[50]).toBeLessThan(60);
    }
    console.log(lines.join('\n'));
  });
});
