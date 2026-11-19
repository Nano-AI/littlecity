// Fixture for D18 (garden things):
//   a kitchen garden of six cells beside a cottage    a scarecrow among the beds; a wheelbarrow beside
//                                                     it, or a rose on the cottage wall
//   a kitchen garden of four cells                    no scarecrow: too small
//   flower gardens on their own                       beehives beside some
//   a flower garden against a house                   a trellis rose on the wall for some
//   a wheat field by a windmill                       no scarecrow from D18 (R-G01 has its own)

import { scenario } from '@/scenario';

export default scenario({
  name: 'D18.garden-things',
  seed: 1818,
  about: 'A scarecrow in a kitchen garden of 6+ cells; beehives beside flower gardens, a wheelbarrow beside kitchen gardens, a trellis rose where a garden meets a house wall.',
  build(b) {
    b.house(8, 10, { color: 3 });
    b.garden(9, 10, 11, 11);
    b.house(16, 10, { color: 5 });
    b.garden(17, 10, 18, 11);
    for (let i = 0; i < 4; i++) b.garden(8 + i * 5, 16, 9 + i * 5, 17);
    b.house(30, 10, { w: 2, floors: 2, color: 1 });
    b.garden(30, 11, 31, 12);
    b.house(34, 10, { w: 2, floors: 2, color: 6 });
    b.garden(34, 11, 35, 12);
    b.stack('windmill', 12, 24, { floors: 2 });
    b.garden(13, 24, 15, 26);
  },
  cameras: [
    { name: 'kitchen', yaw: 30, pitch: 34, zoom: 5.5, target: [10, 1, 11] },
    { name: 'flowers', yaw: 20, pitch: 36, zoom: 3.4, target: [16, 1, 16.5] },
    { name: 'walls', yaw: 200, pitch: 30, zoom: 5, target: [32.5, 1, 11.5] },
    { name: 'all', yaw: 45, pitch: 45, zoom: 2.2, target: [22, 1, 17] },
  ],
  expect(plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D18.garden-things');
    const role = (x: number, z: number): string | undefined => plan.roles.get(check.floorStructure(x, 1, z).id)?.role;
    check.equal(role(9, 10), 'kitchen-garden', 'a kitchen garden');
    const scarecrows = mine.filter((p) => p.type === 'scarecrow');
    check.equal(scarecrows.length, 1, 'one scarecrow: the big kitchen garden only');
    const at = scarecrows[0]?.at;
    check.ok(!!at && 'cell' in at && (at.cell & 63) >= 9 && (at.cell & 63) <= 11, 'it stands in the big kitchen garden');
    check.ok(mine.some((p) => p.type === 'beehive'), 'beehives beside a flower garden');
    check.ok(mine.some((p) => p.type === 'trellis'), 'a trellis rose on a house wall');
    for (const p of mine) {
      if (p.type === 'scarecrow' || p.type === 'trellis' || !('cell' in p.at)) continue;
      check.ok(!plan.world.floors.has(p.at.cell), `${p.type} stands outside the garden`);
    }
  },
});
