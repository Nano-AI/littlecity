// Fixture for J10 (dormers): a gable or hip roof with a straight eave of 2+
// cells over a house two cells deep gets, with p = 0.3, a dormer per two
// cells. Twelve 4 × 2 houses (about a third have them), a manor (always, on
// every side), and a row of houses one cell deep (never: no slope to sit on).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J10.dormers',
  seed: 5310,
  rules: houseDressing,
  build(b) {
    for (let i = 0; i < 12; i++) b.house(6 + (i % 6) * 5, 8 + Math.floor(i / 6) * 4, { w: 4, d: 2, color: i % 8 });
    b.house(8, 17, { w: 5, d: 3, floors: 2, color: 5 });
    b.house(16, 18, { w: 4, color: 2 });
    b.house(22, 18, { w: 3, color: 4 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 4, target: [20, 1.5, 13] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 4, target: [20, 1.5, 13] },
    { name: 'close', yaw: 40, pitch: 30, zoom: 8.5, target: [10.5, 2.6, 18.5] },
  ],
  expect(_plan, _dressing, check) {
    let withDormers = 0;
    for (let i = 0; i < 12; i++) {
      const x = 6 + (i % 6) * 5, z = 8 + Math.floor(i / 6) * 4;
      const d = check.features({ type: 'dormer', on: [x, 1, z] });
      if (d.length === 0) continue;
      withDormers++;
      check.equal(d.length, 2, 'dormers on a four-cell eave (one per two cells)');
      check.equal(new Set(d.map((f) => f.dir)).size, 1, 'a cottage has them on one side');
      check.ok(d[0]!.dir === 0 || d[0]!.dir === 2, 'they look out over an eave, not a gable end');
    }
    check.ok(withDormers >= 2 && withDormers <= 7, `${withDormers} of 12 houses have dormers (p = 0.3)`);
    // The manor: always, and on more than one side.
    check.role(8, 1, 17, 'manor');
    const manor = check.hasFeature({ type: 'dormer', on: [8, 1, 17] }, 4);
    check.ok(new Set(manor.map((f) => f.dir)).size >= 2, 'the manor has dormers on several sides');
    // One cell deep: none.
    check.noFeature({ type: 'dormer', on: [16, 1, 18] });
    check.noFeature({ type: 'dormer', on: [22, 1, 18] });
  },
});
