// The walking graph on hand-built towns (design section 13). Every town is
// built through the scenario builder, so it holds only what a player could
// build, and resolved with the real rules: doors, terraces, gates and carved
// steps are whatever the joinery rules make of it.

import { describe, expect, test } from 'vitest';
import { E, key, keyX, keyY, keyZ, N, S, W, type CellKey } from '@/core/grid';
import { resolveTown } from '@/resolve/index';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import type { Terrain } from '@/core/world';
import { connected, otherEnd, usableDoors } from './nav';
import type { NavGraph, NavLink, ShapePlan } from './plan';

interface Town {
  shape: ShapePlan;
  nav: NavGraph;
  b: TownBuilder;
  at(x: number, y: number, z: number): number;
  link(a: number, b: number): NavLink | undefined;
  /** Nodes reachable from `from` without using interior links. */
  outdoors(from: number): Set<number>;
}

function town(build: (b: TownBuilder) => void, terrain: Terrain = flatTerrain(5)): Town {
  const b = new TownBuilder(emptyWorld(5), terrain);
  build(b);
  const { shape, dressing } = resolveTown(b.world, terrain);
  const nav = dressing.nav;
  const linksOf = (n: number): NavLink[] => {
    const out: NavLink[] = [];
    for (let k = nav.linkStart[n]!; k < nav.linkStart[n + 1]!; k++) out.push(nav.links[nav.linkOf[k]!]!);
    return out;
  };
  return {
    shape,
    nav,
    b,
    at: (x, y, z) => nav.nodeAt.get(key(x, y, z)) ?? -1,
    link: (a, c) => (a < 0 || c < 0 ? undefined : linksOf(a).find((l) => otherEnd(l, a) === c)),
    outdoors(from) {
      const seen = new Set([from]);
      const todo = [from];
      while (todo.length > 0) {
        const n = todo.pop()!;
        for (const l of linksOf(n)) {
          const o = otherEnd(l, n);
          if (l.via !== 'interior' && !seen.has(o)) {
            seen.add(o);
            todo.push(o);
          }
        }
      }
      return seen;
    },
  };
}

function hill(build: (t: TerrainBuilder) => void): Terrain {
  const t = new TerrainBuilder(5);
  t.flat(1);
  build(t);
  return t.build();
}

const cellOf = (nav: NavGraph, n: number): [number, number, number] => {
  const c: CellKey = nav.nodes[n]!.cell;
  return [keyX(c), keyY(c), keyZ(c)];
};

describe('nodes', () => {
  test('open ground: every land cell is a node, linked to its four neighbours; water has none', () => {
    const t = town(() => {});
    expect(t.nav.nodes.length).toBe(40 * 40);
    expect(t.at(3, 1, 10)).toBe(-1); // water
    expect(t.at(3, 0, 10)).toBe(-1);
    const a = t.at(10, 1, 10);
    expect(t.nav.nodes[a]).toMatchObject({ surface: 'grass', cost: 3 });
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      expect(t.link(a, t.at(10 + dx, 1, 10 + dz))).toMatchObject({ via: 'walk' });
    }
    expect(t.link(a, t.at(11, 1, 11))).toBeUndefined(); // no diagonals
    expect(new Set(t.nav.part).size).toBe(1);
  });

  test('floors set the surface and its cost (L24)', () => {
    const t = town((b) => {
      b.path(10, 10, 12, 10);
      b.plaza(10, 12, 12, 13);
      b.garden(10, 15, 11, 15);
    });
    expect(t.nav.nodes[t.at(11, 1, 10)]).toMatchObject({ surface: 'path', cost: 1 });
    expect(t.nav.nodes[t.at(11, 1, 12)]).toMatchObject({ surface: 'plaza', cost: 1 });
    expect(t.nav.nodes[t.at(10, 1, 15)]).toMatchObject({ surface: 'garden' });
    expect(t.nav.nodes[t.at(11, 1, 11)]).toMatchObject({ surface: 'grass', cost: 3 });
  });

  test('a tree, a fountain, a stall and a building are not nodes; the cells round them are', () => {
    const t = town((b) => {
      b.plaza(10, 10, 14, 12);
      b.put('tree', 10, 11).put('fountain', 12, 11).put('stall', 14, 11);
      b.house(20, 20);
      b.put('windmill', 24, 20);
    });
    for (const x of [10, 12, 14]) expect(t.at(x, 1, 11)).toBe(-1);
    expect(t.at(11, 1, 11)).toBeGreaterThanOrEqual(0);
    expect(t.at(20, 1, 20)).toBe(-1);
    expect(t.at(20, 2, 20)).toBe(-1); // a pitched roof is not walked on
    expect(t.at(24, 1, 20)).toBe(-1);
    // People walk round the fountain: its two sides are still joined the long way.
    expect(connected(t.nav, t.at(11, 1, 11), t.at(13, 1, 11))).toBe(true);
    expect(t.link(t.at(11, 1, 11), t.at(13, 1, 11))).toBeUndefined();
  });

  test('a dock is walked on at beach level and joins the shore', () => {
    const t = town((b) => {
      for (let x = 3; x >= 1; x--) b.block('dock', x, 0, 10);
    });
    const shore = t.at(4, 1, 10), deck = t.at(3, 1, 10), end = t.at(1, 1, 10);
    expect(t.nav.nodes[deck]).toMatchObject({ surface: 'deck', cost: 1.5 });
    expect(t.link(shore, deck)).toMatchObject({ via: 'walk' });
    expect(connected(t.nav, shore, end)).toBe(true);
    expect(t.at(0, 1, 10)).toBe(-1);
    expect(t.at(2, 1, 11)).toBe(-1);
  });
});

