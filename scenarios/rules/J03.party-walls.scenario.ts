// Fixture for J03 (party walls): touching houses of different colours keep
// separate walls and roofs, and their ridge heights differ by a seeded
// offset so a row has rhythm. J03 has no rule file of its own: the walls are
// the generator's (each structure draws its own outline, inset from the cell
// line), and the offset is the `lift` J04 gives each roof. Here: a terrace
// of eight houses in a staggered line, heights mixed.
import { scenario } from '@/scenario';

export default scenario({
  name: 'J03.party-walls',
  seed: 5303,
  build(b) {
    const colors = [0, 2, 4, 6, 1, 3, 5, 7];
    const floors = [2, 2, 3, 2, 1, 2, 2, 3];
    for (let i = 0; i < 8; i++) b.house(10 + i, i === 3 || i === 4 ? 11 : 10, { floors: floors[i]!, color: colors[i]! });
    // Two houses of ONE colour side by side merge instead.
    b.house(22, 10, { floors: 2, color: 2 });
    b.house(23, 10, { floors: 2, color: 2 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 6, target: [15, 2, 10.5] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 6, target: [15, 2, 10.5] },
    { name: 'close', yaw: 50, pitch: 26, zoom: 11, target: [11.5, 2.2, 10.5] },
  ],
  expect(plan, _dressing, check) {
    for (let i = 0; i < 7; i++) check.differentStructures([10 + i, 1, i === 3 || i === 4 ? 11 : 10], [11 + i, 1, i + 1 === 3 || i + 1 === 4 ? 11 : 10]);
    check.sameStructure([22, 1, 10], [23, 1, 10]);
    // Each house has its own roof, and the ridge offsets are not all the same.
    const lifts = new Set<number>();
    for (let i = 0; i < 8; i++) {
      const roof = check.hasFeature({ type: 'roof', on: [10 + i, 1, i === 3 || i === 4 ? 11 : 10] })[0]!;
      lifts.add((roof.params as { lift?: number }).lift ?? 0);
    }
    check.ok(lifts.size >= 3, `the ridges sit at ${lifts.size} different offsets`);
    // No window looks into a neighbour's wall.
    check.noFeature({ type: 'window', at: [11, 1, 10], dir: 1 });
    check.noFeature({ type: 'window', at: [11, 1, 10], dir: 3 });
    check.ok(plan.structures.size === 9, 'eight houses in the row and one merged pair');
  },
});
