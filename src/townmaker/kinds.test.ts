// Choosing a kind of town (design section 15a): a kind offered on an island
// is what grows there (the planner does not fall back to another); the kinds
// not offered are exactly those with no weight or that would fall back; on a
// new island the search finds one that suits the kind, and the plan that
// comes with it is the town the game grows on that seed.

import { describe, expect, test } from 'vitest';
import { resolveTown } from '@/resolve/index';
import { generateTerrain } from '@/terrain/terrain';
import { highest, island2, runSearch } from '@/terrain/kinds';
import { applyEdit, emptyWorld } from '@/world/world';
import type { Terrain } from '@/core/world';
import { FULL, sized } from '../../tests/helpers/tier';
import { CHARACTERS, islandTraits } from './character';
import { planTown } from './index';
import { findIslandForTown, kindWeights, planKind, suits, TOWN_BUDGET } from './kinds';
import { readSite } from './site';

/** Islands of both generators, small and steep and flat, with and without rivers. */
const ISLANDS: { seed: number; gen: 1 | 2 }[] = [
  ...Array.from({ length: sized(3, 10) }, (_, i) => ({ seed: i + 1, gen: 1 as const })),
  ...Array.from({ length: sized(5, 30) }, (_, i) => ({ seed: i + 1, gen: 2 as const })),
];

/** The roles a planned town shows once built and resolved. */
function roles(terrain: Terrain, gen: 1 | 2, edits: ReturnType<typeof planTown>['edits']): Set<string> {
  let w = emptyWorld(terrain.seed, gen);
  for (const e of edits) w = applyEdit(w, terrain, e);
  return new Set([...resolveTown(w, terrain).shape.roles.values()].map((r) => r.role));
}

describe('a kind of town on this island', () => {
  test('a kind offered grows that kind, the same town as planning it outright; one not offered has no weight or would fall back', () => {
    const bad: string[] = [];
    let offered = 0, refused = 0;
    for (const { seed, gen } of ISLANDS) {
      const t = generateTerrain(seed, gen);
      const w = kindWeights(t);
      for (const kind of CHARACTERS) {
        const plan = planKind(t, seed, kind, w);
        const forced = planTown(t, seed, { character: kind });
        const where = `gen ${gen} seed ${seed} ${kind}`;
        if (plan) {
          offered++;
          if (plan.character !== kind) bad.push(`${where}: grew ${plan.character}`);
          // No fall-back: the town is the one the planner makes when told the kind outright.
          if (JSON.stringify(plan.edits) !== JSON.stringify(forced.edits)) bad.push(`${where}: not the planned town`);
          if (kind === 'castle' && !plan.districts.some((d) => d.name === 'castle')) bad.push(`${where}: no castle`);
          continue;
        }
        refused++;
        // Not offered: no weight (a river town with no river to speak of), or no centrepiece site.
        if (w[kind] === 0) {
          if (kind !== 'river' || islandTraits(readSite(t)).river >= 30) bad.push(`${where}: zero weight unexpectedly`);
        } else if (kind === 'castle') {
          if (forced.districts.some((d) => d.name === 'castle')) bad.push(`${where}: refused though a castle fits`);
        } else if (kind === 'marble') {
          // The forum is the marble city's centrepiece: told the kind outright, it has none (no podium).
          if (roles(t, gen, forced.edits).has('podium')) bad.push(`${where}: refused though a forum fits`);
        } else bad.push(`${where}: refused with weight ${w[kind]}`);
      }
    }
    console.log(`kinds offered ${offered}, not offered ${refused}`);
    expect(refused).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  test('an offered marble city has its forum', () => {
    // Generator 1's island 3 has a site for one.
    const t = generateTerrain(3, 1);
    const plan = planKind(t, 3, 'marble')!;
    expect(plan.character).toBe('marble');
    expect(roles(t, 1, plan.edits).has('podium')).toBe(true);
  });
});

describe('a kind of town on a new island', () => {
  const STARTS = sized(1, 6);
  for (const kind of CHARACTERS) {
    test(`a ${kind} town: an island that suits it, within the budget, and the town grows that kind there`, () => {
      for (let n = 0; n < STARTS; n++) {
        const found = runSearch(findIslandForTown(kind, n * 104729 + 17));
        expect(found.exact).toBe(true);
        expect(found.plans).toBeLessThanOrEqual(TOWN_BUDGET.plans);
        expect(found.plan.character).toBe(kind);
        // The island the game opens for this seed, and the town planned on it, are the ones found.
        const opened = generateTerrain(found.seed, 2);
        expect(opened.height).toEqual(found.island.terrain.height);
        const w = kindWeights(opened);
        expect(suits(w, kind)).toBe(true);
        expect(planKind(opened, found.seed, kind, w)!.edits.length).toBe(found.plan.edits.length);
        // What "suits" means, said plainly for the two the owner named.
        if (kind === 'castle' || kind === 'hill') expect(highest(island2(found.seed))).toBeGreaterThanOrEqual(7);
        if (kind === 'river') expect(island2(found.seed).rivers).toBeGreaterThan(0);
      }
    });
  }

  test.runIf(FULL)('what a search costs (printed; a loose budget asserted)', () => {
    const lines: string[] = [];
    for (const kind of CHARACTERS) {
      const ms: number[] = [];
      for (let n = 0; n < 20; n++) {
        const t0 = performance.now();
        runSearch(findIslandForTown(kind, n));
        ms.push(performance.now() - t0);
      }
      ms.sort((a, b) => a - b);
      lines.push(`${kind}: median ${ms[10]!.toFixed(0)} ms, worst ${ms[19]!.toFixed(0)} ms`);
      expect(ms[10]).toBeLessThan(600);
    }
    console.log(lines.join('\n'));
  });
});
