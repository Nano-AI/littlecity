// Fixture for R-H11 (row house): one or two cells of footprint, sharing side
// walls with houses of another colour on two opposite sides. A row of six:
// the four in the middle are row houses, the two ends are cottages. Behind
// it, a row running the other way.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H11.row-house',
  seed: 5111,
  rules: houseDressing,
  build(b) {
    b.path(8, 14, 24, 14);
    const colors = [2, 5, 0, 4, 6, 1];
    for (let i = 0; i < 6; i++) b.house(10 + i, 12, { floors: i === 3 ? 1 : 2, color: colors[i]! });
    for (let i = 0; i < 4; i++) b.house(20, 6 + i, { floors: 2, color: colors[i + 1]! });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 6.5, target: [14, 2, 12] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 6.5, target: [14, 2, 12] },
    { name: 'side', yaw: 135, pitch: 30, zoom: 6.5, target: [17, 2, 10] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 1, 12, 'cottage');
    check.role(15, 1, 12, 'cottage');
    for (let x = 11; x <= 14; x++) {
      check.role(x, 1, 12, 'row-house');
      check.hasTag(x, 1, 12, 'in-row');
      // Eaves aligned with the row: no ridge offset, and the ridge runs along the row.
      const roof = check.hasFeature({ type: 'roof', variant: 'gable', on: [x, 1, 12] })[0]!;
      const params = roof.params as { ridge?: string; lift?: number };
      check.equal(params.ridge, 'x', `ridge of the house at ${x}`);
      check.equal(params.lift, undefined, `ridge offset of the house at ${x}`);
      // A chimney on the party wall: always one.
      check.hasFeature({ type: 'chimney', on: [x, 1, 12] });
    }
    check.role(20, 1, 7, 'row-house');
    check.equal((check.hasFeature({ type: 'roof', on: [20, 1, 7] })[0]!.params as { ridge?: string }).ridge, 'z', 'the other row runs north-south');
    check.equal(check.applied('R-H11.row-house'), 6, 'row houses');
    check.ok(plan.structures.size >= 10, 'ten separate houses');
  },
});