describe('fences, walls and gates', () => {
  test('an edge piece cuts the link across it and no other', () => {
    const t = town((b) => b.fenceEdge(10, 10, 'E'));
    expect(t.link(t.at(10, 1, 10), t.at(11, 1, 10))).toBeUndefined();
    expect(t.link(t.at(10, 1, 11), t.at(11, 1, 11))).toBeDefined();
    expect(t.link(t.at(10, 1, 10), t.at(10, 1, 11))).toBeDefined();
  });

  test('a fenced garden with no gate has no route in; a path through the fence makes a gate', () => {
    const closed = town((b) => {
      b.garden(10, 10, 12, 12);
      b.fenceAround(10, 10, 12, 12);
    });
    const inside = closed.at(11, 1, 11), outside = closed.at(11, 1, 14);
    expect(connected(closed.nav, inside, outside)).toBe(false);
    expect(closed.nav.partFloors[closed.nav.part[inside]!]).toBe(9);
    expect(closed.nav.partFloors[closed.nav.part[outside]!]).toBe(0);

    const gated = town((b) => {
      b.garden(10, 10, 12, 12);
      b.fenceAround(10, 10, 12, 12);
      b.path(11, 12, 11, 15); // over the garden's south cell and out through the fence
    });
    const a = gated.at(11, 1, 12), c = gated.at(11, 1, 13);
    expect(gated.link(a, c)).toMatchObject({ via: 'gate' });
    expect(connected(gated.nav, gated.at(11, 1, 11), gated.at(11, 1, 15))).toBe(true);
    // The gate is the only way in: one outdoor crossing of the fence line.
    const crossing = gated.nav.links.filter((l) => {
      const [ax, , az] = cellOf(gated.nav, l.a), [bx, , bz] = cellOf(gated.nav, l.b);
      const isIn = (x: number, z: number): boolean => x >= 10 && x <= 12 && z >= 10 && z <= 12;
      return isIn(ax, az) !== isIn(bx, bz);
    });
    expect(crossing).toHaveLength(1);
    // A gate is single file: people queue at its two ends.
    const run = gated.nav.runs[gated.nav.runOf[gated.nav.links.indexOf(crossing[0]!)]!]!;
    expect(run.ends).toEqual([a, c].sort((p, q) => p - q));
  });

  test('a cell fence is in the way unless it stands on a path, which makes it a gate crossed one way only', () => {
    const t = town((b) => {
      for (let x = 10; x <= 14; x++) b.put('fence', x, 10);
      b.path(12, 8, 12, 12);
    });
    expect(t.at(10, 1, 10)).toBe(-1);
    const gate = t.at(12, 1, 10);
    expect(t.nav.nodes[gate]!.passage! & 1).toBe(N & 1);
    expect(t.link(gate, t.at(12, 1, 9))).toMatchObject({ via: 'gate' });
    expect(t.link(gate, t.at(12, 1, 11))).toMatchObject({ via: 'gate' });
    expect(t.link(gate, t.at(11, 1, 10))).toBeUndefined();
  });

  test('a low wall cuts a town in two until a path goes through it', () => {
    const wall = (b: TownBuilder): void => {
      for (let z = 4; z <= 43; z++) b.wallEdge(20, z, 'E');
    };
    const cut = town(wall);
    expect(connected(cut.nav, cut.at(20, 1, 20), cut.at(21, 1, 20))).toBe(false);
    const open = town((b) => {
      wall(b);
      b.path(19, 20, 22, 20);
    });
    expect(open.link(open.at(20, 1, 20), open.at(21, 1, 20))).toMatchObject({ via: 'gate' });
    expect(connected(open.nav, open.at(20, 1, 30), open.at(21, 1, 30))).toBe(true);
  });
});

