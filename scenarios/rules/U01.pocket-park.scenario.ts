// Fixture for U01 (pocket park). Grass shut in between streets and houses:
//   nine cells between a house's back wall and three streets  a park: hedge on the street sides with one
//                                                             way in, a bench against the wall, a bed, shrubs
//   two cells between two streets                             the smallest park: hedge, bench, bed
//   an odd patch beside a marble terrace and its stair        a park that wraps the terrace's foot
//   one cell on its own                                       too small: left alone
//   a block of thirty cells ringed by streets                 too big: it stays a meadow
//   the open country round the town                           not a leftover at all

import { scenario } from '@/scenario';

export default scenario({
  name: 'U01.pocket-park',
  seed: 1101,
  about: 'A leftover patch of 2 to 16 grass cells touching a street becomes a pocket park: a hedge with one way in, a bench, a flower bed, shrubs. Smaller and larger patches are left alone.',
  build(b) {
    b.path(8, 15, 34, 15); // the street everything hangs off
    // Nine cells behind a house.
    b.house(10, 11, { w: 3, floors: 2, color: 2 });
    b.path(9, 11, 9, 14).path(13, 11, 13, 14);
    // Two cells.
    b.path(15, 13, 18, 13).path(15, 14).path(18, 14);
    // Beside a marble terrace with a stair up it.
    b.fill('marble', 21, 11, 23, 12, { floors: 1 });
    b.block('stairs', 24, 1, 12, { rot: 3 });
    b.path(20, 10, 20, 14).path(21, 10, 26, 10).path(26, 11, 26, 14);
    // One cell.
    b.path(28, 13, 30, 13).path(28, 14).path(30, 14);
    // Thirty cells.
    b.path(8, 16, 8, 22).path(9, 22, 14, 22).path(14, 16, 14, 21);
  },
  cameras: [
    { name: 'parks', yaw: 45, pitch: 36, zoom: 3, target: [19, 1, 14] },
    { name: 'parks-back', yaw: 225, pitch: 36, zoom: 3, target: [19, 1, 13] },
    { name: 'behind-house', yaw: 45, pitch: 32, zoom: 8, target: [11.5, 1.2, 13.2] },
    { name: 'small', yaw: 135, pitch: 32, zoom: 9, target: [17, 1.2, 14] },
    { name: 'terrace', yaw: 45, pitch: 32, zoom: 6.5, target: [23.5, 1.4, 12.5] },
    { name: 'terrace-nw', yaw: 250, pitch: 32, zoom: 6.5, target: [23.5, 1.4, 12.5] },
    { name: 'dusk', yaw: 45, pitch: 32, zoom: 8, target: [11.5, 1.2, 13.2], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'U01.pocket-park');
    const inBox = (x0: number, z0: number, x1: number, z1: number): typeof mine =>
      mine.filter((p) => 'cell' in p.at && (p.at.cell & 63) >= x0 && (p.at.cell & 63) <= x1 && ((p.at.cell >> 6) & 63) >= z0 && ((p.at.cell >> 6) & 63) <= z1);
    const park = (name: string, x0: number, z0: number, x1: number, z1: number, streetSides: number): void => {
      const props = inBox(x0, z0, x1, z1);
      const hedges = props.filter((p) => p.type === 'hedge');
      check.equal(hedges.length, streetSides, `${name}: a hedge piece on every street side`);
      check.ok(hedges.filter((p) => p.variant === 'gap').length >= 1, `${name}: a way in`);
      const benches = props.filter((p) => p.type === 'bench');
      check.ok(benches.length >= 1, `${name}: a bench`);
      for (const bench of benches) check.equal(dressing.sockets.filter((s) => s.owner === bench.id && s.type === 'seat').length, 2, `${name}: two seats on the bench`);
      check.ok(props.some((p) => p.type === 'flower-bed'), `${name}: a flower bed`);
    };
    park('behind the house', 10, 12, 12, 14, 3 + 3 + 3);
    park('the two cells', 16, 14, 17, 14, 2 + 2 + 2);
    check.ok(inBox(21, 11, 25, 14).some((p) => p.type === 'bench'), 'the patch round the terrace is a park');
    // The bench behind the house has its back to the wall.
    const wallBench = inBox(10, 12, 12, 12).filter((p) => p.type === 'bench');
    check.ok(wallBench.length >= 1, 'a bench against the house wall');
    for (const p of wallBench) check.ok('cell' in p.at && p.at.pos === 'n' && p.at.face === 2, 'its back to the wall, looking into the park');
    // Too small, too big, and the open country.
    check.equal(inBox(29, 14, 29, 14).length, 0, 'one cell is not a park');
    check.equal(inBox(9, 16, 13, 21).length, 0, 'thirty cells are not a pocket park');
    check.equal(mine.length, inBox(10, 11, 25, 14).length, 'nothing out in the open country');
    // Wild grass leaves a park alone.
    for (let x = 10; x <= 12; x++) for (let z = 12; z <= 14; z++) check.noProp({ type: 'tuft', at: [x, 1, z] });
  },
});
