// R-H19 (RC-06): a one-storey house against a short tower is a smithy: the
// tower its smoking forge chimney, an open forge front with a glowing hearth,
// an anvil and a quench barrel outside, a hitching rail and trough by the
// door. With a tower of 3 it is a chapel; a two-storey house is no smithy.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-H19.smithy',
  seed: 4119,
  about: 'A smithy (2 × 1 house, 2-tall tower) on a lane; a chapel (tower of 3); a two-storey house with a short tower (no smithy).',
  build(b) {
    b.path(8, 12, 30, 12);
    b.house(10, 10, { w: 2, color: 2 });
    b.tower(9, 10, { floors: 2 });
    b.house(18, 10, { w: 2, color: 5 });
    b.tower(17, 10, { floors: 3 });
    b.house(26, 10, { w: 2, floors: 2, color: 1 });
    b.tower(25, 10, { floors: 2 });
  },
  cameras: [
    { name: 'forge', yaw: 30, pitch: 28, zoom: 5.5, target: [10.5, 1, 10.5] },
    { name: 'dusk', yaw: 30, pitch: 28, zoom: 5.5, target: [10.5, 1, 10.5], time: 'dusk' },
    { name: 'night', yaw: 30, pitch: 28, zoom: 5.5, target: [10.5, 1, 10.5], time: 'night' },
    { name: 'all', yaw: 40, pitch: 34, zoom: 2.6, target: [18, 1, 11] },
  ],
  expect(plan, dressing, check) {
    check.role(10, 1, 10, 'smithy');
    check.role(9, 1, 10, 'forge-chimney');
    check.hasFeature({ type: 'forge-front', on: [10, 1, 10], rule: 'J30.trade-fronts' });
    check.hasSocket({ type: 'chimney-top', at: [9, 2, 10] });
    check.hasProp({ type: 'structure-prop', variant: 'anvil', rule: 'R-H98.structure-props' });
    check.hasActor({ type: 'smoke' });
    check.role(18, 1, 10, 'chapel');
    check.ok(plan.roles.get(check.structure(26, 1, 10).id)?.role !== 'smithy', 'a two-storey house is no smithy');
    void dressing;
  },
});