describe('going up', () => {
  test('stairs link their low side to their high side one level up, and nothing sideways', () => {
    const t = town((b) => {
      b.fill('marble', 11, 10, 12, 11);
      b.block('stairs', 10, 1, 10, { rot: E });
    });
    const foot = t.at(9, 1, 10), flight = t.at(10, 1, 10), head = t.at(11, 2, 10);
    expect(t.nav.nodes[flight]).toMatchObject({ surface: 'stairs', rot: E });
    expect(t.link(foot, flight)).toMatchObject({ via: 'walk' });
    expect(t.link(flight, head)).toMatchObject({ via: 'stairs', a: flight, b: head });
    expect(t.link(flight, t.at(10, 1, 9))).toBeUndefined();
    expect(t.link(flight, t.at(10, 1, 11))).toBeUndefined();
    expect(t.nav.nodes[head]).toMatchObject({ surface: 'deck' });
    // The marble top is reached only by the flight.
    const run = t.nav.runs[t.nav.runOf[t.nav.links.indexOf(t.link(flight, head)!)]!]!;
    expect(run.ends).toEqual([foot, head].sort((a, b) => a - b));
    expect(run.links).toHaveLength(2);
    const without = town((b) => b.fill('marble', 11, 10, 12, 11));
    expect(connected(without.nav, without.at(9, 1, 10), without.at(11, 2, 10))).toBe(false);
  });

  test('a long flight is one run; a wide flight is not single file', () => {
    const long = town((b) => {
      b.fill('marble', 11, 10, 13, 10);
      b.fill('marble', 12, 10, 13, 10); // second storey from x = 12
      b.block('stairs', 10, 1, 10, { rot: E });
      b.block('stairs', 11, 2, 10, { rot: E });
    });
    const s1 = long.at(10, 1, 10), s2 = long.at(11, 2, 10), top = long.at(12, 3, 10);
    expect(long.link(s1, s2)).toMatchObject({ via: 'stairs' });
    expect(long.link(s2, top)).toMatchObject({ via: 'stairs' });
    const run = long.nav.runs[long.nav.runOf[long.nav.links.indexOf(long.link(s1, s2)!)]!]!;
    expect(run.links).toHaveLength(3);
    expect(run.ends).toEqual([long.at(9, 1, 10), top].sort((a, b) => a - b));

    const wide = town((b) => {
      b.fill('marble', 11, 10, 12, 11);
      b.block('stairs', 10, 1, 10, { rot: E });
      b.block('stairs', 10, 1, 11, { rot: E });
    });
    const a = wide.at(10, 1, 10), c = wide.at(10, 1, 11);
    expect(wide.link(a, c)).toMatchObject({ via: 'walk' });
    expect(wide.nav.runOf[wide.nav.links.indexOf(wide.link(a, wide.at(11, 2, 10))!)]).toBe(-1);
  });

  test('a house on a marble terrace is reached by the stairs', () => {
    const t = town((b) => {
      b.fill('marble', 10, 10, 13, 13);
      b.block('house', 12, 2, 12);
      b.block('stairs', 9, 1, 11, { rot: E });
      b.path(5, 11, 8, 11);
    });
    const doors = usableDoors(t.nav, t.shape.structureAt.get(key(12, 2, 12))!);
    expect(doors.length).toBeGreaterThan(0);
    expect(keyY(t.nav.nodes[doors[0]!.node]!.cell)).toBe(2);
    expect(connected(t.nav, doors[0]!.node, t.at(5, 1, 11))).toBe(true);
    // Take the flight away and the house is cut off.
    const cut = town((b) => {
      b.fill('marble', 10, 10, 13, 13);
      b.block('house', 12, 2, 12);
    });
    const door = usableDoors(cut.nav, cut.shape.structureAt.get(key(12, 2, 12))!)[0]!;
    expect(connected(cut.nav, door.node, cut.at(5, 1, 11))).toBe(false);
    expect(cut.nav.partFloors[cut.nav.part[door.node]!]).toBe(0);
  });

  test('a one-level step in the ground is crossed only where a path carved steps (J17)', () => {
    const terrain = hill((t) => t.rect(20, 4, 43, 43, 2));
    const bare = town(() => {}, terrain);
    expect(bare.link(bare.at(19, 1, 20), bare.at(20, 2, 20))).toBeUndefined();
    expect(connected(bare.nav, bare.at(19, 1, 20), bare.at(20, 2, 20))).toBe(false);
    const carved = town((b) => b.path(17, 20, 23, 20), terrain);
    const low = carved.at(19, 1, 20), high = carved.at(20, 2, 20);
    expect(carved.link(low, high)).toMatchObject({ via: 'steps', a: low, b: high });
    expect(carved.link(carved.at(19, 1, 21), carved.at(20, 2, 21))).toBeUndefined();
    expect(connected(carved.nav, carved.at(10, 1, 10), carved.at(30, 2, 30))).toBe(true);
  });
});

