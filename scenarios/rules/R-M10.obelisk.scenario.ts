// R-M10 (RC-08, FX-09): a free 1 × 1 marble column 3 or more tall on a
// square is an obelisk with a gilt tip, or (4+ tall, by seed) a victory
// column with a gilt statue; never four stacked boxes. The same stack
// against a wall is no obelisk; a 2-tall one on a plaza is a terrace.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M10.obelisk',
  seed: 4210,
  about: 'Obelisks and columns of 3 to 6 on a square; one against a house (no); one 2 tall (no).',
  build(b) {
    b.plaza(8, 8, 24, 14);
    b.stack('marble', 10, 11, { floors: 3 });
    b.stack('marble', 14, 11, { floors: 4 });
    b.stack('marble', 18, 11, { floors: 5, color: 2 });
    b.stack('marble', 22, 11, { floors: 6, color: 1 });
    b.house(26, 10, { floors: 2, color: 3 });
    b.stack('marble', 25, 10, { floors: 3 });
    b.stack('marble', 12, 13, { floors: 2 });
  },
  cameras: [
    { name: 'square', yaw: 30, pitch: 26, zoom: 3.2, target: [16, 2, 11] },
    { name: 'dusk', yaw: 210, pitch: 26, zoom: 3.2, target: [16, 2, 11], time: 'dusk' },
  ],
  expect(plan, _dressing, check) {
    for (const x of [10, 14, 18, 22]) check.role(x, 1, 11, 'obelisk');
    const columns = [14, 18, 22].filter((x) => plan.tags.get(check.structure(x, 1, 11).id)?.has('obelisk:column'));
    check.ok(columns.length >= 1 && columns.length <= 2, `some are victory columns, some obelisks: ${columns.join(', ')}`);
    check.ok(plan.roles.get(check.structure(25, 1, 10).id)?.role !== 'obelisk', 'a stack against a house is no obelisk');
    check.ok(plan.roles.get(check.structure(12, 1, 13).id)?.role !== 'obelisk', 'two tall is no obelisk');
  },
});
