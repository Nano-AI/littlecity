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
    expect(beats).toEqual(['sighted', 'landing', 'ashore', 'recall', 'away']);
    expect(ashore).toBeGreaterThanOrEqual(8);
    expect(raid.burnt).toBeGreaterThanOrEqual(2);
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
    t.run(30);
    expect(crowdOf(t.stage)!.people.filter((p) => (p.goal?.errand?.tag ?? '').startsWith('flee:')).length).toBe(0);
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
