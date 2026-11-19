// Fixture for J24 (foundation): a house whose ground cells sit over lower
// ground on some side gets a stone plinth down to it; against a cliff it has
// no base trim on that side. A hillside of three terraces: houses on the
// edge of each (plinths one and two storeys deep), a house at the foot of a
// rise (cliff sides), and one out on a headland over the sea.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J24.foundation',
  seed: 5324,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 6, 40, 22, 1);
    t.rect(4, 6, 40, 14, 2);
    t.rect(4, 6, 40, 10, 3);
    t.rect(22, 16, 23, 16, 3); // a bluff two levels above the low ground, just big enough for a house
    t.rect(30, 22, 31, 24, 1); // a headland
  },
  build(b) {
    b.house(10, 14, { w: 2, color: 0 }); // on the edge of the middle terrace, lower ground to the south
    b.house(15, 10, { color: 2 }); // on the edge of the top terrace
    b.house(18, 15, { color: 4 }); // at the foot of the rise: the terrace is a cliff on its north side
    b.house(22, 16, { w: 2, color: 6 }); // on the bluff: two levels down all round
    b.house(30, 24, { w: 2, color: 3 }); // on the headland: the sea on three sides
    b.house(34, 18, { color: 5 }); // on flat ground: nothing
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 4.6, target: [21, 2, 16] },
    { name: 'se', yaw: 135, pitch: 32, zoom: 4.6, target: [21, 2, 16] },
    { name: 'close', yaw: 45, pitch: 28, zoom: 9, target: [22.5, 2.5, 16.8] },
  ],
  expect(_plan, _dressing, check) {
    const depth = (f: { params?: object }): number => (f.params as { depth?: number }).depth ?? 0;
    // One storey down on the south side of both cells.
    const mid = check.hasFeature({ type: 'foundation', variant: 'plinth', on: [10, 2, 14], dir: 2 }, 2);
    for (const f of mid) check.equal(depth(f), 1, 'plinth depth on the middle terrace');
    check.noFeature({ type: 'foundation', variant: 'plinth', on: [10, 2, 14], dir: 0 });
    check.hasFeature({ type: 'foundation', variant: 'plinth', on: [15, 3, 10], dir: 2 });
    // Against the rise: a cliff side, no plinth.
    check.hasFeature({ type: 'foundation', variant: 'cliff', on: [18, 1, 15], dir: 0 });
    check.noFeature({ type: 'foundation', variant: 'plinth', on: [18, 1, 15] });
    // On the bluff: two storeys down.
    const bluff = check.hasFeature({ type: 'foundation', variant: 'plinth', on: [22, 3, 16] }, 6);
    check.ok(bluff.every((f) => depth(f) === 2), 'the bluff house has a two-storey plinth on every side');
    // Over the sea: down to the water.
    check.hasFeature({ type: 'foundation', variant: 'plinth', on: [30, 1, 24] }, 3);
    check.noFeature({ type: 'foundation', on: [34, 1, 18] });
  },
});
