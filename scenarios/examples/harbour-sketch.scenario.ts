// Hand-made terrain: a bay, a hill with a cliff, and a town sketched with
// the builder's helpers. Shows TerrainBuilder, fill, plaza, garden, fences
// and a per-camera time of day.

import { scenario } from '@/scenario';

export default scenario({
  name: 'harbour-sketch',
  seed: 21,
  about: 'A small harbour town on hand-made terrain, by day and at dusk.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43); // the sea to the south
    t.rect(4, 4, 20, 12, 2); // a terrace
    t.rect(4, 4, 12, 8, 4); // a hill with a 2-level cliff
    t.disc(30, 31, 3.2, 0); // a cove
  },
  build(b) {
    // A row of houses along the waterfront street.
    b.path(8, 27, 36, 27);
    for (let i = 0; i < 6; i++) b.house(10 + i * 3, 25, { floors: 1 + (i % 3), w: 2, color: i });
    // The square, with a fountain and a stall.
    b.plaza(22, 18, 27, 23);
    b.put('fountain', 24, 20);
    b.put('stall', 26, 22);
    b.path(24, 24, 24, 26);
    // Marble steps up to a tower on the hill.
    b.fill('marble', 14, 13, 16, 14, { floors: 1 });
    b.tower(8, 6, { floors: 5 });
    // A garden with a fence round it.
    b.garden(30, 18, 33, 20);
    b.fenceAround(30, 18, 33, 20);
    // Auto blocks: a pier into the bay and a stack near the shore.
    for (let z = 30; z <= 33; z++) b.block('auto', 18, 0, z);
    b.auto(38, 26, { floors: 4 });
    b.put('tree', 36, 20).put('tree', 37, 21).put('tree', 35, 22);
  },
  cameras: [
    { name: 'day', yaw: 45, pitch: 34, zoom: 1.5, target: [23, 1, 22] },
    { name: 'dusk', yaw: 135, pitch: 30, zoom: 2.2, target: [22, 1, 26], time: 'dusk' },
  ],
  expect(plan, _dressing, check) {
    check.ok(plan.world.blocks.size > 40, 'the town was built');
    check.equal(plan.world.edges.size, 14, 'fence edge pieces round a 4 × 3 garden');
    check.kind(8, 4, 6, 'tower');
    check.floorStructure(24, 1, 20); // the plaza under the fountain is still there
  },
});
