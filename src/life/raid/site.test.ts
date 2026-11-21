// Where raids come ashore (site.ts): on every grown town both kinds of raid
// find a shore near the town and a way in from the edge of the map; the boats
// go to landings spread round the town; every landing is on the town's
// walking graph; the same town and seed always plan the same raid.

import { describe, expect, test } from 'vitest';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { resolveTown } from '@/resolve';
import { mapEdge } from '@/rules/life/ship-routes';
import { pathAt } from '@/rules/life/ship-routes';
import { planRaid } from './site';

const TOWNS = ['grown-harbour', 'grown-market', 'grown-town-1', 'grown-farming'];

describe('raid sites', () => {
  for (const name of TOWNS) {
    test(`${name}: a landing and a boats raid, from beyond the edge, ashore near the town`, () => {
      const built = buildScenario(findScenario(name)!);
      const { shape, dressing } = resolveTown(built.world, built.terrain);
      for (const kind of ['landing', 'boats'] as const) {
        const s = planRaid(shape, dressing.nav, 7, { kind });
        expect(s, kind).not.toBeNull();
        expect(s!.kind).toBe(kind);
        // In from beyond the edge of the map and out beyond it again.
        expect(mapEdge(pathAt(s!.voyage.arrive, 0).x, pathAt(s!.voyage.arrive, 0).z)).toBeGreaterThan(0);
        const leave = s!.voyage.leave;
        expect(mapEdge(pathAt(leave, leave.length).x, pathAt(leave, leave.length).z)).toBeGreaterThan(0);
        for (const l of s!.landings) {
          expect(dressing.nav.nodeAt.get(l.cell)).toBe(l.node);
          expect(Math.hypot(l.x - s!.heart.x, l.z - s!.heart.z)).toBeLessThan(18);
        }
        if (kind === 'boats') {
          expect(s!.landings.length).toBeGreaterThanOrEqual(2);
          expect(s!.boatPaths.length).toBe(s!.landings.length);
          // Hit from more than one side: the landings are apart.
          const [a, b] = s!.landings;
          expect(Math.hypot(a!.x - b!.x, a!.z - b!.z)).toBeGreaterThanOrEqual(4);
        }
        // The same town and seed plan the same raid.
        expect(JSON.stringify(planRaid(shape, dressing.nav, 7, { kind })?.landings.map((l) => l.cell))).toBe(JSON.stringify(s!.landings.map((l) => l.cell)));
      }
    }, 120_000);
  }
});
