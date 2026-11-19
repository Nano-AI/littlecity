// The town the residents are watched in: streets, a square with a fountain
// and a stall, a pier, a path that climbs a hill by carved steps, a house on
// a marble terrace reached by a stairs flight, a sky bridge between two tall
// houses, a roof garden reached only through its house, and a fenced garden
// with a gate. Everything a route can be made of, in one place.

import { E, N } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'people-town',
  seed: 77,
  about: 'A small town with every kind of route in it, for watching the residents walk.',
  terrain(t) {
    t.flat(1);
    t.water(4, 34, 43, 43); // the sea to the south
    t.rect(26, 8, 43, 21, 2); // the hill
    t.rect(31, 8, 43, 16, 3); // and its top, which looks out over the sea to the east
  },
  build(b) {
    // The main street and the square.
    b.path(6, 25, 40, 25);
    b.plaza(14, 18, 19, 23);
    b.put('fountain', 16, 20);
    b.put('stall', 19, 22);
    b.put('tree', 14, 18).put('tree', 19, 18);
    b.path(16, 24, 16, 24);
    // Down to the pier.
    b.path(16, 26, 16, 33);
    for (let z = 34; z <= 38; z++) b.block('dock', 16, 0, z);
    b.block('dock', 15, 0, 38).block('dock', 17, 0, 38);

    // Houses along the south side of the street.
    b.house(8, 26, { floors: 2, w: 2, color: 0 });
    b.house(11, 26, { floors: 1, w: 2, color: 2 });
    b.house(18, 26, { floors: 2, w: 2, color: 4 });
    b.house(25, 26, { floors: 3, color: 1 });
    b.house(27, 26, { floors: 2, w: 2, color: 6 });
    b.house(32, 26, { floors: 1, w: 3, color: 3 });
    // ...and the north side, west of the square.
    b.house(7, 23, { floors: 2, color: 5 });
    b.house(9, 23, { floors: 1, w: 2, color: 7 });
    // A roof garden: reached only through the house under it.
    b.house(21, 26, { floors: 1, w: 2, d: 2, color: 2 });
    b.garden(21, 26, 22, 27);

    // A house on a marble terrace, reached by a flight of stairs.
    b.fill('marble', 10, 14, 13, 16);
    b.block('stairs', 11, 1, 17, { rot: N });
    b.block('house', 12, 2, 14, { color: 4 }).block('house', 13, 2, 14, { color: 4 });
    b.path(9, 19, 13, 19).path(11, 18, 11, 18);
    // A fenced garden with a gate where the path goes in.
    b.garden(5, 18, 7, 20);
    b.fenceAround(5, 18, 7, 20);
    b.path(7, 19, 8, 19);

    // The sky bridge: two tall houses joined at the third storey.
    // (Two cells deep, so their gables face north and south and the bridge meets a plain wall.)
    b.house(20, 11, { floors: 3, d: 2, color: 6 });
    b.house(24, 11, { floors: 3, d: 2, color: 0 });
    for (let x = 21; x <= 23; x++) b.block('arch', x, 2, 12);
    b.path(19, 13, 25, 13).path(19, 14, 19, 17);

    // Up the hill: carved steps where the path meets each terrace.
    b.path(20, 20, 33, 20);
    b.house(28, 18, { floors: 2, color: 3 });
    b.house(30, 18, { floors: 1, w: 2, color: 5 });
    b.path(33, 12, 33, 19);
    b.path(34, 12, 42, 12);
    b.house(35, 10, { floors: 2, w: 2, color: 1 });
    b.put('tree', 38, 14).put('tree', 29, 22).put('tree', 24, 22).put('tree', 6, 22);
    b.block('stairs', 25, 1, 16, { rot: E });
  },
  cameras: [
    { name: 'town', yaw: 45, pitch: 35, zoom: 1.9, target: [22, 1, 22] },
    { name: 'square', yaw: 45, pitch: 32, zoom: 4.6, target: [16, 1, 22] },
    { name: 'stairs', yaw: 20, pitch: 30, zoom: 5.2, target: [11.5, 1.5, 17] },
    { name: 'bridge', yaw: 15, pitch: 26, zoom: 4.6, target: [22, 2.5, 13] },
    { name: 'hill', yaw: 300, pitch: 32, zoom: 3.6, target: [31, 2, 18] },
    { name: 'pier', yaw: 60, pitch: 30, zoom: 4.4, target: [17, 1, 33] },
    { name: 'dusk', yaw: 45, pitch: 35, zoom: 2.4, target: [20, 1, 22], time: 'dusk' },
    { name: 'night', yaw: 45, pitch: 35, zoom: 2.4, target: [20, 1, 22], time: 'night' },
  ],
  expect(plan, dressing, check) {
    const nav = dressing.nav;
    const residents = dressing.actors.filter((a) => a.type === 'resident');
    check.ok(residents.length >= 20 && residents.length <= 60, `the town has residents (${residents.length})`);
    check.ok(nav.links.some((l) => l.via === 'steps'), 'the hill path has carved steps');
    check.ok(nav.links.some((l) => l.via === 'stairs'), 'the terrace has a flight');
    check.ok(nav.links.some((l) => l.via === 'gate'), 'the garden has a gate');
    check.ok(nav.links.filter((l) => l.via === 'interior').length >= 3, 'the bridge and the roof garden are reached through houses');
    check.ok(nav.doors.some((d) => d.hatch), 'the roof garden has a hatch');
    for (const type of ['haunt-square', 'haunt-pier', 'haunt-garden', 'haunt-fountain', 'haunt-viewpoint', 'haunt-visit', 'haunt-shop'] as const) {
      check.hasSocket({ type });
    }
    check.ok(plan.world.blocks.size > 40, 'the town was built');
  },
});
