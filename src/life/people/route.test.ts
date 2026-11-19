// Routing (catalogue L24): the costs, the way through buildings, and that
// asking again costs nothing.

import { describe, expect, test } from 'vitest';
import { E, key, keyX, keyY, keyZ } from '@/core/grid';
import { usableDoors } from '@/resolve/nav';
import bench from '../../../scenarios/bench/bench-2000.scenario';
import { createRouter } from './route';
import { scenarioTown, townOf } from './testing';
import { buildWalk, pieceAt } from './walk';

describe('routes', () => {
  test('people keep to the path where there is one: three times the distance on a path beats grass', () => {
    const town = townOf((b) => {
      // A path that goes round three sides of a lawn.
      b.path(10, 10, 10, 16).path(11, 16, 18, 16).path(18, 10, 18, 15);
    });
    const { nav } = town;
    const router = createRouter(nav);
    const from = nav.nodeAt.get(key(10, 1, 10))!, to = nav.nodeAt.get(key(18, 1, 10))!;
    const route = router.find(from, to)!;
    expect(route.nodes[0]).toBe(from);
    expect(route.nodes.at(-1)).toBe(to);
    // 20 path steps (cost 20) rather than 8 across the grass (cost 22).
    expect(route.nodes.every((n) => nav.nodes[n]!.surface === 'path')).toBe(true);
    expect(route.cost).toBe(20);
    // Take a side of the path away and the grass is the way.
    const short = createRouter(townOf((b) => b.path(10, 10, 10, 16).path(18, 10, 18, 16)).nav);
    const cut = short.find(short.nav.nodeAt.get(key(10, 1, 10))!, short.nav.nodeAt.get(key(18, 1, 10))!)!;
    expect(cut.nodes).toHaveLength(9);
    expect(cut.cost).toBe(0.5 + 7 * 3 + 0.5); // half a path cell at each end, seven of grass
  });

  test('a deck costs 1.5 a cell and a plaza 1', () => {
    const town = townOf((b) => {
      b.plaza(10, 10, 14, 10);
      for (let x = 3; x >= 1; x--) b.block('dock', x, 0, 20);
    });
    const r = createRouter(town.nav);
    const at = (x: number, z: number): number => town.nav.nodeAt.get(key(x, 1, z))!;
    expect(r.find(at(10, 10), at(14, 10))!.cost).toBe(4);
    expect(r.find(at(1, 20), at(3, 20))!.cost).toBe(3);
  });

  test('a route is a chain of links, each joining its two nodes', () => {
    const town = townOf((b) => {
      b.fill('marble', 12, 10, 14, 12);
      b.block('stairs', 11, 1, 11, { rot: E });
      b.block('house', 14, 2, 10);
      b.path(6, 11, 10, 11);
    });
    const { nav } = town;
    const door = usableDoors(nav, town.shape.structureAt.get(key(14, 2, 10))!)[0]!;
    const route = createRouter(nav).find(nav.nodeAt.get(key(6, 1, 11))!, door.node)!;
    expect(route.links).toHaveLength(route.nodes.length - 1);
    route.links.forEach((l, i) => {
      const link = nav.links[l]!;
      expect([link.a, link.b].sort()).toEqual([route.nodes[i]!, route.nodes[i + 1]!].sort());
    });
    expect(route.links.map((l) => nav.links[l]!.via)).toContain('stairs');
    expect(keyY(nav.nodes[route.nodes.at(-1)!]!.cell)).toBe(2);
  });

  test('nobody cuts through a stranger’s house, but a house is a way up when it is the only one', () => {
    // A long house with a door at each end (its second door opens onto the marble behind it).
    const town = townOf((b) => {
      b.fill('marble', 12, 10, 13, 10, { floors: 2 });
      b.house(11, 10, { floors: 3 });
      b.path(8, 11, 11, 11);
    });
    const { nav } = town;
    const house = town.shape.structureAt.get(key(11, 1, 10))!;
    const [main, deck] = usableDoors(nav, house);
    const router = createRouter(nav);
    // The marble top is reached only through the house: a stranger still gets there, at a price.
    const stranger = router.find(nav.nodeAt.get(key(8, 1, 11))!, deck!.node)!;
    const resident = router.find(nav.nodeAt.get(key(8, 1, 11))!, deck!.node, [house])!;
    expect(stranger.links.some((l) => nav.links[l]!.via === 'interior')).toBe(true);
    expect(stranger.cost - resident.cost).toBe(12);
    expect(main!.main).toBe(true);
  });

  test('no route: different parts of the graph, or a node that is not there', () => {
    const town = townOf((b) => b.fill('marble', 20, 20, 21, 21));
    const router = createRouter(town.nav);
    const ground = town.nav.nodeAt.get(key(10, 1, 10))!, top = town.nav.nodeAt.get(key(20, 2, 20))!;
    expect(router.find(ground, top)).toBeNull();
    expect(router.find(ground, -1)).toBeNull();
    expect(router.find(ground, ground)).toEqual({ nodes: [ground], links: [], cost: 0 });
    expect(router.stats.searches).toBe(0); // none of these needed a search
  });

  test('asking again is free, and sixty fresh routes across the big town take a few milliseconds', () => {
    const town = scenarioTown(bench);
    const { nav } = town;
    const doors = nav.doors.filter((d) => d.node >= 0 && d.main);
    expect(doors.length).toBeGreaterThan(20);
    const router = createRouter(nav);
    const pairs: [number, number][] = [];
    for (let i = 0; i < 60; i++) pairs.push([doors[(i * 7) % doors.length]!.node, doors[(i * 13 + 5) % doors.length]!.node]);
    for (const [a, b] of pairs.slice(0, 5)) router.find(a, b); // warm up
    const t0 = performance.now();
    let found = 0;
    for (const [a, b] of pairs) if (router.find(a, b)) found++;
    const ms = performance.now() - t0;
    expect(found).toBeGreaterThan(0);
    const searches = router.stats.searches;
    for (const [a, b] of pairs) router.find(a, b);
    expect(router.stats.searches).toBe(searches);
    expect(router.stats.hits).toBeGreaterThanOrEqual(60);
    // Generous: it runs in about 5 ms; the point is that it is nowhere near a frame each.
    expect(ms).toBeLessThan(250);
  });
});

