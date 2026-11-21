// L63 · the beach day, stepped with fixed time steps: families come down
// dressed for it with their things, set up along the sand, do a spread of
// things there, pack up and go home and change; rain sends them running with
// towels over their heads; the beach erased calls it off; held summer noon
// keeps giving beach days; winter, night and rain give none; and most grown
// coastal towns have a beach.

import { describe, expect, test } from 'vitest';
import type { DressingPlan } from '@/resolve/plan';
import { isBeachWear } from '@/parts/people/beachwear';
import { findScenario } from '@/scenario/discover';
import { CLEAR, seasonAt, type WeatherSignal } from '../season';
import beachTown from '../../../scenarios/life/L63.beach.scenario';
import { clock, scenarioTown, watch, type TestTown } from '../people/testing';
import type { BeachChain } from './chains/beach';
import { createLivingTown, type LivingTown } from './index';
import { sized } from '../../../tests/helpers/tier';

const town = scenarioTown(beachTown);
const RAIN: WeatherSignal = { ...CLEAR, kind: 'rain', rain: 0.8, cloud: 1, wet: 0.5 };

interface Run {
  t: LivingTown;
  beach: BeachChain;
  problems: string[];
}

function run(where: TestTown, seconds: number, each?: (t: LivingTown, beach: BeachChain, second: number) => void, part: 'day' | 'night' = 'day', dressing: DressingPlan = where.dressing): Run {
  const c = clock(where.world.seed, part);
  const t = createLivingTown({ seed: where.world.seed });
  t.sync(where.shape, dressing, c.time);
  const w = watch(t.crowd, { maxStuck: 12 });
  const beach = t.board.chains.find((x) => x.id === 'beach') as BeachChain;
  for (let i = 0; i < seconds * 30; i++) {
    t.step(c.tick(1 / 30), c.time);
    w.check();
    each?.(t, beach, i / 30);
  }
  return { t, beach, problems: w.problems };
}

/** Nobody left in beach clothes or carrying beach things, nothing left on the sand, nobody claimed. */
function allPutAway(r: Run, keep: ReadonlySet<unknown> = new Set()): void {
  for (const p of r.t.crowd.people) {
    if (keep.has(p)) continue;
    expect(isBeachWear(p.costume), `${p.id} still in beach clothes (${p.mode}, ${p.goal?.errand?.tag})`).toBe(false);
    expect(p.load === null || !/parasol|deckchair|hamper|pail|beachball/.test(p.load), `${p.id} still holds ${p.load}`).toBe(true);
    expect(p.party).toBe(false);
    expect(p.drawX ?? 0).toBe(0);
  }
  if (keep.size > 0) return;
  expect(r.beach.things).toBe(0);
  expect(r.beach.bathers.length).toBe(0);
}

