// The Auto block's worked examples (design section 8), side by side, so the
// renderer and the gallery show what K1–K5 decide.

import { key } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'logic-auto-kinds',
  seed: 11,
  about: 'Auto blocks: tower, lighthouse by the sea, house with a steeple stack, an arch span, a jettied room, docks.',
  build(b) {
    b.auto(14, 14, { floors: 3 }); // three on open ground: a tower (K4)
    b.auto(6, 14, { floors: 4 }); // four near the sea: a lighthouse (K3)
    b.house(18, 14, { floors: 2, w: 2, d: 2, color: 2 }).auto(18, 14, { floors: 3 }); // a house with a tower rising from its roof
    b.house(24, 14, { floors: 3, color: 4 }).house(28, 14, { floors: 3, color: 4 });
    for (let x = 25; x <= 27; x++) b.block('auto', x, 3, 14); // bridging a gap: an arch (K2)
    b.house(32, 14, { floors: 2, color: 1 }).block('auto', 33, 2, 14); // hung off a wall: a house on brackets (K5)
    for (let z = 20; z <= 23; z++) b.block('auto', 2, 0, z); // on open water: docks (K1)
    b.auto(20, 24, { floors: 2 }); // two on open ground: a house (K5)
  },
  cameras: [
    { name: 'front', yaw: 30, pitch: 30, zoom: 2.2, target: [18, 2, 16] },
    { name: 'sea', yaw: 120, pitch: 32, zoom: 3, target: [5, 1, 18] },
  ],
  expect(plan, _dressing, check) {
    for (let y = 1; y <= 3; y++) check.kind(14, y, 14, 'tower');
    for (let y = 1; y <= 4; y++) check.kind(6, y, 14, 'lighthouse');
    check.kind(18, 2, 14, 'house');
    check.kind(18, 3, 14, 'tower');
    for (let x = 25; x <= 27; x++) check.kind(x, 3, 14, 'arch');
    check.sameStructure([25, 3, 14], [27, 3, 14]);
    check.kind(33, 2, 14, 'house');
    for (let z = 20; z <= 23; z++) check.kind(2, 0, z, 'dock');
    check.sameStructure([2, 0, 20], [2, 0, 23]);
    check.kind(20, 2, 24, 'house');
    check.ok(plan.supports.some((s) => s.type === 'bracket' && s.carries === key(33, 2, 14)), 'the jettied room is on brackets');
  },
});

