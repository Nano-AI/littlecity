// Fixture for R-H02 (keeper's cottage): a house touching a lighthouse is
// white with red trim and a red roof, whatever colour it was given. Two of
// them (built blue and yellow), and a blue house two cells away that stays blue.
import { scenario } from '@/scenario';
import { personalityOf } from '@/style/houses';
import { PALETTE, RAMPS } from '@/style/palette';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H02.keepers-cottage',
  seed: 5102,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 4, 43, 16, 1);
  },
  build(b) {
    b.stack('lighthouse', 12, 14, { floors: 5 });
    b.house(10, 14, { w: 2, color: 4 });
    b.stack('lighthouse', 20, 14, { floors: 4 });
    b.house(21, 14, { floors: 2, color: 0 });
    b.house(15, 14, { color: 4 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 5.5, target: [16, 2.5, 14] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 5.5, target: [16, 2.5, 14] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 1, 14, 'keepers-cottage');
    check.hasTag(10, 1, 14, 'white-walls');
    check.role(21, 1, 14, 'keepers-cottage');
    check.role(15, 1, 14, 'cottage'); // two cells from the light: an ordinary cottage, still blue
    check.equal(check.applied('R-H02.keepers-cottage'), 2, "keeper's cottages");
    // The role fixes the personality: red roof, red trim, whatever the seed says.
    const s = check.structure(10, 1, 14);
    const p = personalityOf(s.seed, s.color, plan.roles.get(s.id)!.role, s.cells.length);
    check.equal(p.roofColor, RAMPS.roof[0], 'roof colour');
    check.equal(p.trim, PALETTE.red, 'trim colour');
  },
});
