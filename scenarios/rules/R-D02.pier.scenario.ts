// R-D02 Pier: a straight run of 3+ dock cells leading away from land. From
// the west:
//   five out from the beach       a pier: seat and lamp place at the end, a ladder
//   three out from the beach      the shortest pier
//   two out from the beach        too short: a jetty
//   four out, a house on the end  still a pier, but no pier head and no ladder
//   three, clear of the land      leads from nowhere: a jetty
//   five out to the east          a pier along x: the ladder hangs on its south side

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-D02.pier',
  seed: 102,
  about: 'Piers of several lengths, and the runs that are not piers.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
    t.water(34, 20, 43, 29); // a bay, so a pier can run east
  },
  build(b) {
    for (let z = 30; z <= 34; z++) b.block('dock', 10, 0, z);
    for (let z = 30; z <= 32; z++) b.block('dock', 14, 0, z);
    for (let z = 30; z <= 31; z++) b.block('dock', 18, 0, z);
    for (let z = 30; z <= 33; z++) b.block('dock', 22, 0, z);
    b.house(22, 33, { color: 1 });
    for (let z = 32; z <= 34; z++) b.block('dock', 26, 0, z);
    for (let x = 34; x <= 38; x++) b.block('dock', x, 0, 24);
    b.path(10, 28, 22, 28).path(10, 29).path(14, 29).path(22, 29);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 2.9, target: [22, 1, 30] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 2.9, target: [22, 1, 30] },
    { name: 'head', yaw: 70, pitch: 30, zoom: 8, target: [10.2, 1, 33.6] },
    { name: 'head-west', yaw: 290, pitch: 30, zoom: 8, target: [10.2, 1, 33.6] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 0, 32, 'pier');
    check.role(14, 0, 31, 'pier');
    check.role(18, 0, 30, 'jetty');
    check.role(22, 0, 31, 'pier');
    check.role(26, 0, 33, 'jetty');
    check.role(36, 0, 24, 'pier');
    // The head is on the seaward end, facing out; it owns the lamp's place and the fishing seat.
    check.hasFeature({ type: 'pier-head', at: [10, 0, 34], dir: 2 });
    check.hasSocket({ type: 'pier-end', at: [10, 0, 34] });
    check.hasSocket({ type: 'fishing-spot', at: [10, 0, 34] });
    check.hasFeature({ type: 'ladder', at: [10, 0, 34], dir: 1 });
    check.hasFeature({ type: 'pier-head', at: [38, 0, 24], dir: 1 });
    check.hasFeature({ type: 'ladder', at: [38, 0, 24], dir: 2 });
    // A house stands on the end of the fourth: nothing is fitted under it.
    check.noFeature({ type: 'pier-head', on: [22, 0, 30] });
    check.noFeature({ type: 'ladder', on: [22, 0, 30] });
    check.equal(check.features({ type: 'pier-head' }).length, 3, 'pier heads');
    // Mooring posts stand along a pier's sides, never on its head.
    check.hasFeature({ type: 'bollard', variant: 'post', on: [10, 0, 30] }, 2);
    check.noFeature({ type: 'bollard', at: [10, 0, 34] });
  },
});
