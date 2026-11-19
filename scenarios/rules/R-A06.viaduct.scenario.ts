// R-A06: the viaduct, the default arch role. A run of standing arches, two
// and three tiers with no cornice between them and one cornice and parapet
// along the top, and a high viaduct striding across a valley on tall piers.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-A06.viaduct',
  seed: 52,
  about: 'Viaducts: a ground arcade, a two-tier and a stepped three-tier viaduct, and a long one across a valley on piers.',
  terrain(t) {
    t.flat(1);
    t.rect(4, 24, 9, 30, 4); // two hills with a valley between
    t.rect(21, 24, 43, 30, 4);
  },
  build(b) {
    for (let x = 8; x <= 12; x++) b.put('arch', x, 10); // five standing arches
    for (let x = 16; x <= 19; x++) b.put('arch', x, 10).block('arch', x, 2, 10); // two tiers
    for (let x = 23; x <= 28; x++) b.put('arch', x, 10); // three tiers, stepping back
    for (let x = 24; x <= 28; x++) b.block('arch', x, 2, 10);
    for (let x = 25; x <= 27; x++) b.block('arch', x, 3, 10);
    for (let x = 10; x <= 20; x++) b.block('arch', x, 3, 27); // eleven cells across the valley, hill to hill
    b.path(8, 11, 12, 11);
  },
  cameras: [
    { name: 'front', yaw: 30, pitch: 28, zoom: 2.9, target: [18, 2, 11] },
    { name: 'back', yaw: 215, pitch: 34, zoom: 2.9, target: [18, 2, 11] },
    { name: 'valley', yaw: 20, pitch: 24, zoom: 3, target: [15, 2, 27] },
    { name: 'valley-side', yaw: 110, pitch: 30, zoom: 3, target: [15, 2, 27] },
    { name: 'far', yaw: 45, pitch: 36, zoom: 1.6, target: [18, 1, 19] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 1, 10, 'viaduct');
    check.sameStructure([16, 1, 10], [19, 2, 10]);
    check.sameStructure([23, 1, 10], [26, 3, 10]);
    // Standing arches each have their own opening, spanning along the run.
    const o = check.hasFeature({ type: 'arch-opening', at: [10, 1, 10] })[0]!;
    check.equal(o.dir, 2, 'a run along x has its passage along z');
    check.noFeature({ type: 'pier', on: [10, 1, 10] });
    // Across the valley: eleven cells anchored on both hills, split into four arches by three piers.
    check.role(15, 3, 27, 'viaduct');
    const piers = check.features({ type: 'pier', on: [15, 3, 27] });
    check.equal(piers.length, 3, 'three piers under eleven cells');
    for (const p of piers) check.equal((p.params as { depth: number }).depth, 2, 'each pier goes two cells down to the valley floor');
  },
});
