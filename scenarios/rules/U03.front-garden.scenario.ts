// Fixture for U03 (front garden). A street with houses set back from it.
// West to east along the north side:
//   three houses in a row, each one cell back   three gardens side by side, one fence between each pair
//   a house right on the street                 no garden: there is no grass cell
//   a house two cells back                      no garden: two cells of grass (a trail instead)
// and on the south side:
//   a house one cell back with a tree beside its walk   a garden, fenced on the open flank only
//   a house whose owner already fenced the street edge   none: the placed fence does the job

import { scenario } from '@/scenario';

export default scenario({
  name: 'U03.front-garden',
  seed: 3303,
  about: 'One grass cell between a main door and a street becomes a front garden: picket fence and gate on the street, fences down the open flanks, a flower bed each side of the walk.',
  build(b) {
    b.path(7, 14, 30, 14);
    // Three in a row, one cell back.
    b.house(9, 12, { color: 0 });
    b.house(10, 12, { floors: 2, color: 2 });
    b.house(11, 12, { color: 4 });
    // On the street; two back.
    b.house(15, 13, { floors: 2, color: 3 });
    b.house(19, 11, { color: 6 });
    // South side.
    b.house(12, 16, { floors: 2, color: 1 });
    b.put('tree', 13, 15);
    b.house(18, 16, { color: 5 });
    b.fenceEdge(18, 15, 'N');
    b.house(24, 12, { w: 2, floors: 2, color: 7 });
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 32, zoom: 4, target: [15, 1, 14] },
    { name: 'street-back', yaw: 225, pitch: 32, zoom: 4, target: [15, 1, 14] },
    { name: 'row', yaw: 30, pitch: 28, zoom: 9, target: [10.5, 1.2, 13.3] },
    { name: 'row-west', yaw: 120, pitch: 30, zoom: 9, target: [10.5, 1.2, 13.3] },
    { name: 'south', yaw: 200, pitch: 30, zoom: 9, target: [12.5, 1.2, 15.2] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 6, target: [11, 1.2, 13.5], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'U03.front-garden');
    const at = (x: number, z: number): typeof mine => mine.filter((p) => 'cell' in p.at && (p.at.cell & 63) === x && ((p.at.cell >> 6) & 63) === z);
    // The row: a gate each, two beds each, and one fence between each pair plus the two outer ones.
    for (const x of [9, 10, 11]) {
      check.equal(at(x, 13).filter((p) => p.type === 'garden-fence' && p.variant === 'gate').length, 1, `gate of the garden at ${x}`);
      check.equal(at(x, 13).filter((p) => p.type === 'flower-bed').length, 2, `beds of the garden at ${x}`);
    }
    const flanks = [9, 10, 11].flatMap((x) => at(x, 13)).filter((p) => p.type === 'garden-fence' && p.variant === 'picket');
    check.equal(flanks.length, 4, 'four flank fences for three gardens in a row');
    // No garden where there is no grass cell, or two.
    check.equal(at(15, 14).length + at(19, 12).length + at(19, 13).length, 0, 'no garden on the street or two cells back');
    // South side: fenced only on the flank away from the tree.
    check.equal(at(12, 15).filter((p) => p.type === 'garden-fence' && p.variant === 'picket').length, 1, 'one flank fence beside the tree');
    check.equal(at(18, 15).length, 0, 'no derived garden behind a placed fence');
    // Wild grass leaves a garden alone, and nothing stands on the walk.
    for (const [x, z] of [[9, 13], [10, 13], [11, 13], [12, 15]] as const) {
      check.noProp({ type: 'tuft', at: [x, 1, z] });
      check.ok(!dressing.props.some((p) => 'cell' in p.at && p.at.cell === ((x) | (z << 6) | (1 << 12)) && p.at.pos === 'c'), `the walk at ${x}, ${z} is clear`);
    }
  },
});
