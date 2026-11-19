// R-M04: marble in three or more rows, each one level higher than the last
// and two or more wide, is a grand stair. Each row that leads on is cut into
// broad steps; the top row of a bare flight stays a landing. Left: three
// rows up to a platform, with a cheek wall on one side (tall and broad
// enough to be a keep, which keeps its stair). Middle: a bare flight of four
// rows (mostly stair: the role is grand-steps). Right: two rows only, and a
// flight one cell wide: neither is a stair.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M04.grand-steps',
  seed: 85,
  about: 'Grand steps up to a platform with a cheek wall; a bare flight with a landing; two rows and a one-wide flight (terraces).',
  build(b) {
    // Three rows of three, rising north to a platform three deep; a cheek wall along the west.
    for (let row = 0; row < 3; row++) for (let x = 10; x <= 12; x++) b.stack('marble', x, 16 - row, { floors: row + 1 });
    b.fill('marble', 10, 11, 12, 13, { floors: 3 });
    for (let z = 14; z <= 16; z++) b.stack('marble', 9, z, { floors: 4 });
    // A bare flight of four rows, two wide, rising east.
    for (let row = 0; row < 4; row++) for (const z of [13, 14]) b.stack('marble', 16 + row, z, { floors: row + 1 });
    // Not stairs: two rows; a flight one cell wide.
    for (let row = 0; row < 2; row++) for (const z of [13, 14]) b.stack('marble', 23 + row, z, { floors: row + 1 });
    for (let row = 0; row < 3; row++) b.stack('marble', 28 + row, 13, { floors: row + 1 });
  },
  cameras: [
    { name: 'front', yaw: 30, pitch: 30, zoom: 2.9, target: [19, 2, 13.5] },
    { name: 'back', yaw: 210, pitch: 32, zoom: 2.9, target: [19, 2, 13.5] },
    { name: 'steps', yaw: 20, pitch: 26, zoom: 5.5, target: [11, 2, 14.5] },
    { name: 'steps-side', yaw: 110, pitch: 28, zoom: 5.5, target: [11, 2, 14.5] },
    { name: 'flight', yaw: 300, pitch: 28, zoom: 5, target: [17.5, 2, 13.5] },
  ],
  expect(_plan, _dressing, check) {
    check.role(11, 1, 16, 'keep'); // three high with a broad platform: a keep, with its stair cut all the same
    check.noFeature({ type: 'battlement', at: [11, 2, 15] }); // no battlements across the treads
    check.hasFeature({ type: 'battlement', at: [10, 3, 11] });
    // The three rows are each cut on their top cell, stepping down to the south.
    for (let row = 0; row < 3; row++) for (let x = 10; x <= 12; x++) check.hasFeature({ type: 'broad-steps', at: [x, row + 1, 16 - row], dir: 2 });
    check.noFeature({ type: 'broad-steps', at: [11, 3, 12] }); // the platform
    check.noFeature({ type: 'broad-steps', at: [9, 4, 15] }); // the cheek wall
    check.hasSocket({ type: 'seat', at: [11, 2, 15] });
    // The bare flight: rows one to three are cut, the fourth is its landing.
    check.role(17, 1, 13, 'grand-steps');
    for (let row = 0; row < 3; row++) check.hasFeature({ type: 'broad-steps', at: [16 + row, row + 1, 13], dir: 3 });
    check.noFeature({ type: 'broad-steps', at: [19, 4, 13] });
    check.role(23, 1, 13, 'terrace');
    check.role(28, 1, 13, 'terrace');
  },
});
