// The gallery's marble entry, and the fixture for the marble roles: a
// terrace (R-M07), a temple on its pillars (R-M01), a gatehouse either side
// of a gateway (R-M02), a keep (R-M03), a quay wall (R-M05) and a plinth on
// a plaza (R-M06).

import { scenario } from '@/scenario';

export default scenario({
  name: 'gen.marble',
  seed: 46,
  about: 'Every marble role: terrace, temple, gatehouse, keep, quay wall, plinth.',
  terrain(t) {
    t.flat(1);
    t.water(4, 19, 43, 43);
  },
  build(b) {
    // Terrace: a stepped mass with a house on it.
    b.fill('marble', 8, 11, 10, 12).block('marble', 8, 2, 11).block('marble', 9, 2, 11);
    // Temple: a 3 × 2 slab on six pillars two tall.
    for (const x of [13, 14, 15]) for (const z of [11, 12]) b.stack('pillar', x, z, { floors: 2 }).block('marble', x, 3, z);
    // Gatehouse: marble blocks either side of an arch over a path.
    b.path(19, 8, 19, 15).put('arch', 19, 12);
    b.stack('marble', 18, 12, { floors: 2 }).stack('marble', 20, 12, { floors: 2 });
    // Keep: 3 × 3, three storeys, with a taller corner.
    b.fill('marble', 23, 10, 25, 12, { floors: 3 }).block('marble', 23, 4, 10).block('marble', 23, 5, 10);
    // Quay wall along the shore, seven cells.
    for (let x = 9; x <= 15; x++) b.put('marble', x, 18);
    // Plinth: one block in the middle of a little square.
    b.plaza(28, 10, 30, 12).eraseFloor(29, 11).put('marble', 29, 11);
    b.put('marble', 28, 15); // a block on bare grass stays a terrace
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 30, zoom: 2.9, target: [19, 2, 13] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 2.9, target: [19, 2, 13] },
    { name: 'temple', yaw: 30, pitch: 24, zoom: 6, target: [14.5, 2.4, 11.5] },
    { name: 'keep', yaw: 50, pitch: 26, zoom: 5, target: [23.5, 3, 11.5] },
    { name: 'gate', yaw: 15, pitch: 22, zoom: 6.5, target: [19.5, 1.8, 12.5] },
    { name: 'quay', yaw: 20, pitch: 28, zoom: 5, target: [12.5, 1, 18.5] },
    { name: 'side', yaw: 130, pitch: 32, zoom: 2.9, target: [19, 2, 13] },
  ],
  expect(plan, _dressing, check) {
    check.role(8, 1, 11, 'terrace');
    check.hasTag(8, 1, 11, 'top:paved');
    check.role(14, 3, 11, 'temple');
    check.equal(check.features({ type: 'pediment', on: [14, 3, 11] }).length, 2, 'a pediment at each short end');
    check.hasFeature({ type: 'pediment', at: [13, 3, 11], dir: 3 }); // the west end, from its north cell
    check.hasFeature({ type: 'pediment', at: [15, 3, 12], dir: 1 });
    check.equal(check.features({ type: 'stylobate', on: [14, 3, 11] }).length, 6, 'steps under all six cells');
    check.ok(!plan.tags.get(check.structure(14, 3, 11).id)?.has('top:paved'), 'a temple top is under its roof');
    check.role(18, 1, 12, 'gatehouse');
    check.role(20, 1, 12, 'gatehouse');
    check.role(19, 1, 12, 'gateway');
    check.equal(check.features({ type: 'portcullis', at: [19, 1, 12] }).length, 1, 'one portcullis');
    check.role(24, 1, 11, 'keep');
    check.hasFeature({ type: 'battlement', at: [25, 3, 12] }, 2); // an outer corner: two edges
    check.noFeature({ type: 'battlement', at: [24, 3, 11] }); // the middle of the roof
    check.hasFeature({ type: 'battlement', at: [23, 5, 10] }, 4); // the corner turret: all four
    check.hasFeature({ type: 'arrow-slit', on: [24, 1, 11] });
    check.noFeature({ type: 'arrow-slit', at: [25, 1, 12] }); // none on the ground storey
    check.role(12, 1, 18, 'quay-wall');
    check.hasFeature({ type: 'bollard', on: [12, 1, 18] }, 2);
    check.hasSocket({ type: 'mooring', at: [10, 1, 18] });
    check.hasFeature({ type: 'quay-stair', at: [14, 1, 18], dir: 2 });
    check.role(29, 1, 11, 'plinth');
    check.hasSocket({ type: 'statue-base', at: [29, 1, 11] });
    check.role(28, 1, 15, 'terrace');
  },
});
