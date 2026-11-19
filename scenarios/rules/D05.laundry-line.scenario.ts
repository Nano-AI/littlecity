// Fixture for D05 (laundry lines). West to east:
//   an alley one cell wide between two three-storey rows   lines on the upper storeys
//   two two-storey houses three cells apart                a long line across the gap
//   two cottages a single cell apart                       a line at ground-floor head height
//   two houses four cells apart                            none: too far
//   two houses with a plaza between them                   none: never over a plaza
//   one house of two wings round a gap                     none: it is one structure

import { scenario } from '@/scenario';

export default scenario({
  name: 'D05.laundry-line',
  seed: 5105,
  about: 'Laundry between two different houses facing each other across 1 to 3 cells; never over a plaza, never across more than 3 cells, never within one house.',
  build(b) {
    // The alley.
    b.house(8, 10, { w: 6, floors: 3, color: 0 });
    b.house(8, 12, { w: 6, floors: 3, color: 2 });
    b.path(7, 11, 14, 11);
    // Three cells apart.
    b.house(18, 9, { floors: 2, color: 4 });
    b.house(18, 13, { floors: 2, color: 3 });
    // Two cottages.
    b.house(22, 10, { color: 6 });
    b.house(22, 12, { color: 1 });
    // Too far.
    b.house(26, 9, { floors: 2, color: 5 });
    b.house(26, 14, { floors: 2, color: 0 });
    // A plaza between.
    b.house(30, 10, { floors: 2, color: 2 });
    b.house(30, 12, { floors: 2, color: 4 });
    b.plaza(30, 11, 30, 11);
    // One house, two wings.
    b.house(37, 10, { floors: 2, color: 7 });
    b.house(38, 10, { d: 3, floors: 2, color: 7 });
    b.house(37, 12, { floors: 2, color: 7 });
  },
  cameras: [
    { name: 'alley', yaw: 100, pitch: 30, zoom: 5.5, target: [11, 2, 11] },
    { name: 'alley-east', yaw: 280, pitch: 34, zoom: 5.5, target: [11, 2, 11] },
    { name: 'pairs', yaw: 60, pitch: 32, zoom: 4.2, target: [21.5, 1.5, 11] },
    { name: 'pairs-back', yaw: 240, pitch: 32, zoom: 4.2, target: [21.5, 1.5, 11] },
    { name: 'close', yaw: 70, pitch: 24, zoom: 10, target: [20, 1.8, 11.2] },
    { name: 'dusk', yaw: 100, pitch: 30, zoom: 5.5, target: [11, 2, 11], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const lines = dressing.props.filter((p) => p.type === 'laundry-line');
    const cellOf = (id: string): [number, number, number] => {
      const cell = Number(id.split('@')[1]!.split(':')[0]);
      return [cell & 63, cell >> 12, (cell >> 6) & 63];
    };
    const at = lines.map((p) => cellOf(p.id));
    // The alley: lines on the upper storeys only, and never three in a row of three cells.
    const alley = at.filter(([x]) => x >= 8 && x <= 13);
    check.ok(alley.length >= 3, `the alley has laundry (${alley.length} lines)`);
    for (const [, y] of alley) check.ok(y >= 2, 'alley laundry hangs above the ground storey');
    for (let x = 8; x <= 11; x++) check.ok(alley.filter(([ax]) => ax >= x && ax <= x + 2).length <= 2, `at most 2 lines in the three cells from x = ${x}`);
    // The three-cell gap and the cottages.
    check.ok(at.some(([x, y]) => x === 18 && y === 2), 'a line across the three-cell gap, on the upper storey');
    check.ok(at.some(([x, y]) => x === 22 && y === 1), 'a line between the two cottages');
    // Where there must be none.
    check.ok(!at.some(([x]) => x === 26), 'none across four cells');
    check.ok(!at.some(([x]) => x === 30), 'none over a plaza');
    check.ok(!at.some(([x]) => x >= 34), 'none between two wings of one house');
    // Each line hangs between two anchors of its own, one on each wall.
    check.equal(dressing.sockets.filter((s) => s.type === 'line-anchor').length, lines.length * 2, 'line anchors');
    for (const p of lines) {
      const n = (p.params as { garments: number }).garments;
      check.ok(n >= 3 && n <= 6, '3 to 6 garments');
      check.ok(dressing.sockets.some((s) => s.owner === p.id && s.type === 'perch'), 'a line is a perch');
    }
  },
});