describe('through buildings', () => {
  test('a sky bridge joins two houses: doors at deck level, interior links down to the street', () => {
    const t = town((b) => {
      b.house(10, 10, { floors: 3, color: 1 });
      b.house(14, 10, { floors: 3, color: 2 });
      for (let x = 11; x <= 13; x++) b.block('arch', x, 2, 10);
    });
    const A = t.shape.structureAt.get(key(10, 1, 10))!, B = t.shape.structureAt.get(key(14, 1, 10))!;
    const deckA = t.at(11, 3, 10), deckB = t.at(13, 3, 10);
    expect(t.nav.nodes[deckA]).toMatchObject({ surface: 'deck' });
    const doorsA = usableDoors(t.nav, A), doorsB = usableDoors(t.nav, B);
    expect(doorsA.map((d) => d.node)).toContain(deckA);
    expect(doorsB.map((d) => d.node)).toContain(deckB);
    expect(doorsA[0]!.main).toBe(true);
    const streetA = doorsA[0]!.node, streetB = doorsB[0]!.node;
    // Up through house A: two storeys, two seconds.
    expect(t.link(streetA, deckA)).toMatchObject({ via: 'interior', structure: A, seconds: 2 });
    expect(connected(t.nav, streetA, deckB)).toBe(true);
    // The deck is reached from the ground only through a house.
    expect(t.outdoors(deckA).has(streetA)).toBe(false);
    expect([...t.outdoors(deckA)].every((n) => keyY(t.nav.nodes[n]!.cell) === 3)).toBe(true);
    expect(t.link(streetB, deckB)).toMatchObject({ via: 'interior', structure: B });
  });

  test('a roof terrace with no stairs is reached only through its building, by a hatch', () => {
    const t = town((b) => {
      b.house(10, 10, { w: 2, d: 2 });
      b.plaza(10, 10, 11, 11); // a floor laid on the roof makes it a terrace (J04)
      b.path(8, 12, 13, 12);
    });
    const house = t.shape.structureAt.get(key(10, 1, 10))!;
    const roof = t.at(10, 2, 10);
    expect(roof).toBeGreaterThanOrEqual(0);
    const doors = usableDoors(t.nav, house);
    const hatch = doors.find((d) => d.hatch)!;
    const main = doors.find((d) => d.main)!;
    expect(hatch.dir).toBeUndefined();
    expect(keyY(t.nav.nodes[hatch.node]!.cell)).toBe(2);
    expect(t.link(main.node, hatch.node)).toMatchObject({ via: 'interior', structure: house, seconds: 1 });
    expect(t.outdoors(roof).size).toBe(4);
    expect(connected(t.nav, roof, t.at(8, 1, 12))).toBe(true);
  });

  test('every pair of doors of one building is linked, at one second per storey', () => {
    const t = town((b) => {
      b.fill('marble', 12, 10, 13, 10, { floors: 2 });
      b.house(11, 10, { floors: 3 }); // its third storey meets the marble top
    });
    const house = t.shape.structureAt.get(key(11, 1, 10))!;
    const doors = usableDoors(t.nav, house);
    expect(doors.length).toBe(2);
    const [main, deck] = doors as [typeof doors[0], typeof doors[0]];
    expect(keyY(deck!.cell) - keyY(main!.cell)).toBe(2);
    expect(t.link(main!.node, deck!.node)).toMatchObject({ via: 'interior', seconds: 2, cost: 2 });
  });

  test('a ground arch is crossed along its passage only', () => {
    const t = town((b) => {
      b.fill('marble', 10, 9, 10, 9);
      b.fill('marble', 10, 11, 10, 11);
      b.block('arch', 10, 1, 10); // spans north–south between the two blocks
      b.path(8, 10, 9, 10).path(11, 10, 12, 10);
    });
    const arch = t.at(10, 1, 10);
    expect(arch).toBeGreaterThanOrEqual(0);
    expect(t.nav.nodes[arch]!.passage! & 1).toBe(E & 1);
    expect(t.link(arch, t.at(9, 1, 10))).toBeDefined();
    expect(t.link(arch, t.at(11, 1, 10))).toBeDefined();
    expect(t.nav.nodes[t.at(10, 2, 10)]).toMatchObject({ surface: 'deck' }); // and its top is a deck
    expect(connected(t.nav, t.at(10, 2, 10), arch)).toBe(false);
  });
});

