// Fixture for J02 (merge) on stepped ground: a house built across a
// one-level step in the ground is one building (design section 6, the
// House row of the merge table). West to east, each on its own patch of
// hillside, all facing the path along z = 12:
//
//   a 3 × 2 house across one step (two columns low, one high);
//   a 5 × 2 house across two separate steps (2 low, 2 middle, 1 high);
//   a 4 × 2 house up a staircase of three one-level steps;
//   two houses either side of a two-level step: two buildings;
//   a house beside another building's roof: the block on that roof is not
//   on a step, so it stays with the building it stands on, not this one.
import { scenario } from '@/scenario';

export default scenario({
  name: 'J02.split-level',
  seed: 5303,
  terrain(t) {
    t.rect(4, 4, 44, 20, 1);
    // A: one step, east of x = 9.
    t.rect(10, 4, 12, 20, 2);
    // B: two steps, at x = 18 and x = 20.
    t.rect(18, 4, 19, 20, 2);
    t.rect(20, 4, 22, 20, 3);
    // C: a staircase of three steps, x = 27, 28, 29.
    t.rect(27, 4, 27, 20, 2);
    t.rect(28, 4, 28, 20, 3);
    t.rect(29, 4, 31, 20, 4);
    // D: a two-level step at x = 36.
    t.rect(36, 4, 38, 20, 3);
  },
  build(b) {
    b.path(6, 12, 43, 12);
    const footprint = (x0: number, w: number, color: number): void => {
      for (let x = x0; x < x0 + w; x++) for (let z = 10; z <= 11; z++) b.put('house', x, z, { color });
    };
    footprint(8, 3, 2); // A
    footprint(16, 5, 0); // B
    footprint(26, 4, 6); // C
    footprint(34, 3, 4); // D: x = 34, 35 low, x = 36 two levels up
    // E: a house of another colour at (41, 10), and on its roof a block of the same colour as the house at (40, 10).
    b.put('house', 40, 10, { color: 3 }).put('house', 41, 10, { color: 5 }).block('house', 41, 2, 10, { color: 3 });
  },
  cameras: [
    { name: 'ne', yaw: 45, pitch: 32, zoom: 3.2, target: [24, 2, 10.5] },
    { name: 'se', yaw: 135, pitch: 32, zoom: 3.2, target: [24, 2, 10.5] },
    { name: 'sw', yaw: 225, pitch: 32, zoom: 3.2, target: [24, 2, 10.5] },
    { name: 'nw', yaw: 315, pitch: 32, zoom: 3.2, target: [24, 2, 10.5] },
    { name: 'close-a', yaw: 30, pitch: 28, zoom: 9, target: [9.5, 1.8, 10.8] },
    { name: 'close-b', yaw: 30, pitch: 28, zoom: 7, target: [18.5, 2, 10.8] },
    { name: 'close-c', yaw: 30, pitch: 28, zoom: 7, target: [28, 2.6, 10.8] },
    { name: 'close-c-back', yaw: 210, pitch: 28, zoom: 7, target: [28, 2.6, 10.8] },
  ],
  expect(plan, _dressing, check) {
    // A: across one step, one building.
    check.sameStructure([8, 1, 10], [10, 2, 11]);
    // B: across two steps, one building of ten footprint cells (one storey: a home, not a manor, since FX-06).
    check.sameStructure([16, 1, 10], [20, 3, 11]);
    check.role(16, 1, 10, 'cottage');
    // C: up three steps, one building.
    check.sameStructure([26, 1, 10], [29, 4, 11]);
    // D: a two-level step parts them.
    check.ok(check.structure(35, 1, 10).id !== check.structure(36, 3, 10).id, 'a two-level step makes two buildings');
    // E: the block on the other building's roof stays with nobody but its own colour above.
    check.ok(check.structure(40, 1, 10).id !== check.structure(41, 2, 10).id, 'a block resting on another building does not join across');
    const houses = [...plan.structures.values()].filter((s) => s.kind === 'house');
    check.equal(houses.length, 3 + 2 + 3, 'houses');
    // One main door each for A, B and C.
    const fronts: [number, number, number][] = [[8, 1, 10], [16, 1, 10], [26, 1, 10]];
    for (const [x, y, z] of fronts) {
      const at = `(${x}, ${y}, ${z})`;
      const id = check.structure(x, y, z).id;
      check.equal(plan.features.filter((f) => f.structure === id && f.type === 'door' && (f.params as { main?: number } | undefined)?.main === 1).length, 1, `one main door on ${at}`);
    }
  },
});
