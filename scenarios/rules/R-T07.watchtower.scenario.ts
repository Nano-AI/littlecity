// R-T07 and J13: the default tower. One body per stack, base trim at the
// bottom only, a band course every two storeys, small windows spiralling a
// quarter turn per storey, a cone roof with a flag socket, a door toward the
// path. A tower with a block on it has no cap.

import { key } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'R-T07.watchtower',
  seed: 41,
  about: 'Watchtowers of 1 to 5 storeys, one rising out of the sea, one carrying a marble block.',
  terrain(t) {
    t.flat(1);
    t.water(4, 16, 43, 43);
  },
  build(b) {
    b.path(8, 13, 24, 13);
    b.tower(9, 12, { floors: 1, color: 0 });
    b.tower(11, 12, { floors: 2, color: 1 });
    b.tower(13, 12, { floors: 3, color: 3 });
    b.tower(16, 12, { floors: 4, color: 6 });
    b.tower(19, 12, { floors: 5, color: 4 });
    b.tower(22, 12, { floors: 3, color: 2 }).block('marble', 22, 4, 12);
    for (let y = 0; y < 4; y++) b.block('tower', 14, y, 18, { color: 5 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 3.4, target: [15.5, 3, 13] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 3.4, target: [15.5, 3, 13] },
    { name: 'close', yaw: 60, pitch: 28, zoom: 6.5, target: [13, 2.2, 12] },
    { name: 'far', yaw: 135, pitch: 38, zoom: 2.2, target: [15.5, 2, 14] },
  ],
  expect(plan, _dressing, check) {
    check.role(13, 1, 12, 'watchtower');
    check.sameStructure([19, 1, 12], [19, 5, 12]);
    check.hasTag(13, 1, 12, 'body:round');
    check.hasFeature({ type: 'cap', variant: 'cone', at: [13, 3, 12] });
    check.hasSocket({ type: 'flag-mount', at: [13, 3, 12] });
    check.noFeature({ type: 'cap', on: [22, 1, 12] });
    // One window per storey, each a quarter turn from the last (the door's side is skipped on the ground storey).
    const windows = check.features({ type: 'window', on: [19, 1, 12] });
    check.equal(windows.length, 5, 'a window per storey');
    for (let i = 2; i < windows.length; i++) check.equal(windows[i]!.dir, ((windows[i - 1]!.dir ?? 0) + 1) & 3, `storey ${i + 1} turns a quarter`);
    // The door faces the path.
    check.hasFeature({ type: 'door', at: [13, 1, 12], dir: 2 });
    check.hasTag(14, 0, 18, 'footing:water');
    check.noFeature({ type: 'door', on: [14, 0, 18] });
    check.ok(plan.structureAt.has(key(14, 3, 18)), 'the sea tower exists');
  },
});
