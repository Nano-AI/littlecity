// R-G02 (RC-01, FX-07): ground closed round by wall beside a chapel is its
// churchyard. West: a walled garden beside a chapel is mown grass with
// headstones, a cross and a yew, not herb beds. East: bare grass walled in
// beside a second chapel gets the same, and a lychgate where the path to
// the chapel door goes through the wall. A walled garden beside a plain
// house stays a garden.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-G02.churchyard',
  seed: 4202,
  about: 'A walled garden by a chapel (churchyard); walled grass by a chapel with a path and a lychgate; a walled garden by a house (herb beds or flowers).',
  build(b) {
    // West: the chapel, its steeple, and a walled garden along its south side.
    b.house(8, 8, { w: 3, color: 5 });
    b.tower(11, 8, { floors: 4 });
    b.garden(8, 9, 11, 11);
    b.fenceAround(8, 9, 11, 11, 'wall');
    // East: a chapel with walled grass to its south, a path in through the wall to its door.
    b.house(20, 8, { w: 3, color: 2 });
    b.tower(23, 8, { floors: 4 });
    for (let x = 20; x <= 23; x++) b.wallEdge(x, 12, 'S');
    for (let z = 9; z <= 12; z++) b.wallEdge(19, z, 'E').wallEdge(23, z, 'E');
    b.path(21, 13, 21, 15);
    b.path(21, 9, 21, 12);
    // A walled garden by a plain house: not a churchyard.
    b.house(30, 8, { w: 2, color: 3 });
    b.garden(30, 9, 32, 11);
    b.fenceAround(30, 9, 32, 11, 'wall');
  },
  cameras: [
    { name: 'west', yaw: 30, pitch: 34, zoom: 4.5, target: [10, 1, 10] },
    { name: 'east', yaw: 20, pitch: 32, zoom: 4.5, target: [21.5, 1, 11] },
    { name: 'dusk', yaw: 300, pitch: 32, zoom: 4, target: [21.5, 1, 11], time: 'dusk' },
    { name: 'all', yaw: 40, pitch: 40, zoom: 2.2, target: [20, 1, 11] },
  ],
  expect(plan, dressing, check) {
    check.role(8, 1, 8, 'chapel');
    check.equal(plan.roles.get(check.floorStructure(9, 1, 10).id)?.role, 'churchyard', 'the walled garden by the chapel');
    check.hasProp({ type: 'structure-prop', variant: 'headstone', rule: 'R-H98.structure-props' }, 4);
    check.hasProp({ type: 'structure-prop', variant: 'yew' }, 2);
    check.hasProp({ type: 'structure-prop', variant: 'lychgate' });
    check.ok(plan.roles.get(check.floorStructure(31, 1, 10).id)?.role !== 'churchyard', 'a garden by a house is no churchyard');
    // The east yard is bare grass: headstones stand on it.
    const eastStones = dressing.props.filter((p) => p.type === 'structure-prop' && p.variant === 'headstone' && 'cell' in p.at && (p.at.cell & 63) >= 19);
    check.ok(eastStones.length >= 2, 'headstones on the walled grass by the east chapel');
  },
});
