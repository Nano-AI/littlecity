// The raid (design section 13b): grown towns raided from the first sight of
// the sail to the last of it, with the app's own wiring and no renderer
// (tests/helpers/turmoil.ts). Waits on the raid's state, never on the clock.

import { describe, expect, test } from 'vitest';
import { encodeTown } from '@/world/save';
import { setStyle } from '@/core/style';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { RAID } from '@/style/raid';
import { createTurmoil, type Turmoil } from '../../../tests/helpers/turmoil';
import { FULL } from '../../../tests/helpers/tier';
import { crowdOf } from '../doors/table';
import { raidsOf } from './raids';
import { KINDS } from '@/core/kinds';
import { throwerOf } from '../mischief/thrown.system';
import { crittersOf } from '../mischief/critters';
import type { Raid } from './raid';

const LONG = FULL ? 400_000 : 200_000;

function town(name: string): Turmoil {
  const built = buildScenario(findScenario(name)!);
  const t = createTurmoil({ world: built.world, terrain: built.terrain });
  t.run(3);
  return t;
}

/** Runs until `done` or `most` life seconds, a second at a time. */
function until(t: Turmoil, done: () => boolean, most: number): void {
  for (let s = 0; s < most && !done(); s++) t.run(1);
}

/** Nothing of the raid is left: no raider in the crowd, nobody on its plans, nothing it drew. */
function putAway(t: Turmoil): void {
  const raids = raidsOf(t.stage);
  expect(raids.current).toBeNull();
  const crowd = crowdOf(t.stage)!;
  expect(crowd.people.filter((p) => p.raider && p.mode !== 'gone').map((p) => p.id)).toEqual([]);
  const board = raids.board!;
  expect([...board.plans.values()].filter((p) => p.chain.id === 'raid').length).toBe(0);
  expect(t.mischief.threats.length).toBe(0);
}

/** Every raider ashore stands on the walking graph (never in a solid cell or off it). */
function onGraph(t: Turmoil, raid: Raid): string[] {
  const bad: string[] = [];
  const nav = crowdOf(t.stage)!.nav!;
  for (const r of raid.raiders) {
    const p = r.person;
    if (!p || p.mode === 'gone' || (p.mode as string) === 'thrown' || p.mode === 'visit') continue;
    if (!nav.nodeAt.has(p.cell)) bad.push(`${r.i} at ${p.cell}`);
  }
  return bad;
}

