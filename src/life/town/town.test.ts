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
import watchTown from '../../../scenarios/life/L55.watchman.scenario';
import marketTown from '../../../scenarios/life/L56.market-day.scenario';
import weddingTown from '../../../scenarios/life/L57.wedding.scenario';
import tradeTown from '../../../scenarios/life/L58.trade.scenario';
import harvestTown from '../../../scenarios/life/L59.harvest.scenario';
import laundryTown from '../../../scenarios/life/L60.laundry.scenario';
import type { LaundryChain } from './chains/laundry';
import { CLEAR, SUMMER } from '../season';
import { tradeChain } from './chains/trade';
import type { Pile } from '../ships/crew';
import type { InstanceHandle } from '../api';
import type { WeddingChain } from './chains/wedding';
import { MARKET } from '@/style/town-life';
import type { MarketChain } from './chains/market-day';
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

function run(seconds: number, part: 'day' | 'dawn' | 'night' = 'day', dressing: DressingPlan = town.dressing, then?: (t: LivingTown, second: number) => void, where: TestTown = town) {
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
          else if (p.scuffle?.setDown.get(p) === before) add(ledger.setDown, `${before}@scuffle`); // set down to fight (L50), picked up after
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

  test('L55: at night the watchman walks the beat with a lantern, post after post', () => {
    const beats = new Set<string>();
    let lantern = 0;
    const { w, ledger } = run(150, 'night', town.dressing, (t) => {
      for (const p of t.crowd.people) {
        if (p.load === 'lantern' && p.visible) lantern++;
        const tag = p.goal?.errand?.tag ?? '';
        if (p.mode === 'linger' && tag.startsWith('watch:beat')) beats.add(tag);
      }
    }, scenarioTown(watchTown));
    expect(w.problems).toEqual([]);
    expect(ledger.lost).toEqual([]);
    expect(lantern).toBeGreaterThan(30);
    expect(beats.size).toBeGreaterThanOrEqual(3);
  });

  test('L56: market day: traders set up stalls with a crate, the town buys, the busker juggles; at closing they pack up and go home', () => {
    const close = MARKET.close;
    let most = 0;
    let juggling = 0;
    let closedAt = -1;
    try {
      const { w, ledger, t } = run(260, 'day', town.dressing, (t, second) => {
        const m = t.board.chains.find((c) => c.id === 'market') as MarketChain;
        most = Math.max(most, m.pitches.filter((p) => p.up).length);
        juggling += t.crowd.people.filter((p) => p.mode === 'linger' && p.goal?.pose === 'juggle').length;
        if (second === 170) {
          MARKET.close = 0; // closing time
          closedAt = second;
        }
      }, scenarioTown(marketTown));
      const m = t.board.chains.find((c) => c.id === 'market') as MarketChain;
      expect(w.problems).toEqual([]);
      expect(ledger.lost).toEqual([]);
      expect(most).toBeGreaterThanOrEqual(2);
      expect(ledger.setDown.get('crate@market:set-up') ?? 0).toBeGreaterThanOrEqual(2);
      expect(ledger.pickedUp.get('basket@market:buy') ?? 0).toBeGreaterThanOrEqual(2);
      expect(juggling).toBeGreaterThan(0);
      expect(closedAt).toBe(170);
      // Closed: every stall folded, and the crates went home.
      expect(m.open).toBe(false);
      expect(m.pitches.filter((p) => p.up).length).toBe(0);
      expect(ledger.pickedUp.get('crate@market:pack') ?? 0).toBeGreaterThanOrEqual(1);
    } finally {
      MARKET.close = close;
    }
  });

  test('L57: a wedding: the couple go in, guests gather at the door, the couple come out dressed, all walk to the square, then home', () => {
    const phases: string[] = [];
    const waited = new Set<string>();
    let dressed = 0;
    const { w, ledger, t } = run(240, 'day', town.dressing, (t) => {
      const wed = t.board.chains.find((c) => c.id === 'wedding') as WeddingChain;
      if (phases[phases.length - 1] !== wed.phase) phases.push(wed.phase);
      for (const p of t.crowd.people) {
        if (p.mode === 'linger' && p.goal?.errand?.tag === 'wedding:wait') waited.add(p.id);
        if (p.costume && p.visible) dressed++;
      }
    }, scenarioTown(weddingTown));
    const wed = t.board.chains.find((c) => c.id === 'wedding') as WeddingChain;
    expect(w.problems).toEqual([]);
    expect(ledger.lost).toEqual([]);
    expect(wed.held).toBeGreaterThanOrEqual(1);
    expect(phases).toContain('gather');
    expect(phases).toContain('procession');
    expect(waited.size).toBeGreaterThanOrEqual(3);
    expect(dressed).toBeGreaterThan(5);
    // Over: nobody is left dressed up out in the street or in the party.
    if (wed.phase === 'none') for (const p of t.crowd.people) expect(p.party).toBe(false);
  });

  test('L58: goods landed on the quay are wheeled into town by the carters, and the stack on the quay goes down', () => {
    const where = scenarioTown(tradeTown);
    let released = 0;
    const handle = (): InstanceHandle => ({ base: [], setMatrix() {}, setVisible() {}, setParams() {}, release: () => void released++ }) as unknown as InstanceHandle;
    // Six pieces lying on the quay (on top of its blocks, level 1), as a ship's crew leaves them.
    const spots = [20.4, 21.1, 21.8, 26.2, 26.9, 27.6].map((x, i) => ({ x, y: 0.82, z: 27.5 + (i % 2) * 0.2, yaw: 0 }));
    const pile: Pile = { spots, items: spots.map(() => handle()) };
    const c = clock(where.world.seed, 'day');
    const t = createLivingTown({ seed: where.world.seed, chains: [tradeChain(() => new Map([['berth', pile]]))] });
    t.sync(where.shape, where.dressing, c.time);
    const w = watch(t.crowd, { maxStuck: 12 });
    let carts = 0;
    for (let i = 0; i < 240 * 30; i++) {
      t.step(c.tick(1 / 30), c.time);
      w.check();
      if (i % 30 === 0) carts += t.crowd.people.filter((p) => (p.load ?? '').startsWith('cart-') && p.visible).length;
    }
    expect(w.problems).toEqual([]);
    const left = pile.items.filter(Boolean).length;
    expect(left).toBeLessThanOrEqual(3);
    expect(released).toBe(6 - left);
    const delivered = [...t.board.stores.values()].filter((s) => s.key.startsWith('trade:to:')).reduce((n, s) => n + t.board.count(s), 0);
    // Set down in town (some already taken in by those who live there).
    expect(delivered).toBeGreaterThanOrEqual(1);
    expect(delivered).toBeLessThanOrEqual(6 - left);
    expect(carts).toBeGreaterThan(10);
    // The carts are back by their doors or out with a carter.
    const parked = [...t.board.stores.values()].filter((s) => s.key.startsWith('trade:cart:')).reduce((n, s) => n + t.board.count(s), 0);
    const out = t.crowd.people.filter((p) => (p.load ?? '').startsWith('cart')).length;
    expect(parked + out).toBe(2);
  });

  test('L59: in late summer the farmhands cut the wheat, stooks stand where they cut, sheaves go to the mill', () => {
    let mowing = 0;
    const { w, ledger, t } = run(200, 'day', town.dressing, (t) => {
      mowing += t.crowd.people.filter((p) => p.mode === 'linger' && p.goal?.pose === 'mow').length;
    }, scenarioTown(harvestTown));
    expect(w.problems).toEqual([]);
    expect(ledger.lost).toEqual([]);
    expect(mowing).toBeGreaterThan(5);
    const stooks = [...t.board.stores.values()].filter((s) => s.key.startsWith('stook:')).reduce((n, s) => n + t.board.count(s), 0);
    const heap = [...t.board.stores.values()].filter((s) => s.key.startsWith('mill-heap:')).reduce((n, s) => n + t.board.count(s), 0);
    expect(stooks + heap).toBeGreaterThanOrEqual(4);
    expect(ledger.setDown.get('sheaf@harvest:mill') ?? 0).toBeGreaterThanOrEqual(1);
  });

  test('L60: the washing comes in when it rains and at dusk, carried home in a basket, and goes out again', () => {
    const where = scenarioTown(laundryTown);
    const c = clock(where.world.seed, 'day');
    const t = createLivingTown({ seed: where.world.seed });
    t.sync(where.shape, where.dressing, c.time);
    const w = watch(t.crowd, { maxStuck: 12 });
    const lines = (): LaundryChain['lines'] => (t.board.chains.find((x) => x.id === 'laundry') as LaundryChain).lines;
    const step = (seconds: number): void => {
      for (let i = 0; i < seconds * 30; i++) {
        t.step(c.tick(1 / 30), c.time);
        w.check();
      }
    };
    step(5);
    expect(lines().length).toBeGreaterThan(0);
    expect(lines().every((l) => l.out)).toBe(true);
    // Rain: in it comes.
    t.board.setSky(SUMMER, { ...CLEAR, kind: 'rain', rain: 0.8 });
    step(120);
    const inNow = lines().filter((l) => !l.out).length;
    expect(inNow).toBeGreaterThanOrEqual(Math.ceil(lines().length / 2));
    // The rain stops: out it goes again.
    t.board.setSky(SUMMER, CLEAR);
    step(120);
    expect(lines().filter((l) => l.out).length).toBeGreaterThan(lines().length - inNow);
    expect(w.problems).toEqual([]);
  });

  test('the same town stepped the same way tells the same story', () => {
    const a = run(90).t.crowd.people.map((p) => [p.id, p.mode, p.load, p.x.toFixed(4), p.z.toFixed(4)]);
    const b = run(90).t.crowd.people.map((p) => [p.id, p.mode, p.load, p.x.toFixed(4), p.z.toFixed(4)]);
    expect(b).toEqual(a);
  });
});
