// Fixture for D04 (bunting).
//   six short streets between two-storey rows     about half are strung with bunting, wall to wall at the
//                                                 upper storey, on every second cell; laundry (D05) never
//                                                 shares a gap with it
//   a street between one-storey cottages          none: nothing to hang it from
//   a street with houses on one side only         none
//   a square with a market stall                  bunting from lamp to lamp along its sides
//   a square without one                          none

import { scenario } from '@/scenario';

export default scenario({
  name: 'D04.bunting',
  seed: 4042,
  about: 'Bunting across about half the streets that run between two-storey rows, and from lamp to lamp round a square with a stall.',
  build(b) {
    // Six little streets, each between two rows of two-storey houses.
    for (let i = 0; i < 6; i++) {
      const x = 7 + i * 6;
      b.path(x, 9, x + 3, 9);
      b.house(x, 8, { w: 2, floors: 2, color: i % 8 }).house(x + 2, 8, { w: 2, floors: 2, color: (i + 3) % 8 });
      b.house(x, 10, { w: 2, floors: 2, color: (i + 5) % 8 }).house(x + 2, 10, { w: 2, floors: 3, color: (i + 1) % 8 });
    }
    // Cottages; one side only.
    b.path(7, 15, 10, 15);
    b.house(7, 14, { w: 4, color: 2 }).house(7, 16, { w: 4, color: 4 });
    b.path(13, 15, 16, 15);
    b.house(13, 14, { w: 4, floors: 2, color: 6 });
    // Two squares.
    b.plaza(21, 14, 25, 18);
    b.put('stall', 22, 15);
    b.plaza(30, 14, 34, 18);
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 36, zoom: 2.2, target: [22, 1.5, 13] },
    { name: 'streets', yaw: 80, pitch: 30, zoom: 4.2, target: [16, 2, 9] },
    { name: 'streets-east', yaw: 280, pitch: 32, zoom: 4.2, target: [27, 2, 9] },
    { name: 'square', yaw: 45, pitch: 30, zoom: 6, target: [23, 1.3, 16] },
    { name: 'square-nw', yaw: 225, pitch: 30, zoom: 6, target: [23, 1.3, 16] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 6, target: [23, 1.3, 16], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const bunting = dressing.props.filter((p) => p.type === 'bunting');
    const streets = bunting.filter((p) => 'from' in p.at && p.at.from.startsWith('line-anchor'));
    const cellOf = (id: string): number => Number(id.split('@')[1]!.split(':')[0]);
    const strung = new Set(streets.map((p) => Math.floor((('from' in p.at ? cellOf(p.at.from) : 0) & 63) - 7) / 6 | 0));
    check.ok(strung.size >= 1 && strung.size <= 5, `some of the six streets have bunting, not all (${strung.size})`);
    for (const p of streets) {
      if (!('from' in p.at)) continue;
      const a = cellOf(p.at.from), c = cellOf(p.at.to);
      check.ok((a >> 12) === 2 && (c >> 12) === 2, 'hung from the upper storey');
      check.ok(((a >> 6) & 63) === 8 && ((c >> 6) & 63) === 10, 'across one of the six streets, wall to wall');
      check.equal((a & 63) % 2, 0, 'on every second cell');
    }
    // Laundry and bunting never share a gap.
    const air = new Set(streets.map((p) => ('from' in p.at ? p.at.from : '')));
    for (const l of dressing.props.filter((p) => p.type === 'laundry-line')) check.ok(!('from' in l.at) || !air.has(l.at.from), 'no laundry line through a string of bunting');
    // The square with the stall: its four sides; the other square: none.
    const square = bunting.filter((p) => 'from' in p.at && p.at.from.includes('D02'));
    check.equal(square.length, 4, 'bunting along all four sides of the market square');
    for (const p of square) {
      const lamp = dressing.props.find((q) => 'from' in p.at && p.at.from === `${q.id}/lamp-head`);
      check.ok(lamp !== undefined && 'cell' in lamp.at && (lamp.at.cell & 63) <= 25, 'on the square with the stall');
    }
  },
});
