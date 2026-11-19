// L21 · Population. ceil(cells ÷ 2) residents a house, in the order the
// houses were first placed; each with a seeded look and a home. A house whose
// door opens onto nothing walkable keeps its people indoors.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L21.population',
  seed: 41,
  about: 'Houses of 1, 2, 4 and 6 cells along a street: 1, 1, 2 and 3 residents. A house on a pinnacle keeps its one resident indoors.',
  terrain(t) {
    t.flat(1);
    t.rect(30, 14, 30, 14, 3); // a pinnacle
  },
  build(b) {
    b.path(8, 16, 26, 16);
    b.house(9, 14, { color: 1 }); // 1 cell
    b.house(12, 14, { floors: 2, color: 2 }); // 2 cells
    b.house(15, 14, { floors: 2, w: 2, color: 3 }); // 4 cells
    b.house(19, 14, { floors: 3, w: 2, color: 4 }); // 6 cells
    b.block('house', 30, 3, 14, { color: 5 }); // its door opens onto thin air
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 32, zoom: 3.6, target: [17, 1, 15] },
    { name: 'close', yaw: 20, pitch: 26, zoom: 6.5, target: [16, 1, 16] },
  ],
  expect(plan, dressing, check) {
    const residents = dressing.actors.filter((a) => a.type === 'resident');
    const count = (x: number, y: number, z: number): number => residents.filter((a) => a.home === check.structure(x, y, z).id).length;
    check.equal(count(9, 1, 14), 1, 'one cell');
    check.equal(count(12, 1, 14), 1, 'two cells');
    check.equal(count(15, 1, 14), 2, 'four cells');
    check.equal(count(19, 1, 14), 3, 'six cells');
    check.equal(residents.length, 8, 'residents in all');
    // In seq order, each at its home's front door socket, each with its own look.
    const homes = residents.map((a) => a.home!);
    check.ok(homes.every((h, i) => i === 0 || h >= homes[i - 1]!), 'filled in seq order');
    check.ok(residents.filter((a) => a.variant !== 'indoors').every((a) => a.at !== null && 'socket' in a.at), 'walkers stand at a door socket');
    check.equal(new Set(residents.map((a) => (a.params as { look: number }).look)).size, 8, 'distinct looks');
    // The pinnacle house: somebody lives there, and stays in.
    const shutIn = residents.filter((a) => a.home === check.structure(30, 3, 14).id);
    check.equal(shutIn.length, 1, 'the pinnacle house has its resident');
    check.equal(shutIn[0]!.variant, 'indoors', 'who cannot come out');
    check.equal(plan.world.blocks.size, 14, 'blocks built');
  },
});