describe('the line walked', () => {
  test('a walk stays in the cells of its route and is continuous', () => {
    const town = townOf((b) => {
      b.fill('marble', 12, 10, 14, 12);
      b.block('stairs', 11, 1, 11, { rot: E });
      b.path(6, 11, 10, 11).path(6, 12, 6, 15);
    });
    const { nav } = town;
    const route = createRouter(nav).find(nav.nodeAt.get(key(6, 1, 15))!, nav.nodeAt.get(key(13, 2, 10))!)!;
    const walk = buildWalk(nav, route);
    expect(walk).toHaveLength(route.nodes.length);
    const at = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
    let px = NaN, py = NaN, pz = NaN;
    for (const piece of walk) {
      const cell = nav.nodes[piece.node]!.cell;
      for (let i = 0; i <= 10; i++) {
        pieceAt(piece, i / 10, at);
        expect(at.x).toBeGreaterThanOrEqual(keyX(cell) - 1e-9);
        expect(at.x).toBeLessThanOrEqual(keyX(cell) + 1 + 1e-9);
        expect(at.z).toBeGreaterThanOrEqual(keyZ(cell) - 1e-9);
        expect(at.z).toBeLessThanOrEqual(keyZ(cell) + 1 + 1e-9);
        if (!Number.isNaN(px)) {
          expect(Math.hypot(at.x - px, at.z - pz)).toBeLessThan(0.16);
          expect(Math.abs(at.y - py)).toBeLessThan(0.1);
        }
        px = at.x;
        py = at.y;
        pz = at.z;
      }
    }
    // It climbs: starts on the ground, ends on the marble, and is half-way up in the middle of the flight.
    pieceAt(walk[0]!, 0, at);
    expect(at.y).toBeCloseTo(0.8 + 0.015, 5);
    pieceAt(walk.at(-1)!, 1, at);
    expect(at.y).toBeCloseTo(1.6, 5);
    const flight = walk.find((p) => nav.nodes[p.node]!.rot !== undefined)!;
    pieceAt(flight, 0.5, at);
    expect(at.y).toBeCloseTo(1.2, 1);
  });

  test('people keep right: the two ways along a street are two lines', () => {
    const town = townOf((b) => b.path(10, 10, 20, 10));
    const { nav } = town;
    const router = createRouter(nav);
    const a = nav.nodeAt.get(key(10, 1, 10))!, b = nav.nodeAt.get(key(20, 1, 10))!;
    const east = buildWalk(nav, router.find(a, b)!, { lane: 0.1 }), west = buildWalk(nav, router.find(b, a)!, { lane: 0.1 });
    const at = { x: 0, y: 0, z: 0, dx: 0, dz: 0 };
    pieceAt(east[5]!, 0.5, at);
    const zEast = at.z;
    pieceAt(west[5]!, 0.5, at);
    // Walking east the right-hand side is south (+z); walking west it is north.
    expect(zEast).toBeCloseTo(10.6, 5);
    expect(at.z).toBeCloseTo(10.4, 5);
  });
});
