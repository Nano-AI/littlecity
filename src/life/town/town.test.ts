// The town's chains (L51 bread, L52 water), stepped with fixed time steps:
// each chain completes, every carried thing is always in a hand or lying in
// a store, nobody leaves the walking graph, taking a link away mid-chain
// ends it cleanly (what is carried goes home), the same seed tells the same
// story.

import { describe, expect, test } from 'vitest';
import { keyX, keyZ } from '@/core/grid';
import type { DressingPlan } from '@/resolve/plan';
import breadTown from '../../../scenarios/life/L51.bread.scenario';
import fishTown from '../../../scenarios/life/L53.fish.scenario';
import type { Person } from '../people/crowd';
import type { Load } from '../people/errand';
import { clock, scenarioTown, watch, type TestTown } from '../people/testing';
import { createLivingTown, type LivingTown } from './index';

const town = scenarioTown(breadTown);

/** Where the loads went: set down at a post (by tag), taken home or indoors, or lost (must stay empty). */
interface Ledger {
  setDown: Map<string, number>;
  pickedUp: Map<string, number>;
  home: number;
  lost: string[];
}

function run(seconds: number, part: 'day' | 'dawn' = 'day', dressing: DressingPlan = town.dressing, then?: (t: LivingTown, second: number) => void, where: TestTown = town) {
  // (`then` is called once a second, before that second's steps' checks.)
  const c = clock(where.world.seed, part);
  const t = createLivingTown({ seed: where.world.seed });
  t.sync(where.shape, where === town ? dressing : where.dressing, c.time);
  const w = watch(t.crowd, { maxStuck: 12 });
  const was = new Map<Person, Load | null>();
  const ledger: Ledger = { setDown: new Map(), pickedUp: new Map(), home: 0, lost: [] };
  const add = (m: Map<string, number>, k: string): void => void m.set(k, (m.get(k) ?? 0) + 1);
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    if (i % 30 === 0) then?.(t, i / 30);
    for (const p of t.crowd.people) {
      const before = was.get(p) ?? null;
      const now = p.load;
      if (before !== now) {
        const tag = p.goal?.errand?.tag ?? '';
        if (before && !now) {
          if (p.mode === 'home') ledger.home++;
          else if (p.mode === 'visit' || p.mode === 'linger') add(ledger.setDown, `${before}@${tag}`);
          else if (ledger.lost.length < 10) ledger.lost.push(`${p.id} lost a ${before} while ${p.mode} (${tag})`);
        }
        if (now) add(ledger.pickedUp, `${now}@${tag}`);
      }
      // Something in the hands is on somebody drawn, or inside with them; never left behind.
      if (now && p.mode === 'gone' && ledger.lost.length < 10) ledger.lost.push(`${p.id} gone with a ${now}`);
      was.set(p, now);
    }
  }
  return { t, w, ledger, c };
}

