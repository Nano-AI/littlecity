// J19 beside a door. No door rule lives in the Ground owner's tree (doors are
// J06, J07 and J26, the Houses owner's), so the fixture scenario cannot show
// this case; a stand-in rule emits the door here.

import { describe, expect, test } from 'vitest';
import { key, S } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { resolveTown } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import J19 from './J19.edge-railing.rule';

/** A door on the south side of the top storey of every house. */
const topDoor = defineRule({
  id: 'J-T19.test-door',
  part: 'joinery',
  tier: 1,
  priority: 940,
  find: ({ facts }) =>
    [...facts.kinds]
      .filter(([cell, kind]) => kind === 'house' && facts.kinds.get(cell + (1 << 12)) !== 'house')
      .map(([cell]) => ({ anchor: cell, structure: facts.structureAt.get(cell)! })),
  apply: (c, out) => void out.feature({ type: 'door', structure: c.structure!, cell: c.anchor, dir: S, variant: 'deck' }),
});

function town(build: (b: TownBuilder) => void) {
  const terrain = flatTerrain(6);
  const b = new TownBuilder(emptyWorld(6), terrain);
  build(b);
  return resolveTown(b.world, terrain, { rules: [topDoor, J19] }).shape;
}

describe('J19 edge railing at a door', () => {
  test('a door onto a high terrace rails the terrace on its three open sides, drawn by the house', () => {
    const plan = town((b) => b.house(20, 20, { floors: 3 }).stack('marble', 20, 21, { floors: 2 }));
    const rails = plan.features.filter((f) => f.type === 'railing');
    expect(rails.map((f) => f.dir).sort()).toEqual([1, 2, 3]); // east, south, west; the house is to the north
    const house = plan.structureAt.get(key(20, 1, 20));
    for (const f of rails) {
      expect(f.cell).toBe(key(20, 3, 21));
      expect(f.structure).toBe(house);
      expect(f.variant).toBe('balustrade'); // it stands on marble
    }
  });

  test('a door onto a low step gets none', () => {
    const plan = town((b) => b.house(20, 20, { floors: 2 }).put('marble', 20, 21));
    expect(plan.features.filter((f) => f.type === 'railing')).toHaveLength(0);
  });

  test('a ground-floor door gets none', () => {
    const plan = town((b) => b.house(20, 20));
    expect(plan.features.filter((f) => f.type === 'railing')).toHaveLength(0);
  });
});
