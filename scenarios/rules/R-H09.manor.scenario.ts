// Fixture for R-H09 (manor): a footprint of 10+ cells or 16+ cells in all.
// West to east: a 4 × 3 house (footprint 12: a manor, one storey); a 3 × 3
// of two storeys (18 cells: a manor); an E-shaped house (footprint 13); and
// a 3 × 3 of one storey (9 cells: not one).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H09.manor',
  seed: 5109,
  rules: houseDressing,
  build(b) {
    b.house(8, 10, { w: 4, d: 3, color: 5 });
    b.house(14, 10, { w: 3, d: 3, floors: 2, color: 2 });
    b.house(19, 9, { w: 5, d: 2, floors: 2, color: 0 });
    b.house(19, 11, { d: 2, floors: 2, color: 0 });
    b.house(23, 11, { d: 2, floors: 2, color: 0 });
    b.house(21, 11, { color: 0 });
    b.house(27, 10, { w: 3, d: 3, color: 4 });
    b.path(6, 14, 30, 14);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 4.6, target: [18, 2, 11.5] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 4.6, target: [18, 2, 11.5] },
    { name: 'close', yaw: 40, pitch: 28, zoom: 8, target: [15.5, 2, 12] },
  ],
  expect(_plan, _dressing, check) {
    check.role(8, 1, 10, 'manor');
    check.role(14, 1, 10, 'manor');
    check.role(19, 1, 9, 'manor');
    check.role(27, 1, 10, 'cottage');
    check.equal(check.applied('R-H09.manor'), 3, 'manors');
    for (const [x, z] of [[8, 10], [14, 10], [19, 9]] as const) {
      // A hip roof, at least two chimneys, dormers, and a portico at the door.
      check.hasFeature({ type: 'roof', variant: 'hip', on: [x, 1, z] });
      check.hasFeature({ type: 'chimney', on: [x, 1, z] }, 2);
      check.hasFeature({ type: 'dormer', on: [x, 1, z] }, 2);
      const door = check.hasFeature({ type: 'door', on: [x, 1, z] })[0]!;
      const portico = check.hasFeature({ type: 'portico', on: [x, 1, z] })[0]!;
      check.ok(portico.cell === door.cell && portico.dir === door.dir, 'the portico stands at the door');
    }
    check.noFeature({ type: 'portico', on: [27, 1, 10] });
    // No chimney shares a cell with a dormer.
    for (const d of check.features({ type: 'dormer' })) check.ok(check.features({ type: 'chimney' }).every((c) => c.cell !== d.cell), 'chimneys keep off dormer cells');
  },
});
