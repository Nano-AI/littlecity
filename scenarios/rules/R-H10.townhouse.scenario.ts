// Fixture for R-H10 (townhouse): a footprint of exactly one cell, 3+
// storeys. Six of them of different heights and colours behind front
// gardens, then two that are not: only two storeys; two cells wide.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H10.townhouse',
  seed: 5110,
  rules: houseDressing,
  build(b) {
    b.path(8, 13, 30, 13);
    const colors = [1, 4, 6, 0, 2, 7];
    for (let i = 0; i < 6; i++) b.house(10 + i * 2, 11, { floors: 3 + (i % 3), color: colors[i]! });
    b.house(23, 11, { floors: 2, color: 3 });
    b.house(26, 11, { w: 2, floors: 3, color: 5 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 4.6, target: [18, 3, 11.5] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 4.6, target: [18, 3, 11.5] },
    { name: 'close', yaw: 35, pitch: 24, zoom: 8.5, target: [11, 3, 11.5] },
  ],
  expect(_plan, _dressing, check) {
    for (let i = 0; i < 6; i++) {
      check.role(10 + i * 2, 1, 11, 'townhouse');
      check.hasFeature({ type: 'roof', variant: 'stepped-gable', on: [10 + i * 2, 1, 11] });
      check.hasFeature({ type: 'door', on: [10 + i * 2, 1, 11] });
    }
    check.role(23, 1, 11, 'cottage');
    check.role(26, 1, 11, 'cottage');
    check.equal(check.applied('R-H10.townhouse'), 6, 'townhouses');
    // Balconies: each upper storey on the door side has one with p = 0.5, so six houses have a few.
    const balconies = check.hasFeature({ type: 'balcony' }, 2);
    for (const f of balconies) check.ok((f.cell! >> 12) >= 2, 'balconies are on upper storeys');
    check.noFeature({ type: 'balcony', on: [23, 1, 11] });
    check.hasSocket({ type: 'perch' }, balconies.length);
  },
});
