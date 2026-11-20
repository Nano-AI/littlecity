// Fixture for U13 (country lanes) and the D01 change (FX-04). A village at
// the west end of a long lane:
//   the village street (houses within 3)        lit by D01 as before
//   the lane out east across the fields          no lamps; a hedgerow down one side, a milestone on
//                                                the lattice, field gates in long hedges
//   a fence along the lane's south side, with    no hedge against the fence; a field gate in the gap
//   a gap the player left
//   a lane north to a lone windmill              still country (a windmill is no frontage)

import { scenario } from '@/scenario';

export default scenario({
  name: 'U13.country-lanes',
  seed: 1313,
  about: 'Out of town, with nothing built facing it, a lane has no street lamps: a hedgerow runs down one side, milestones stand by it and field gates open off it; a gap in a fence along it gets a gate.',
  build(b) {
    b.path(6, 20, 42, 20);
    for (let x = 6; x <= 12; x += 2) b.house(x, 18, { floors: 1 + (x % 3 === 0 ? 1 : 0), color: x % 8 });
    for (let x = 7; x <= 11; x += 4) b.house(x, 22, { floors: 2, color: (x + 3) % 8 });
    // A fenced field along the lane's south side, with a gap at x = 30.
    for (let x = 24; x <= 36; x++) if (x !== 30) b.fenceEdge(x, 21, 'N');
    for (let z = 21; z <= 26; z++) b.fenceEdge(24, z, 'W').fenceEdge(36, z, 'E');
    for (let x = 24; x <= 36; x++) b.fenceEdge(x, 26, 'S');
    // A lane north to a windmill.
    b.path(38, 8, 38, 19);
    b.stack('windmill', 39, 7, { floors: 2 });
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 36, zoom: 2.1, target: [24, 1, 18] },
    { name: 'lane', yaw: 30, pitch: 30, zoom: 6, target: [28, 1.1, 20] },
    { name: 'gap', yaw: 200, pitch: 30, zoom: 7, target: [30, 1.1, 20.5] },
    { name: 'dusk', yaw: 45, pitch: 36, zoom: 2.1, target: [24, 1, 18], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const lamps = check.props({ type: 'lamp', rule: 'D01.street-lamps' });
    check.ok(lamps.some((p) => xz(p)[0] <= 14), 'the village street is lit');
    check.ok(lamps.every((p) => xz(p)[0] <= 16), `no lamps out in the fields (${lamps.map((p) => xz(p).join(',')).join(' ')})`);
    const hedges = check.hasProp({ type: 'hedge', variant: 'wild', rule: 'U13.country-lanes' }, 8);
    check.ok(hedges.every((p) => xz(p)[0] >= 14), 'no hedgerow in the village');
    check.ok(!hedges.some((p) => xz(p)[1] === 21 && xz(p)[0] >= 24 && xz(p)[0] <= 36), 'no hedge against the placed fence');
    check.hasProp({ type: 'field-gate', at: [30, 1, 21] });
    check.hasProp({ type: 'milestone', rule: 'U13.country-lanes' }, 2);
    check.ok(check.props({ type: 'milestone' }).every((p) => xz(p)[0] >= 14), 'milestones only in the country');
  },
});
