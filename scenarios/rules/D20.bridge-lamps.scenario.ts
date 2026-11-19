// Fixture for D20 (bridge lamps).
//   a stone bridge over an inlet     a short lamp on an end post at each end, on opposite corners
//   a sky bridge between two houses  a lantern hanging under its crown
//   a span between marble blocks     a viaduct, not a sky bridge: no lantern
//   a pier                           the harbour lamp at its end

import { scenario } from '@/scenario';

export default scenario({
  name: 'D20.bridge-lamps',
  seed: 2020,
  about: 'A lamp on the end posts of a stone bridge, a lantern under a sky bridge, the harbour lamp at a pier’s end.',
  terrain(t) {
    t.flat(1);
    t.water(18, 4, 20, 43);
    t.water(4, 34, 43, 43);
  },
  build(b) {
    b.path(12, 16, 17, 16).path(21, 16, 26, 16);
    for (let x = 18; x <= 20; x++) b.block('arch', x, 0, 16);
    b.path(18, 16, 20, 16);
    b.house(9, 24, { floors: 4, color: 2 }).house(12, 24, { floors: 4, color: 6 }).block('arch', 10, 3, 24).block('arch', 11, 3, 24);
    b.stack('marble', 26, 24, { floors: 4 }).stack('marble', 29, 24, { floors: 4 }).block('arch', 27, 3, 24).block('arch', 28, 3, 24);
    for (let z = 34; z <= 37; z++) b.block('dock', 30, 0, z);
    b.path(26, 33, 34, 33);
  },
  cameras: [
    { name: 'bridge', yaw: 45, pitch: 30, zoom: 6, target: [19, 1.2, 16.5] },
    { name: 'bridge-back', yaw: 225, pitch: 30, zoom: 6, target: [19, 1.2, 16.5] },
    { name: 'sky', yaw: 30, pitch: 22, zoom: 6, target: [10.5, 2.8, 24.5] },
    { name: 'pier', yaw: 45, pitch: 30, zoom: 7, target: [30, 1.2, 36] },
    { name: 'night', yaw: 45, pitch: 30, zoom: 6, target: [19, 1.2, 16.5], time: 'night' },
    { name: 'sky-night', yaw: 30, pitch: 22, zoom: 6, target: [10.5, 2.8, 24.5], time: 'night' },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D20.bridge-lamps');
    check.equal(mine.filter((p) => p.variant === 'bridge').length, 2, 'two bridge lamps');
    check.equal(check.sockets({ type: 'bridge-end' }).length, 2, 'one bridge-end socket at each end');
    check.equal(mine.filter((p) => p.type === 'hanging-lantern').length, 1, 'one lantern, under the sky bridge only');
    check.role(10, 3, 24, 'sky-bridge');
    const pier = mine.filter((p) => p.variant === 'pier').length;
    const pennant = dressing.props.filter((p) => p.type === 'flag' && p.variant === 'pennant').length;
    check.equal(pier + pennant, 1, 'the pier end has its lamp, unless D13 flew a pennant there');
    for (const p of mine) check.ok(dressing.sockets.some((s) => s.owner === p.id && s.type === 'lamp-head'), 'each owns its light');
  },
});
