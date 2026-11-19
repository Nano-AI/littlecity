// Fixture for D12 (weathervane):
//   a three-storey house among cottages and a two-storey house      a vane on its ridge end
//   two three-storey houses side by side among cottages             none: neither is the tallest
//   a lone two-storey house far from the rest                       none: nothing to stand out from
//   a three-storey house beside a four-storey one (8 steps apart)   the tall one only

import { scenario } from '@/scenario';

export default scenario({
  name: 'D12.weathervane',
  seed: 1212,
  about: 'A house taller than every house within six steps carries a weathervane (arrow, rooster or ship) on its ridge end; ties and lone houses do not.',
  build(b) {
    b.house(8, 8, { w: 2, floors: 3, color: 1 });
    b.house(11, 8, { color: 3 });
    b.house(8, 11, { floors: 2, color: 5 });
    b.house(12, 11, { color: 0 });
    // A tie.
    b.house(20, 8, { w: 2, floors: 3, color: 2 });
    b.house(23, 8, { w: 2, floors: 3, color: 4 });
    b.house(21, 11, { color: 6 });
    // Alone.
    b.house(36, 30, { w: 2, floors: 2, color: 7 });
    // A taller neighbour.
    b.house(8, 24, { w: 2, floors: 3, color: 3 });
    b.house(13, 24, { w: 2, floors: 4, color: 6 });
  },
  cameras: [
    { name: 'cluster', yaw: 30, pitch: 26, zoom: 5, target: [10, 1.8, 9.5] },
    { name: 'pair', yaw: 30, pitch: 26, zoom: 5, target: [11, 2, 24] },
    { name: 'all', yaw: 45, pitch: 40, zoom: 2.2, target: [20, 1, 18] },
  ],
  expect(plan, _dressing, check) {
    const vane = (x: number, z: number): boolean => plan.features.some((f) => f.type === 'finial' && f.variant === 'vane' && f.rule === 'D12.weathervane' && f.structure === check.structure(x, 1, z).id);
    check.ok(vane(8, 8), 'the tallest house of the cluster has a vane');
    check.ok(!vane(11, 8) && !vane(8, 11), 'its lower neighbours do not');
    check.ok(!vane(20, 8) && !vane(23, 8), 'two equal houses: neither');
    check.ok(!vane(36, 30), 'a lone house: none');
    check.ok(vane(13, 24) && !vane(8, 24), 'the taller of a pair only');
  },
});
