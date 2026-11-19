// Fixture for J10 (dormers and the rest of the roof furniture). No eave runs
// more than three cells with nothing above it. Twelve 3 × 2 cottages (about
// a third have a dormer, p = 0.3, on one side); a 4 × 2 house (always, on
// both sides, and a cross gable over its door); a manor (always, all round);
// a 5 × 1 house (one cell deep: roof lights instead); a 3 × 1 house (nothing).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J10.dormers',
  seed: 5310,
  rules: houseDressing,
  build(b) {
    for (let i = 0; i < 12; i++) b.house(6 + (i % 6) * 4, 8 + Math.floor(i / 6) * 4, { w: 3, d: 2, color: i % 8 });
    b.path(14, 20, 30, 20);
    b.house(8, 17, { w: 5, d: 3, floors: 2, color: 5 });
    b.house(15, 18, { w: 4, d: 2, color: 2 });
    b.house(22, 19, { w: 5, color: 4 });
    b.house(28, 19, { w: 3, color: 6 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 4, target: [18, 1.5, 14] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 4, target: [18, 1.5, 14] },
    { name: 'close', yaw: 40, pitch: 30, zoom: 7, target: [16, 2, 19] },
  ],
  expect(_plan, _dressing, check) {
    let withDormers = 0;
    for (let i = 0; i < 12; i++) {
      const x = 6 + (i % 6) * 4, z = 8 + Math.floor(i / 6) * 4;
      const d = check.features({ type: 'dormer', on: [x, 1, z] });
      if (d.length === 0) continue;
      withDormers++;
      check.equal(d.length, 1, 'dormers on a three-cell eave (one per two cells)');
      check.equal(d[0]!.variant, 'gabled', 'a small gabled dormer');
      check.ok(d[0]!.dir === 0 || d[0]!.dir === 2, 'it looks out over an eave, not a gable end');
    }
    check.ok(withDormers >= 1 && withDormers <= 7, `${withDormers} of 12 cottages have a dormer (p = 0.3)`);
    // An eave of four cells: always, on both sides, with a cross gable over the door on the street.
    const long = check.hasFeature({ type: "dormer", on: [15, 1, 18] }, 3);
    check.equal(new Set(long.filter((f) => f.variant === 'gabled').map((f) => f.dir)).size, 2, 'sides of the long house with dormers');
    const cross = check.hasFeature({ type: 'dormer', variant: 'cross-gable', on: [15, 1, 18] });
    const door = check.hasFeature({ type: 'door', on: [15, 1, 18] })[0]!;
    check.ok((cross[0]!.cell! & 4095) === (door.cell! & 4095) && cross[0]!.dir === door.dir, 'the cross gable stands over the main door');
    // The manor: always, and on more than one side.
    check.role(8, 1, 17, 'manor');
    const manor = check.hasFeature({ type: 'dormer', on: [8, 1, 17] }, 4);
    check.ok(new Set(manor.map((f) => f.dir)).size >= 2, 'the manor has dormers on several sides');
    // One cell deep and five long: roof lights, no dormers. Three long: nothing.
    const shallow = check.hasFeature({ type: 'dormer', on: [22, 1, 19] });
    check.ok(shallow.every((f) => f.variant === 'skylight' || f.variant === 'cross-gable'), 'a roof one cell deep has roof lights, not dormers');
    check.noFeature({ type: 'dormer', on: [28, 1, 19] });
    // No two things on one roof cell.
    const cells = check.features({ type: 'dormer' }).map((f) => f.cell);
    check.equal(new Set(cells).size, cells.length, 'roof cells used');
  },
});