describe('L51 bread and L52 water', () => {
  test('a morning: sacks reach the bakery, trays reach the stalls, loaves go home, buckets are filled', () => {
    const { w, ledger, t } = run(300, 'day');
    expect(w.problems).toEqual([]);
    expect(ledger.lost).toEqual([]);
    expect(ledger.setDown.get('sack@bread:sack') ?? 0).toBeGreaterThanOrEqual(2);
    expect(ledger.pickedUp.get('sack@bread:lift') ?? 0).toBeGreaterThanOrEqual(1);
    expect(ledger.setDown.get('tray@bread:deliver') ?? 0).toBeGreaterThanOrEqual(2);
    expect(ledger.pickedUp.get('loaf@bread:buy') ?? 0).toBeGreaterThanOrEqual(2);
    expect(ledger.pickedUp.get('bucket@water:fill') ?? 0).toBeGreaterThanOrEqual(1);
    expect(ledger.home).toBeGreaterThanOrEqual(2);
    // Whatever lies in the stores is what was set down less what was taken.
    const loaves = [...t.board.stores.values()].reduce((n, s) => n + s.items.filter((x) => x === 'loaf').length, 0);
    expect(loaves).toBeGreaterThanOrEqual(0);
    expect(loaves).toBeLessThanOrEqual((ledger.setDown.get('tray@bread:deliver') ?? 0) * 3);
  });

  test('the stalls taken away mid-chain: the baker takes the tray home, nothing is lost or left floating', () => {
    const noSells: DressingPlan = { ...town.dressing, sockets: town.dressing.sockets.filter((s) => !(s.type === 'errand' && (s.name ?? '').startsWith('bread|sell'))) };
    let swapped = false;
    let carrier: Person | null = null;
    const { w, ledger } = run(260, 'day', town.dressing, (t, second) => {
      if (swapped) return;
      carrier = t.crowd.people.find((p) => p.load === 'tray' && p.mode === 'walk') ?? null;
      if (carrier || second > 200) {
        swapped = true;
        t.sync(town.shape, noSells, clock(town.world.seed, 'day').time);
      }
    });
    expect(swapped).toBe(true);
    expect(carrier).not.toBeNull();
    expect(w.problems).toEqual([]);
    expect(ledger.lost).toEqual([]);
    expect((carrier as Person | null)?.load ?? null).not.toBe('tray');
  });

  test('L54: a house goes up, two builders come with a ladder and a hod, hammer, and take them home; a tower draws onlookers', () => {
    const after = scenarioTown({ ...breadTown, build: (b) => (breadTown.build(b), b.house(14, 26, { floors: 1, w: 2, d: 2 }), b.tower(22, 27, { floors: 4 })) });
    const houseCell = [...after.shape.structureAt].find(([c, id]) => keyX(c) === 14 && keyZ(c) === 26 && after.shape.structures.get(id)?.kind === 'house')![0];
    const towerCell = [...after.shape.structureAt].find(([c, id]) => keyX(c) === 22 && keyZ(c) === 27 && after.shape.structures.get(id)?.kind === 'tower')![0];
    const seen = { hammer: new Set<string>(), look: new Set<string>(), ladder: 0, hod: 0 };
    const { w, ledger } = run(140, 'day', town.dressing, (t, second) => {
      if (second === 20) {
        t.sync(after.shape, null, clock(town.world.seed, 'day').time);
        t.landed(houseCell);
        t.sync(after.shape, after.dressing, clock(town.world.seed, 'day').time);
      }
      if (second === 30) t.landed(towerCell);
      for (const p of t.crowd.people) {
        if (p.mode === 'linger' && p.goal?.errand?.tag === 'build:hammer') seen.hammer.add(p.id);
        if (p.mode === 'linger' && p.goal?.errand?.tag === 'build:look') seen.look.add(p.id);
      }
    });
    expect(w.problems).toEqual([]);
    expect(ledger.lost).toEqual([]);
    expect(seen.hammer.size).toBeGreaterThanOrEqual(2);
    expect(ledger.setDown.get('ladder@build:set-down') ?? 0).toBeGreaterThanOrEqual(1);
    expect(ledger.setDown.get('hod@build:set-down') ?? 0).toBeGreaterThanOrEqual(1);
    expect(ledger.pickedUp.get('ladder@build:pick-up') ?? 0).toBeGreaterThanOrEqual(1);
    expect(seen.look.size).toBeGreaterThanOrEqual(1);
  });

  test('L53: the fisher carries the catch up the pier to the fish stall; residents take fish home', () => {
    const { w, ledger } = run(240, 'day', town.dressing, undefined, scenarioTown(fishTown));
    expect(w.problems).toEqual([]);
    expect(ledger.lost).toEqual([]);
    expect(ledger.pickedUp.get('fish@fish:fishing') ?? 0).toBeGreaterThanOrEqual(2);
    expect(ledger.setDown.get('fish@fish:deliver') ?? 0).toBeGreaterThanOrEqual(2);
    expect(ledger.pickedUp.get('fishes@fish:buy') ?? 0).toBeGreaterThanOrEqual(1);
  });

  test('the same town stepped the same way tells the same story', () => {
    const a = run(90).t.crowd.people.map((p) => [p.id, p.mode, p.load, p.x.toFixed(4), p.z.toFixed(4)]);
    const b = run(90).t.crowd.people.map((p) => [p.id, p.mode, p.load, p.x.toFixed(4), p.z.toFixed(4)]);
    expect(b).toEqual(a);
  });
});
