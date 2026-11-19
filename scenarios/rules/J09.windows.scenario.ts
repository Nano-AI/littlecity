// Fixture for J09 (windows): one window per facade cell without a door,
// from the structure's family, with the exceptions. West to east: a lone
// two-storey house (a window on every free side of every storey but the
// door's); a house with a tree against its east wall (none there); two
// three-storey houses across an alley (about half the alley cells); a tall
// part over a lean-to wing (no window just above the wing's roof); a row of
// eight one-cell houses to show the families side by side.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J09.windows',
  seed: 5309,
  rules: houseDressing,
  build(b) {
    b.house(8, 10, { floors: 2, color: 0 });
    b.house(11, 10, { color: 2 });
    b.put('tree', 12, 10);
    b.house(15, 9, { d: 3, floors: 3, color: 4 });
    b.house(17, 9, { d: 3, floors: 3, color: 6 });
    b.house(20, 9, { w: 2, d: 2, floors: 2, color: 3 });
    b.house(22, 9, { d: 2, color: 3 });
    for (let i = 0; i < 8; i++) b.house(9 + i * 2, 15, { floors: 2, color: i });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 5, target: [16, 2, 12] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 5, target: [16, 2, 12] },
    { name: 'families', yaw: 45, pitch: 28, zoom: 8, target: [16, 1.8, 15.5] },
    { name: 'close', yaw: 40, pitch: 24, zoom: 14, target: [11.6, 1.6, 15.6] },
  ],
  expect(plan, _dressing, check) {
    // The lone house: 8 facade cells, one holds the door.
    check.equal(check.features({ type: 'door', on: [8, 1, 10] }).length, 1, 'doors');
    const lone = check.features({ type: 'window', on: [8, 1, 10] }).filter((f) => f.variant !== 'round');
    check.equal(lone.length, 7, 'windows on the lone two-storey house');
    check.equal(new Set(lone.map((f) => f.variant)).size, 1, 'all from one family');
    // Every window owns its socket.
    check.equal(check.sockets({ type: 'window' }).length, check.features({ type: 'window' }).length, 'window sockets');
    // No window behind the tree.
    check.noFeature({ type: 'window', at: [11, 1, 10], dir: 1 });
    // The alley: 9 facade cells a side; about half have windows, not all and not none.
    const alley = check.features({ type: 'window', on: [15, 1, 9], dir: 1 }).length + check.features({ type: 'window', on: [17, 1, 9], dir: 3 }).length;
    check.ok(alley >= 4 && alley <= 14, `${alley} of 18 alley cells have a window`);
    // Nothing just above the wing's roof: the tall part's east wall at storey 2.
    check.noFeature({ type: 'window', at: [21, 2, 9], dir: 1 });
    check.noFeature({ type: 'window', at: [21, 2, 10], dir: 1 });
    // The row shows more than one family.
    const families = new Set<string>();
    for (let i = 0; i < 8; i++) families.add(check.hasFeature({ type: 'window', on: [9 + i * 2, 1, 15] })[0]!.variant ?? '');
    check.ok(families.size >= 3, `the row shows ${families.size} window families`);
    check.ok(plan.features.every((f) => f.type !== 'window' || f.cell !== undefined), 'windows are placed by cell and side');
  },
});
