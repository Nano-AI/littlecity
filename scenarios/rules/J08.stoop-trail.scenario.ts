// Fixture for J08 (stoop and trail). A main door two or three cells from a
// floor (and not next to one) gets a worn dirt trail to it; a door above the
// ground outside gets steps. West to east: a house beside its street (no
// trail), one two cells back (one trail cell), one three cells back (two),
// one four cells back (too far: none), one with a tree in the way (none),
// and a house on a terrace whose only free side drops a storey (a stoop).
import { scenario } from '@/scenario';
import { STEPS_PER_LEVEL } from '@/rules/joinery/houses.lib';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J08.stoop-trail',
  seed: 5308,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 4, 43, 24, 1);
    t.rect(30, 9, 30, 9, 2); // a knoll one cell wide
  },
  build(b) {
    b.path(8, 14, 34, 14);
    b.house(10, 13, { color: 0 });
    b.house(14, 12, { color: 2 });
    b.house(18, 11, { color: 4 });
    b.house(22, 10, { color: 6 });
    b.house(26, 11, { color: 3 });
    b.put('tree', 26, 12);
    b.house(30, 9, { color: 5 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 5, target: [20, 1.5, 12] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 5, target: [20, 1.5, 12] },
    { name: 'close', yaw: 45, pitch: 40, zoom: 9, target: [18.5, 1.2, 12.5] },
  ],
  expect(_plan, _dressing, check) {
    check.noFeature({ type: 'trail', on: [10, 1, 13] });
    check.equal(check.features({ type: 'trail', on: [14, 1, 12] }).length, 1, 'trail cells from the house two cells back');
    check.hasFeature({ type: 'trail', at: [14, 1, 13] });
    check.equal(check.features({ type: 'trail', on: [18, 1, 11] }).length, 2, 'trail cells from the house three cells back');
    check.noFeature({ type: 'trail', on: [22, 1, 10] });
    check.noFeature({ type: 'trail', on: [26, 1, 11] });
    check.equal(check.applied('J08.stoop-trail'), 2, 'trails');
    // The house on the knoll: its door is a storey above the ground outside, so it has a stoop.
    const door = check.hasFeature({ type: 'door', on: [30, 2, 9] })[0]!;
    check.equal((door.params as { steps?: number }).steps, STEPS_PER_LEVEL, 'steps down from the knoll');
    // A door level with the ground has none.
    check.equal((check.hasFeature({ type: 'door', on: [10, 1, 13] })[0]!.params as { steps?: number }).steps, undefined, 'steps at a ground-level door');
  },
});
