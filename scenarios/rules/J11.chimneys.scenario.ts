// Fixture for J11 (chimneys): one per 3 pitched roof cells with a minimum
// per role, on the ridge, preferring a party wall; beside a wall one storey
// taller it becomes a tall flue. West to east: a six-cell house (two); a
// nine-cell house (three); a row of three (each on its party wall); a low
// house against a taller neighbour (a tall flue); a house with a terrace
// (none on the flat part).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J11.chimneys',
  seed: 5311,
  rules: houseDressing,
  build(b) {
    b.house(8, 10, { w: 3, d: 2, color: 0 });
    b.house(12, 9, { w: 3, d: 3, color: 2 });
    b.house(17, 10, { floors: 2, color: 4 });
    b.house(18, 10, { floors: 2, color: 6 });
    b.house(19, 10, { floors: 2, color: 1 });
    b.plaza(22, 11, 23, 12);
    b.house(22, 10, { color: 3 }); // a shop on a little square (a shop always has a chimney)
    b.house(23, 10, { floors: 2, color: 5 });
    b.house(26, 9, { w: 2, d: 2, color: 7 });
    b.put('stairs', 26, 11, { rot: 0 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 5.5, target: [18, 1.8, 10.5] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 5.5, target: [18, 1.8, 10.5] },
    { name: 'close', yaw: 50, pitch: 30, zoom: 12, target: [22.5, 2.2, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.features({ type: 'chimney', on: [8, 1, 10] }).length, 2, 'chimneys on six roof cells');
    check.equal(check.features({ type: 'chimney', on: [12, 1, 9] }).length, 3, 'chimneys on nine roof cells');
    check.equal(check.features({ type: 'chimney', on: [18, 1, 10] }).length, 1, 'chimneys on the middle row house');
    // Beside a wall one storey taller: a tall flue that clears it.
    const flue = check.hasFeature({ type: 'chimney', variant: 'tall-flue', on: [22, 1, 10] })[0]!;
    check.ok(((flue.params as { height?: number }).height ?? 0) > 0.8, 'the flue rises past the neighbour\'s eave');
    // None on a terrace.
    check.noFeature({ type: 'chimney', on: [26, 1, 9] });
    // Every chimney owns its top socket (where the smoke will come from).
    check.equal(check.sockets({ type: 'chimney-top' }).length, check.features({ type: 'chimney' }).length, 'chimney-top sockets');
    // Two chimneys of one house are never on neighbouring cells.
    const six = check.features({ type: 'chimney', on: [8, 1, 10] });
    const dx = Math.abs((six[0]!.cell! & 63) - (six[1]!.cell! & 63)), dz = Math.abs(((six[0]!.cell! >> 6) & 63) - ((six[1]!.cell! >> 6) & 63));
    check.ok(dx + dz >= 2, 'the two chimneys stand apart');
  },
});
