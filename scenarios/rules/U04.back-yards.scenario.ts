// Fixture for U04 (back yards).
//   two rows of houses back to back, a strip of five cells between them   yards: a fence where one house's
//                                                                         yard meets the next, and a shed,
//                                                                         vegetable patch, washing pole or
//                                                                         woodpile in each
//   three cells behind two houses, closed off by a placed fence           yards as well
//   a strip behind houses that opens onto a street                        not a yard (U01 makes it a park)
//   ten cells shut in behind houses                                       too big: left alone

import { scenario } from '@/scenario';

export default scenario({
  name: 'U04.back-yards',
  seed: 4404,
  about: 'A leftover of up to 6 cells behind houses and off every street is divided into back yards with sheds, vegetable patches, washing poles and woodpiles.',
  build(b) {
    b.path(8, 9, 30, 9).path(8, 13, 30, 13);
    // Back to back: five houses a side, alternating colours so each is its own house.
    for (let i = 0; i < 5; i++) {
      b.house(10 + i, 10, { floors: 1 + (i % 2), color: i % 2 ? 2 : 4 });
      b.house(10 + i, 12, { floors: 2 - (i % 2), color: i % 2 ? 0 : 6 });
    }
    b.house(9, 11, { color: 1 }).house(15, 11, { color: 3 });
    // Behind two houses, fenced off.
    b.house(19, 10, { floors: 2, color: 5 }).house(20, 10, { color: 1 });
    b.fenceEdge(19, 11, 'W').fenceEdge(19, 11, 'S').fenceEdge(20, 11, 'S').fenceEdge(21, 11, 'S').fenceEdge(21, 11, 'E').fenceEdge(21, 11, 'N');
    // Open to the street on its south side.
    b.house(24, 10, { color: 2 }).house(25, 10, { floors: 2, color: 4 });
    b.house(23, 11, { d: 2, color: 6 }).house(26, 11, { d: 2, color: 0 });
    // Ten cells.
    b.house(9, 16, { w: 7, floors: 2, color: 3 }).house(9, 19, { w: 7, color: 5 });
    b.house(9, 17, { d: 2, color: 7 }).house(15, 17, { d: 2, color: 1 });
  },
  cameras: [
    { name: 'yards', yaw: 45, pitch: 44, zoom: 4, target: [17, 1.4, 11.5] },
    { name: 'yards-back', yaw: 225, pitch: 44, zoom: 4, target: [17, 1.4, 11.5] },
    { name: 'strip', yaw: 80, pitch: 50, zoom: 9, target: [12.5, 1.4, 11.5] },
    { name: 'strip-west', yaw: 280, pitch: 50, zoom: 9, target: [12.5, 1.4, 11.5] },
    { name: 'fenced', yaw: 135, pitch: 34, zoom: 9, target: [20, 1.3, 11.3] },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'U04.back-yards');
    const inBox = (x0: number, z0: number, x1: number, z1: number): typeof mine =>
      mine.filter((p) => 'cell' in p.at && (p.at.cell & 63) >= x0 && (p.at.cell & 63) <= x1 && ((p.at.cell >> 6) & 63) >= z0 && ((p.at.cell >> 6) & 63) <= z1);
    const things = (list: typeof mine): typeof mine => list.filter((p) => p.type !== 'garden-fence');
    const strip = inBox(10, 11, 14, 11);
    check.equal(things(strip).length, 5, 'one thing in each yard cell of the strip');
    check.equal(strip.filter((p) => p.type === 'garden-fence').length, 4, 'a fence between each pair of yards');
    check.ok(strip.filter((p) => p.type === 'shed').length <= 1, 'one shed at most');
    check.ok(new Set(things(strip).map((p) => p.type)).size >= 3, 'the yards differ');
    // Neighbours never hold the same thing.
    for (let x = 10; x < 14; x++) {
      const a = things(inBox(x, 11, x, 11))[0], c = things(inBox(x + 1, 11, x + 1, 11))[0];
      check.ok(a?.type !== c?.type, `yards at ${x} and ${x + 1} differ`);
    }
    check.equal(things(inBox(19, 11, 21, 11)).length, 3, 'the fenced strip behind two houses is yards too');
    check.equal(inBox(24, 11, 25, 12).length, 0, 'a patch open to the street is not a back yard');
    check.ok(dressing.props.some((p) => p.rule === 'U01.pocket-park' && 'cell' in p.at && (p.at.cell & 63) === 24), 'it is a pocket park instead');
    check.equal(inBox(10, 17, 14, 18).length, 0, 'ten cells are too many');
  },
});
