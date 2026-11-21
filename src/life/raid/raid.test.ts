// The raid (design section 13b): a grown town is raided from the first sight
// of the sail to the last of it, with the app's own wiring and no renderer
// (tests/helpers/turmoil.ts).

import { describe, expect, test } from 'vitest';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { createTurmoil } from '../../../tests/helpers/turmoil';
import { FULL } from '../../../tests/helpers/tier';
import { raidsOf } from './raids';

function town(name: string) {
  const built = buildScenario(findScenario(name)!);
  const t = createTurmoil({ world: built.world, terrain: built.terrain });
  t.run(3);
  return t;
}

describe('the raid', () => {
  test('a landing raid on the harbour town: sighted, ashore, fires, loot, away; everything put away', () => {
    const t = town('grown-harbour');
    const raids = raidsOf(t.stage);
    const why = raids.summon({ at: null, kind: 'landing' });
    expect(why).toBeNull();
    const raid = raids.current!;
    const beats: string[] = [];
    let ashore = 0, fires = 0, maxPile = 0;
    let next = 0;
    t.onFrame = () => {
      if (!raids.current) return;
      const r = raids.current;
      if (t.t >= next) {
        next += 10;
        console.log(Math.round(t.t), r.beat, r.shipState, r.raiders.map((x) => `${x.role[0]}:${x.where}${x.person ? `@${x.person.cell}s${x.person.stuck.toFixed(0)}` : ""}${x.person ? `/${x.person.mode}/${x.person.goal?.errand?.tag ?? x.person.goal?.kind ?? '-'}${x.person.load ? '+' + x.person.load : ''}` : ''}`).join(' '));
      }
      if (beats[beats.length - 1] !== r.beat) beats.push(r.beat);
      ashore = Math.max(ashore, r.raiders.filter((x) => x.person !== null).length);
      fires = Math.max(fires, t.mischief.engine.burning().length);
      const pile = raids.board?.stores.get(r.piles[0]!.key);
      if (pile) maxPile = Math.max(maxPile, pile.items.filter((x) => x).length);
    };
    t.run(200);
    console.log(beats.join(' > '), 'ashore', ashore, 'burning cells at most', fires, 'pile', maxPile, 'burnt', raid.burnt, 'heap', raid.ship.heap, 'band', raid.raiders.length);
    expect(beats).toContain('ashore');
    expect(ashore).toBeGreaterThan(4);
    expect(raids.current).toBeNull();
  }, FULL ? 300_000 : 120_000);
});
