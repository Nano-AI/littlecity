// Fixture for U05 (street trees) and U06 (town edge). A village street:
//   its east end runs out into open grass          it frays into a dirt trail of two or three cells,
//                                                  with a signpost; the lamp stands to one side
//   its west end stops at a fence                  no trail
//   a side street ends at a house's garden wall    no trail (no wild grass ahead)
//   the long straight has a verge on its north     a row of small trees, one every third cell, none
//   side and houses along its south                in front of a door
//   a short side street north                      too short for trees, but its end frays as well
//   houses whose backs face open country           about four in ten have a woodpile or a vegetable
//                                                  plot behind them; walls that face the street do not

import { scenario } from '@/scenario';

export default scenario({
  name: 'U06.town-edge',
  seed: 6606,
  about: 'A dead end facing wild grass frays into a dirt trail with a signpost; a long straight street with a verge gets a row of small trees; rear walls on the edge of town get woodpiles and vegetable plots.',
  build(b) {
    b.path(9, 20, 30, 20); // the street: both ends are dead ends
    b.fenceEdge(9, 20, 'W'); // the west end stops at a fence
    b.path(14, 21, 14, 24); // a side street south ...
    b.put('marble', 14, 25); // ... that ends at a block
    b.path(26, 17, 26, 19); // a short side street north
    for (let i = 0; i < 9; i++) if (i !== 2) b.house(11 + i * 2, 21, { floors: 1 + (i % 2), color: i % 8 });
    b.house(20, 14, { w: 2, color: 3 }); // a farmhouse out on its own
  },
  cameras: [
    { name: 'village', yaw: 45, pitch: 36, zoom: 2.7, target: [21, 1, 20] },
    { name: 'village-back', yaw: 225, pitch: 36, zoom: 2.7, target: [21, 1, 20] },
    { name: 'trail', yaw: 30, pitch: 30, zoom: 7, target: [31.5, 1.1, 20] },
    { name: 'trail-back', yaw: 210, pitch: 30, zoom: 7, target: [31.5, 1.1, 20] },
    { name: 'trees', yaw: 45, pitch: 30, zoom: 5.5, target: [18, 1.3, 19.5] },
    { name: 'backs', yaw: 200, pitch: 30, zoom: 5.5, target: [19, 1.3, 22.5] },
    { name: 'dusk', yaw: 30, pitch: 30, zoom: 7, target: [31.5, 1.1, 20], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const at = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    // U06: the east end frays.
    const trails = dressing.props.filter((p) => p.type === 'dirt-trail');
    const trail = trails.filter((p) => at(p)[1] === 20);
    check.ok(trail.length === 2 || trail.length === 3, `a trail of two or three cells (${trail.length})`);
    for (const p of trail) check.ok(at(p)[0] >= 31 && at(p)[0] <= 33, 'the trail runs on east from the street end');
    const north = trails.filter((p) => at(p)[0] === 26);
    check.ok(north.length >= 2 && north.every((p) => at(p)[1] <= 16), 'the side street frays north');
    check.equal(trails.length, trail.length + north.length, 'no other trails');
    check.equal(dressing.props.filter((p) => p.type === 'signpost').length, 2, 'a signpost at each frayed end');
    check.hasProp({ type: 'signpost', at: [30, 1, 20] });
    const lamp = dressing.props.find((p) => p.type === 'lamp' && at(p)[0] === 30 && at(p)[1] === 20);
    check.ok(lamp !== undefined && 'cell' in lamp.at && !lamp.at.pos.includes('e'), 'the end lamp stands clear of the trail');
    for (const p of trail) check.noProp({ type: 'tuft', at: [at(p)[0], 1, 20] });
    // No trail at the fenced end or at the blocked side street.
    check.ok(!trails.some((p) => at(p)[0] < 9), 'no trail beyond the fence');
    check.ok(!trails.some((p) => at(p)[0] === 14), 'no trail into the block');
    // U05: trees along the north verge, on the lattice, none on the south side.
    const trees = dressing.props.filter((p) => p.type === 'street-tree');
    check.ok(trees.length >= 4, `a row of street trees (${trees.length})`);
    for (const p of trees) {
      check.equal(at(p)[1], 19, 'on the north verge');
      check.equal(at(p)[0] % 3, 0, 'every third cell');
      check.ok(at(p)[0] !== 26, 'not on the side street');
    }
    // U06: some rear walls have something behind them, and only rear walls.
    const backs = dressing.props.filter((p) => p.rule === 'U06.town-edge' && (p.type === 'woodpile' || p.type === 'veg-patch'));
    check.ok(backs.length >= 2 && backs.length <= 9, `some rear walls are used (${backs.length})`);
    for (const p of backs) check.ok(at(p)[1] !== 20 && at(p)[1] !== 19, 'nothing on the street side');
  },
});