describe('the raid', () => {
  test('a landing raid on the harbour town: sighted, ashore, fires and loot, away, everything put away; undo puts the town back', () => {
    const t = town('grown-harbour');
    const before = encodeTown(t.game.world);
    const raids = raidsOf(t.stage);
    expect(raids.summon({ at: null, kind: 'landing' })).toBeNull();
    const raid = raids.current!;
    expect(raid.kind).toBe('landing');
    const beats: string[] = [];
    let ashore = 0, pile = 0, offGraph: string[] = [];
    t.onFrame = () => {
      if (!raids.current) return;
      if (beats[beats.length - 1] !== raid.beat) beats.push(raid.beat);
      ashore = Math.max(ashore, raid.raiders.filter((x) => x.person !== null).length);
      const s = raids.board?.stores.get(raid.piles[0]!.key);
      if (s) pile = Math.max(pile, s.items.filter((x) => x).length);
      if (offGraph.length === 0) offGraph = onGraph(t, raid);
    };
    until(t, () => raids.current === null, 400);
    t.onFrame = null;
    expect(beats).toEqual(['sighted', 'landing', 'ashore', 'recall', 'away', 'done']);
    expect(ashore).toBeGreaterThanOrEqual(8);
    expect(raid.burnt).toBeGreaterThanOrEqual(4);
    // The town fought back: a brawl or more, and a raider or more sent packing.
    console.log('brawls', raid.brawls, 'beaten', raid.beatenCount, 'burnt', raid.burnt, 'quarters', raid.quarters.length);
    expect(raid.brawls).toBeGreaterThan(0);
    expect(pile).toBeGreaterThan(0);
    expect(raid.ship.heap).toBeGreaterThan(0);
    expect(offGraph).toEqual([]);
    putAway(t);
    // Its damage is ordinary damage, and nothing was added to the saved town: one undo, and it is as before.
    expect([...t.game.world.blocks.values()].some((b) => b.ruin)).toBe(true);
    until(t, () => !t.mischief.active, 200);
    t.game.undo();
    expect(encodeTown(t.game.world)).toBe(before);
    // The villagers come home: nobody is still running from raiders.
    const running = (): number => crowdOf(t.stage)!.people.filter((p) => (p.mode === 'walk' || p.mode === 'linger') && (p.goal?.errand?.tag ?? '').startsWith('flee:')).length;
    until(t, () => running() === 0, 120);
    const still = crowdOf(t.stage)!.people.filter((p) => (p.mode === 'walk' || p.mode === 'linger') && (p.goal?.errand?.tag ?? '').startsWith('flee:'));
    expect(still.length).toBe(0);
  }, LONG);

  test('a raid on a town already wrecked and mending (the owner\'s town): the band keeps moving, never a clump, and the raid ends', () => {
    const t = town('grown-harbour');
    for (const s of t.game.shape.structures.values()) if (KINDS[s.kind as keyof typeof KINDS]?.building) t.mischief.knock(s.cells[0]!);
    until(t, () => !t.mischief.active, 60);
    t.run(15);
    expect([...t.game.world.blocks.values()].filter((b) => b.ruin).length, 'the town is in scaffolding').toBeGreaterThan(20);
    const raids = raidsOf(t.stage);
    expect(raids.summon({ at: null, kind: 'landing' })).toBeNull();
    const raid = raids.current!;
    // Each raider ashore: where he was and since when he has not moved.
    const still = new Map<number, { x: number; z: number; since: number }>();
    let worst = 0, worstAt = '';
    t.onFrame = () => {
      if (!raids.current || raid.beat !== 'ashore') return;
      let n = 0;
      for (const r of raid.raiders) {
        const p = r.person;
        if (!p || r.role === 'chief' || p.scuffle || (p.mode as string) === 'thrown' || p.mode === 'visit' || (p.goal?.errand?.tag ?? '') === 'raid:board') {
          still.delete(r.i);
          continue;
        }
        const s = still.get(r.i);
        if (!s || Math.hypot(s.x - p.x, s.z - p.z) > 0.08) still.set(r.i, { x: p.x, z: p.z, since: t.t });
        else if (t.t - s.since > 4) n++;
      }
      if (n > worst) {
        worst = n;
        worstAt = `${Math.round(raid.age)} s`;
      }
    };
    until(t, () => raids.current === null, 400);
    t.onFrame = null;
    expect(raids.current, 'the raid ended').toBeNull();
    expect(worst, `raiders standing still more than 4 s at once (worst at ${worstAt})`).toBeLessThanOrEqual(3);
    expect(raid.burnt + raid.raiders.reduce((a, r) => a + r.trips, 0), 'they found things to burn and carry off').toBeGreaterThan(5);
    putAway(t);
  }, LONG);

  test('at sea, whoever is aboard moves rigidly with the vessel every frame (no judder against the hull)', () => {
    const t = town('grown-harbour');
    const raids = raidsOf(t.stage);
    raids.summon({ at: null, kind: 'boats' });
    const raid = raids.current!;
    // In each vessel's own frame, how far each seated raider's feet move from one frame to the next.
    const last = new Map<number, [number, number, number]>();
    let worst = 0, frames = 0;
    t.onFrame = () => {
      for (const r of raid.raiders) {
        if (r.where !== 'aboard' || !r.fig) continue;
        const v = raid.vesselOf(r), m = v.m;
        const dx = r.fig.at[0] - m[12]!, dy = r.fig.at[1] - m[13]!, dz = r.fig.at[2] - m[14]!;
        // Into the hull's frame (its axes are orthonormal: the transpose undoes them).
        const local: [number, number, number] = [m[0]! * dx + m[1]! * dy + m[2]! * dz, m[4]! * dx + m[5]! * dy + m[6]! * dz, m[8]! * dx + m[9]! * dy + m[10]! * dz];
        const was = last.get(r.i);
        // (The first frame of all has no drawing before it.)
        if (was && frames > 1) worst = Math.max(worst, Math.hypot(local[0] - was[0], local[1] - was[1], local[2] - was[2]));
        last.set(r.i, local);
      }
      frames++;
    };
    until(t, () => raid.beat !== 'sighted', 60);
    t.onFrame = null;
    expect(frames).toBeGreaterThan(100);
    expect(worst, 'a rower slid against the hull in one frame (world units)').toBeLessThan(0.005);
    t.mischief.cancel();
  }, LONG);

  test('a boats raid: the big ship stands off, its boats row to two or more landings and carry the band back', () => {
    const t = town('grown-market');
    const raids = raidsOf(t.stage);
    expect(raids.summon({ at: null, kind: 'boats' })).toBeNull();
    const raid = raids.current!;
    expect(raid.kind).toBe('boats');
    expect(raid.boats.length).toBeGreaterThanOrEqual(2);
    expect(new Set(raid.site.landings.map((l) => l.cell)).size).toBe(raid.boats.length);
    let ashore = 0;
    t.onFrame = () => {
      if (raids.current) ashore = Math.max(ashore, raid.raiders.filter((x) => x.person !== null).length);
    };
    until(t, () => raids.current === null, 420);
    t.onFrame = null;
    expect(ashore).toBeGreaterThanOrEqual(6);
    expect(raid.raiders.every((r) => r.where === 'home' || r.where === 'lost')).toBe(true);
    putAway(t);
  }, LONG);

  test('the ship sunk before it lands: the raid never happens; nobody comes ashore', () => {
    const t = town('grown-harbour');
    const raids = raidsOf(t.stage);
    raids.summon({ at: null, kind: 'landing' });
    const raid = raids.current!;
    until(t, () => !raid.ship.edgeCut && raid.shipState === 'arrive', 60);
    t.run(2);
    t.mischief.dropBomb([raid.ship.x, 0.5, raid.ship.z]);
    until(t, () => raids.current === null, 200);
    expect(raid.raiders.every((r) => r.person === null)).toBe(true);
    expect(raid.raiders.every((r) => r.where === 'lost')).toBe(true);
    putAway(t);
  }, LONG);

  test('the ship sunk while the band is ashore: stranded, they run into the sea and swim away', () => {
    const t = town('grown-harbour');
    const raids = raidsOf(t.stage);
    raids.summon({ at: null, kind: 'landing' });
    const raid = raids.current!;
    until(t, () => raid.beat === 'ashore' && raid.t > 15, 120);
    t.mischief.dropBomb([raid.ship.x, 0.5, raid.ship.z]);
    until(t, () => raid.stranded, 10);
    expect(raid.stranded).toBe(true);
    until(t, () => raids.current === null, 300);
    expect(raid.raiders.every((r) => r.where === 'lost')).toBe(true);
    putAway(t);
  }, LONG);

  test('the Hand: the longship lifted out of the water with its crew aboard and dropped on the town: stranded, the raid ends', () => {
    const t = town('grown-harbour');
    const raids = raidsOf(t.stage);
    raids.summon({ at: null, kind: 'landing' });
    const raid = raids.current!;
    until(t, () => raid.shipState === 'spin' || raid.shipState === 'in', 90);
    const thrower = throwerOf(t.stage)!;
    const c = crittersOf(t.stage).get(`ship:raid${raid.n}-0`)!;
    expect(c, 'the longship can be picked up').toBeDefined();
    expect(thrower.grabCritter(c)).toBe(true);
    const h = raid.site.heart;
    for (let i = 0; i < 30; i++) {
      thrower.carryCritter(c, raid.ship.x + (h.x - raid.ship.x) * (i / 30), 3, raid.ship.z + (h.z - raid.ship.z) * (i / 30));
      t.run(1 / 30);
    }
    expect(raid.ship.held, 'held up out of the water').not.toBeNull();
    expect(raid.raiders.filter((r) => r.where === 'aboard').length, 'the crew hang on').toBeGreaterThan(4);
    thrower.flingCritter(c, 0, 0, 0);
    for (let i = 0; i < 20 && raid.ship.aground === null; i++) {
      t.run(1);
    }
    expect(raid.stranded).toBe(true);
    until(t, () => raids.current === null, 200);
    putAway(t);
  }, LONG);

  test('undo in the middle of a raid ends it at once, and the town is as it was', () => {
    const t = town('grown-harbour');
    const before = encodeTown(t.game.world);
    const raids = raidsOf(t.stage);
    raids.summon({ at: null, kind: 'landing' });
    const raid = raids.current!;
    until(t, () => raid.burnt >= 1, 150);
    expect(t.mischief.active).toBe(true);
    t.mischief.cancel();
    t.run(1);
    putAway(t);
    expect(encodeTown(t.game.world)).toBe(before);
  }, LONG);

  test('raids on their own: none with the switch off; one, in time, with it on', () => {
    const t = town('grown-harbour');
    const raids = raidsOf(t.stage);
    const first = RAID.first;
    setStyle('raid', 'first', 5);
    try {
      raids.auto = false;
      t.run(30);
      expect(raids.count).toBe(0);
      raids.auto = true;
      until(t, () => raids.count > 0, 120);
      expect(raids.count).toBe(1);
      raids.auto = false;
      t.mischief.cancel();
      t.run(1);
      putAway(t);
    } finally {
      setStyle('raid', 'first', first);
    }
  }, LONG);
});
