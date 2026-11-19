// The gallery's tower entry, and the fixture for the tier 2 and 3 tower
// roles: every role and cap side by side, each placed so its own rule picks
// it. Front row, left to right: watchtower (R-T07), steeple beside its
// chapel (R-T01), castle turret in a marble corner (R-T02), clock tower on a
// square (R-T03), dovecote by a garden (R-T05), campanile (R-T06, the
// tallest in town). On the hill behind: the observatory (R-T04).

import { scenario } from '@/scenario';

export default scenario({
  name: 'gen.tower',
  seed: 45,
  about: 'Every tower role and cap: watchtower, steeple, castle turret, clock tower, dovecote, campanile, observatory.',
  terrain(t) {
    t.flat(1);
    t.rect(22, 6, 28, 10, 2);
    t.rect(23, 7, 27, 9, 3);
  },
  build(b) {
    b.path(8, 15, 32, 15);
    b.tower(9, 13, { floors: 4, color: 3 }); // watchtower
    b.house(12, 13, { w: 2, color: 5 }).tower(14, 13, { floors: 4, color: 0 }); // steeple
    b.stack('marble', 17, 13, { floors: 2 }).stack('marble', 18, 12, { floors: 2 }).stack('marble', 17, 12, { floors: 2 }); // a castle corner
    b.tower(18, 13, { floors: 4, color: 1 }); // castle turret: marble on its west and north
    b.plaza(21, 11, 23, 13).tower(24, 12, { floors: 5, color: 6 }); // clock tower by the square
    b.garden(27, 12, 28, 13).tower(27, 11, { floors: 3, color: 2 }); // dovecote by the garden
    b.tower(31, 13, { floors: 7, color: 4 }); // campanile: the tallest, 6+
    b.tower(25, 8, { floors: 4, color: 7 }); // observatory on the hilltop
  },
  cameras: [
    { name: 'front', yaw: 40, pitch: 28, zoom: 2.8, target: [20.5, 3, 12] },
    { name: 'back', yaw: 220, pitch: 32, zoom: 2.8, target: [20.5, 3, 12] },
    { name: 'left', yaw: 55, pitch: 24, zoom: 5.2, target: [13.5, 3.2, 13] },
    { name: 'middle', yaw: 55, pitch: 24, zoom: 5.2, target: [21.5, 3.6, 12] },
    { name: 'right', yaw: 55, pitch: 24, zoom: 4.4, target: [29, 4.5, 12] },
    { name: 'hill', yaw: 20, pitch: 26, zoom: 5.5, target: [25, 5.5, 8] },
    { name: 'far', yaw: 315, pitch: 38, zoom: 1.9, target: [20.5, 2, 11] },
  ],
  expect(plan, _dressing, check) {
    check.role(9, 1, 13, 'watchtower');
    check.role(14, 1, 13, 'steeple');
    check.role(18, 1, 13, 'castle-turret');
    check.hasFeature({ type: 'cap', variant: 'battlements', at: [18, 4, 13] });
    check.hasFeature({ type: 'arrow-slit', on: [18, 1, 13] }, 2);
    check.noFeature({ type: 'window', on: [18, 1, 13] });
    check.role(24, 1, 12, 'clock-tower');
    check.hasTag(24, 1, 12, 'body:square');
    check.equal(check.features({ type: 'clock-face', at: [24, 5, 12] }).length, 4, 'a clock on each side');
    check.hasSocket({ type: 'clock-hands', at: [24, 5, 12] }, 4);
    check.hasFeature({ type: 'cap', variant: 'pyramid', at: [24, 5, 12] });
    check.noFeature({ type: 'window', at: [24, 5, 12] });
    check.role(27, 1, 11, 'dovecote');
    check.hasFeature({ type: 'dove-holes', at: [27, 3, 11] }, 2);
    check.hasFeature({ type: 'cap', variant: 'dovecote', at: [27, 3, 11] });
    check.role(31, 1, 13, 'campanile');
    check.hasFeature({ type: 'belfry', at: [31, 7, 13] });
    check.hasSocket({ type: 'bell', at: [31, 7, 13] });
    check.role(25, 3, 8, 'observatory');
    check.hasFeature({ type: 'cap', variant: 'dome', at: [25, 6, 8] });
    check.hasSocket({ type: 'telescope', at: [25, 6, 8] });
    check.equal(plan.trace.find((t) => t.rule === 'R-T06.campanile')?.applied, 1, 'one campanile');
  },
});
