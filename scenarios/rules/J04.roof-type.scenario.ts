// Fixture for J04 (roof type), one house per branch of the rule, west to
// east: gable on one cell; gable along the long axis of a 1 × 3 and of a
// 2 × 4; hip on a 3 × 3; lean-to on a wing one cell deep against a taller
// wall; flat terrace where stairs lead onto the roof; stepped gable on a
// townhouse (the role names it).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J04.roof-type',
  seed: 5304,
  rules: houseDressing,
  build(b) {
    b.house(8, 10, { color: 0 });
    b.house(10, 9, { d: 3, color: 2 });
    b.house(12, 9, { w: 4, d: 2, color: 3 });
    b.house(17, 9, { w: 3, d: 3, color: 6 });
    b.house(21, 9, { w: 2, d: 2, floors: 2, color: 4 });
    b.house(23, 9, { d: 2, color: 4 });
    b.house(25, 9, { w: 2, d: 2, color: 5 });
    b.put('stairs', 25, 11, { rot: 0 });
    b.house(29, 9, { floors: 3, color: 1 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 5, target: [19, 1.5, 10.5] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 5, target: [19, 1.5, 10.5] },
    { name: 'top', yaw: 45, pitch: 65, zoom: 5, target: [19, 1.5, 10.5] },
  ],
  expect(_plan, _dressing, check) {
    const roof = (x: number, y: number, z: number): { variant?: string; params: { ridge?: string; against?: number } } => {
      const f = check.hasFeature({ type: 'roof', at: undefined, on: [x, y, z] });
      // The region whose cells include this one: for these fixtures, the roof of the cell's own level.
      const mine = f.find((r) => r.region === (y === 1 && f.length > 1 ? 0 : f.length - 1)) ?? f[0]!;
      return { variant: mine.variant, params: (mine.params ?? {}) as { ridge?: string; against?: number } };
    };
    check.equal(roof(8, 1, 10).variant, 'gable', 'one cell');
    check.equal(roof(10, 1, 9).variant, 'gable', '1 × 3');
    check.equal(roof(10, 1, 9).params.ridge, 'z', '1 × 3: ridge along the long axis');
    check.equal(roof(12, 1, 9).variant, 'gable', '2 × 4');
    check.equal(roof(12, 1, 9).params.ridge, 'x', '2 × 4: ridge along the long axis');
    check.equal(roof(17, 1, 9).variant, 'hip', '3 × 3');
    // The wing is region 0 (level 1) of the blue house; its tall part is region 1.
    const wing = check.hasFeature({ type: 'roof', variant: 'lean-to', on: [23, 1, 9] })[0]!;
    check.equal((wing.params as { against?: number }).against, 3, 'the lean-to leans on the wall to its west');
    check.hasFeature({ type: 'roof', variant: 'gable', on: [21, 2, 9] });
    check.hasFeature({ type: 'roof', variant: 'flat', on: [25, 1, 9] });
    check.hasFeature({ type: 'roof', variant: 'stepped-gable', on: [29, 1, 9] });
    check.equal(check.features({ type: 'roof' }).length, 8, 'one roof per region');
  },
});