describe('cut off', () => {
  test('a house whose door opens onto nothing walkable has no usable door', () => {
    const terrain = hill((t) => t.rect(20, 20, 20, 20, 3));
    const t = town((b) => b.block('house', 20, 3, 20), terrain);
    const house = t.shape.structureAt.get(key(20, 3, 20))!;
    expect(t.nav.doorsOf.get(house)!.length).toBeGreaterThan(0);
    expect(usableDoors(t.nav, house)).toHaveLength(0);
  });

  test('a house on its own islet: a door, a little ground, and no route to the town', () => {
    const terrain = hill((t) => {
      t.water(18, 18, 26, 26);
      t.rect(21, 21, 23, 23, 1);
    });
    const t = town((b) => {
      b.house(22, 22);
      b.plaza(8, 8, 10, 10);
    }, terrain);
    const door = usableDoors(t.nav, t.shape.structureAt.get(key(22, 1, 22))!)[0]!;
    expect(door.node).toBeGreaterThanOrEqual(0);
    expect(connected(t.nav, door.node, t.at(9, 1, 9))).toBe(false);
    expect(t.nav.partFloors[t.nav.part[door.node]!]).toBe(0);
    expect(t.outdoors(door.node).size).toBe(8);
  });
});

describe('the graph as data', () => {
  test('adjacency lists every link twice, and links name real nodes', () => {
    const t = town((b) => {
      b.house(10, 10, { floors: 2, w: 2 });
      b.fill('marble', 14, 10, 15, 11);
      b.block('stairs', 13, 1, 10, { rot: E });
      b.fenceAround(20, 20, 22, 22);
      b.path(8, 12, 22, 12);
    });
    const { nav } = t;
    expect(nav.linkOf.length).toBe(nav.links.length * 2);
    expect(nav.linkStart[nav.nodes.length]).toBe(nav.linkOf.length);
    const seen = new Uint8Array(nav.links.length);
    for (let n = 0; n < nav.nodes.length; n++) {
      for (let k = nav.linkStart[n]!; k < nav.linkStart[n + 1]!; k++) {
        const l = nav.links[nav.linkOf[k]!]!;
        expect(l.a === n || l.b === n).toBe(true);
        seen[nav.linkOf[k]!]!++;
      }
    }
    expect([...seen].every((c) => c === 2)).toBe(true);
    for (let i = 1; i < nav.nodes.length; i++) expect(nav.nodes[i]!.cell).toBeGreaterThan(nav.nodes[i - 1]!.cell);
    for (const [cell, i] of nav.nodeAt) expect(nav.nodes[i]!.cell).toBe(cell);
    // Linked nodes are side by side, or one level apart on stairs and steps; never further.
    for (const l of nav.links) {
      if (l.via === 'interior') continue;
      const [ax, ay, az] = cellOf(nav, l.a), [bx, by, bz] = cellOf(nav, l.b);
      expect(Math.abs(ax - bx) + Math.abs(az - bz)).toBe(1);
      expect(by - ay).toBe(l.via === 'stairs' || l.via === 'steps' ? 1 : 0);
    }
  });

  test('the same town gives the same graph', () => {
    const build = (b: TownBuilder): void => {
      b.house(10, 10, { floors: 2 });
      b.path(8, 11, 14, 11);
      b.put('tree', 12, 12);
    };
    const a = town(build).nav, c = town(build).nav;
    expect(c.nodes).toEqual(a.nodes);
    expect(c.links).toEqual(a.links);
    expect(c.doors).toEqual(a.doors);
  });

  test('directions used above', () => {
    expect([N, E, S, W]).toEqual([0, 1, 2, 3]);
  });
});
