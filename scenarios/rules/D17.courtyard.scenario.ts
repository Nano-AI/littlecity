// Fixture for D17 (courtyard):
//   a 3 × 3 court shut in by a ring of houses        cobbles wall to wall, a well or a tree in the middle
//   a 2 × 2 court shut in by houses                  cobbles and a well or a tree
//   a strip one cell wide behind two rows of houses  not a court: back yards (U04)
//   a 3 × 3 patch closed on one side by a fence      not a court

import { scenario } from '@/scenario';

/** A ring of houses round the box (x0..x1, z0..z1), its corners included. */
function ring(b: Parameters<NonNullable<Parameters<typeof scenario>[0]['build']>>[0], x0: number, z0: number, x1: number, z1: number, open?: 'S'): void {
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    b.house(x, z0 - 1, { floors: 1 + ((x + z0) % 2), color: (x * 3) % 8 });
    if (open !== 'S') b.house(x, z1 + 1, { floors: 1 + ((x + z1) % 2), color: (x * 5 + 1) % 8 });
  }
  for (let z = z0; z <= z1; z++) {
    b.house(x0 - 1, z, { floors: 2, color: (z * 3 + 2) % 8 });
    b.house(x1 + 1, z, { floors: 1, color: (z * 7 + 3) % 8 });
  }
}

export default scenario({
  name: 'D17.courtyard',
  seed: 1717,
  about: 'A court of 4–16 cells shut in by buildings is cobbled, with a well or a tree in the middle; strips behind rows and patches closed by fences are not courts.',
  build(b) {
    b.path(4, 6, 40, 6);
    ring(b, 8, 9, 10, 11);
    ring(b, 16, 9, 17, 10);
    // A strip behind two rows.
    for (let x = 22; x <= 27; x++) {
      b.house(x, 9, { color: x % 8 });
      b.house(x, 11, { color: (x + 3) % 8 });
    }
    b.house(21, 10, { color: 2 }).house(28, 10, { color: 5 });
    // A patch closed by a fence on its south side.
    ring(b, 32, 9, 34, 11, 'S');
    for (let x = 32; x <= 34; x++) b.fenceEdge(x, 11, 'S');
    b.house(31, 12, { color: 1 }).house(35, 12, { color: 4 });
  },
  cameras: [
    { name: 'court', yaw: 30, pitch: 50, zoom: 5.5, target: [9, 1, 10] },
    { name: 'small', yaw: 210, pitch: 50, zoom: 6, target: [16.5, 1, 9.5] },
    { name: 'all', yaw: 20, pitch: 55, zoom: 2.4, target: [22, 1, 10] },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D17.courtyard');
    const inBox = (p: (typeof mine)[number], x0: number, x1: number): boolean => 'cell' in p.at && (p.at.cell & 63) >= x0 && (p.at.cell & 63) <= x1;
    check.equal(mine.filter((p) => p.type === 'cobbles' && inBox(p, 8, 10)).length, 9, 'the big court is cobbled');
    check.equal(mine.filter((p) => p.type !== 'cobbles' && inBox(p, 8, 10)).length, 1, 'one thing in its middle');
    check.equal(mine.filter((p) => p.type === 'cobbles' && inBox(p, 16, 17)).length, 4, 'the small court is cobbled');
    check.equal(mine.filter((p) => inBox(p, 22, 27)).length, 0, 'a strip behind rows is not a court');
    check.ok(dressing.props.some((p) => p.rule === 'U04.back-yards'), 'it is back yards');
    check.equal(mine.filter((p) => inBox(p, 32, 34)).length, 0, 'a patch closed by a fence is not a court');
  },
});
