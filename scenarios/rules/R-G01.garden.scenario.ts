// R-G01 · Garden. Six gardens, one for each line of the rule, in the order
// the rule tries them: wheat by a windmill, herbs in a walled court, reeds
// by the water, a park lawn (nine cells or more), a kitchen garden beside a
// house, and a plain flower garden.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-G01.garden',
  seed: 8,
  about: 'The six garden variants where R-G01 gives each: wheat field, herb garden, reed bed, park lawn, kitchen garden, flower garden.',
  terrain(t) {
    t.flat(1);
    t.water(26, 22, 30, 26); // a pond
  },
  build(b) {
    b.stack('windmill', 13, 12, { floors: 2 });
    b.garden(14, 12, 16, 14); // wheat: within 2 of the windmill, nine cells (so a scarecrow too)
    b.garden(20, 12, 21, 13).fenceAround(20, 12, 21, 13, 'wall'); // herbs: enclosed
    b.garden(25, 21, 30, 21); // reeds: beside the pond
    b.garden(14, 18, 17, 21).put('tree', 15, 19); // a park: sixteen cells
    b.path(18, 19, 19, 19); // the hedge opens for it
    b.house(21, 18, { color: 3 });
    b.garden(22, 18, 23, 19); // kitchen: beside the house
    b.garden(26, 12, 27, 13); // flowers
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 38, zoom: 3.1, target: [21.5, 1, 17] },
    { name: 'back', yaw: 225, pitch: 38, zoom: 3.1, target: [21.5, 1, 17] },
    { name: 'close', yaw: 135, pitch: 32, zoom: 5, target: [20, 1, 16] },
  ],
  expect(plan, _dressing, check) {
    const role = (x: number, z: number): string | undefined => plan.roles.get(check.floorStructure(x, 1, z).id)?.role;
    check.equal(role(15, 13), 'wheat-field', 'by the windmill');
    check.equal(role(20, 12), 'herb-garden', 'in the walled court');
    check.equal(role(27, 21), 'reed-bed', 'beside the pond');
    check.equal(role(15, 20), 'park-lawn', 'sixteen cells');
    check.equal(role(22, 18), 'kitchen-garden', 'beside the house');
    check.equal(role(26, 12), 'flower-garden', 'on its own');
    check.equal(check.applied('R-G01.garden'), 6, 'every garden region gets a role');
    check.hasFeature({ type: 'garden-piece', variant: 'scarecrow', rule: 'R-G01.garden' });
    check.hasFeature({ type: 'garden-piece', variant: 'sundial' });
    // Round beds only on the park's inner cells, and never where the tree stands.
    for (const f of check.features({ type: 'garden-piece', variant: 'bed' })) check.ok(!plan.kinds.has(f.cell!), 'a round bed has its cell to itself');
  },
});