describe('L63: the beach day', () => {
  test('a whole beach day: they come dressed for it with their things, set up, do a spread of things, pack up and go home and change', () => {
    const acts = new Set<string>();
    const loads = new Set<string>();
    let parasols = 0, castle = 0, packedAt = -1, swimmers = 0, closed = -1, things = -1;
    const r = run(town, 450, (t, beach, s) => {
      // The first day over a minute: everybody of it is home and changed (a second may have begun).
      if (packedAt > 0 && closed < 0 && beach.on.length === 0) closed = s;
      if (closed > 0 && things < 0 && s > closed + 60) {
        things = beach.things;
        allPutAway({ t, beach, problems: [] }, new Set(beach.bathers.map((b) => b.p)));
      }
      for (const b of beach.bathers) {
        if (b.state === 'stay') acts.add(b.act);
        if (b.p.load) loads.add(b.p.load.replace(/-\d$/, ''));
        // In it, out of doors, they are dressed for it.
        if ((b.state === 'stay' || b.state === 'setup') && b.p.visible) expect(isBeachWear(b.p.costume)).toBe(true);
        if (b.act === 'swim' && !b.p.visible) swimmers++;
      }
      for (const d of beach.on) parasols = Math.max(parasols, d.pitches.filter((pi) => pi.things.some((x) => x.kind === 'parasol')).length);
      castle = Math.max(castle, ...beach.castles.map((c) => c.stage), 0);
      if (packedAt < 0 && beach.on.some((d) => d.mode === 'pack')) packedAt = s;
      void t;
    });
    expect(r.problems).toEqual([]);
    expect(closed).toBeGreaterThan(0);
    expect(things).toBeGreaterThanOrEqual(0);
    expect(parasols).toBeGreaterThanOrEqual(4);
    for (const l of ['parasol', 'deckchair', 'pail']) expect(loads.has(l), l).toBe(true);
    for (const a of ['lie', 'paddle', 'dig']) expect(acts.has(a), a).toBe(true);
    expect(acts.size).toBeGreaterThanOrEqual(6);
    expect(castle).toBe(4);
    expect(swimmers).toBeGreaterThan(0);
    expect(packedAt).toBeGreaterThan(150);
    // The sandcastles stay after them.
    expect(r.beach.castles.length).toBeGreaterThan(0);
  });

  test('rain sends them running home with towels over their heads, and everything goes with them', () => {
    let rained = -1, towels = 0, umbrellas = 0;
    const r = run(town, 260, (t, beach, s) => {
      if (rained < 0 && beach.on.some((d) => d.until < Infinity)) {
        rained = s;
        t.board.setSky(t.board.season, RAIN);
      }
      for (const p of t.crowd.people) {
        if (p.costume === 'bather-towel' && p.visible) towels++;
        if (p.load?.startsWith('parasol-open')) umbrellas++;
      }
    });
    expect(rained).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
    expect(towels).toBeGreaterThan(0);
    expect(umbrellas).toBeGreaterThan(0);
    // No new day in the rain.
    expect(r.beach.days).toBe(1);
    allPutAway(r);
  });

  test('the beach erased mid-day: called off, its things go, everybody walks home and changes', () => {
    const gone: DressingPlan = { ...town.dressing, sockets: town.dressing.sockets.filter((s) => !(s.type === 'errand' && (s.name ?? '').startsWith('beach|'))) };
    let cut = -1;
    const r = run(town, 300, (t, beach, s) => {
      if (cut < 0 && beach.on.some((d) => d.until < Infinity)) {
        cut = s;
        t.sync(town.shape, gone, clock(town.world.seed, 'day').time);
      }
    });
    expect(cut).toBeGreaterThan(0);
    expect(r.problems).toEqual([]);
    expect(r.beach.on.length).toBe(0);
    expect(r.beach.castles.length).toBe(0);
    allPutAway(r);
  });

  test('held summer noon keeps giving beach days', () => {
    const starts: number[] = [];
    let was = 0;
    run(town, sized(900, 1500), (_t, beach, s) => {
      if (beach.days > was) starts.push(s);
      was = beach.days;
    });
    expect(starts.length).toBeGreaterThanOrEqual(2);
    expect(starts[0]).toBeLessThan(60);
  });

  test('none in winter, at night or in the rain', () => {
    for (const [what, sky, part] of [['winter', 'winter', 'day'], ['night', 'summer', 'night'], ['rain', 'rain', 'day']] as const) {
      const r = run(
        town,
        120,
        (t, _b, s) => {
          if (s === 0) t.board.setSky(sky === 'winter' ? seasonAt(0.875) : t.board.season, sky === 'rain' ? RAIN : CLEAR);
        },
        part,
      );
      expect(r.beach.days, what).toBe(0);
    }
  });

  test('grown coastal towns have a beach to go to', () => {
    const names = ['grown-castle', 'grown-farming', 'grown-gardens', 'grown-harbour', 'grown-hill', 'grown-marble', 'grown-market', 'grown-river', 'grown-town-1', 'grown-town-4', 'grown-town-6'];
    const withBeach = names.filter((n) => scenarioTown(findScenario(n)!).dressing.sockets.some((s) => (s.name ?? '').startsWith('beach|pitch|')));
    expect(withBeach.length).toBeGreaterThanOrEqual(Math.ceil(names.length * 0.8));
  });
});
