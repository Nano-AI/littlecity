// R-M09: tiers of marble seats facing one way onto a level floor are a
// theatre: deep stone benches, a balustrade along the back, a painted
// backdrop with masks and two braziers on the stage (R-H98). A flight that
// climbs to a platform is not one, and neither is a flight with no stage.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M09.theatre',
  seed: 4109,
  about: 'A 5-wide, 4-tier cavea with wings facing a plaza stage; a stair up to a platform (grand steps); seats facing a wall of houses (no stage).',
  build(b) {
    // The cavea: rows climbing north from z = 14 (1 tall) to z = 11 (4 tall), wings stepping down at the ends.
    for (let row = 0; row < 4; row++) for (let x = 10; x <= 14; x++) b.stack('marble', x, 14 - row, { floors: row + 1 });
    for (let row = 0; row < 3; row++) for (const x of [9, 15]) b.stack('marble', x, 13 - row, { floors: row + 1 });
    b.plaza(9, 15, 15, 17);
    // A stair up to a platform: grand steps, not a theatre.
    for (let row = 0; row < 3; row++) for (let x = 22; x <= 25; x++) b.stack('marble', x, 15 - row, { floors: row + 1 });
    b.fill('marble', 22, 10, 25, 12, { floors: 3 });
    // Seats facing straight into a row of houses: no stage.
    for (let row = 0; row < 3; row++) for (let x = 10; x <= 14; x++) b.stack('marble', x, 26 - row, { floors: row + 1, color: 2 });
    for (let x = 10; x <= 14; x += 2) b.house(x, 27, { w: 2, floors: 2 });
  },
  cameras: [
    { name: 'front', yaw: 20, pitch: 30, zoom: 3.4, target: [12, 2, 14] },
    { name: 'back', yaw: 160, pitch: 32, zoom: 3.2, target: [12, 2, 14] },
    { name: 'dusk', yaw: 340, pitch: 30, zoom: 3.4, target: [12, 2, 14], time: 'dusk' },
    { name: 'all', yaw: 40, pitch: 36, zoom: 2, target: [17, 1.5, 18] },
  ],
  expect(_plan, _dressing, check) {
    check.role(10, 1, 14, 'theatre');
    check.noFeature({ type: 'battlement', on: [10, 1, 14] });
    check.hasFeature({ type: 'broad-steps', on: [10, 1, 14] }, 10);
    check.hasFeature({ type: 'railing', on: [10, 1, 14] }, 5);
    check.hasProp({ type: 'structure-prop', variant: 'backdrop', rule: 'R-H98.structure-props' });
    check.hasProp({ type: 'structure-prop', variant: 'brazier' }, 2);
    check.role(22, 1, 15, 'grand-steps'); // mostly stair: R-M04's
    check.ok(check.structure(10, 1, 26).id !== check.structure(10, 1, 14).id, 'the third flight is its own structure');
    check.ok(_plan.roles.get(check.structure(10, 1, 26).id)?.role !== 'theatre', 'seats facing houses are no theatre');
  },
});
