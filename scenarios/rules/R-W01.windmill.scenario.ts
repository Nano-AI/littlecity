// Fixture for R-W01 (windmill): a tapered body, a cap on the top block and
// four sails on the cap's hub. One, two and three cells tall on the ground,
// one raised on a tower and one on a house.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-W01.windmill',
  seed: 5201,
  rules: houseDressing,
  build(b) {
    b.put('windmill', 10, 10);
    b.stack('windmill', 14, 10, { floors: 2 });
    b.stack('windmill', 18, 10, { floors: 3 });
    b.tower(22, 10, { floors: 2 });
    b.put('windmill', 22, 10);
    b.house(26, 10, { w: 2, floors: 1, color: 3 });
    b.put('windmill', 26, 10);
    b.garden(9, 12, 15, 14);
    b.path(16, 12, 28, 12);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 4.6, target: [18, 2.5, 10.5] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 4.6, target: [18, 2.5, 10.5] },
    { name: 'se', yaw: 135, pitch: 30, zoom: 4.6, target: [18, 2.5, 10.5] },
    { name: 'close', yaw: 40, pitch: 24, zoom: 9, target: [14.5, 2, 10.5] },
  ],
  expect(_plan, dressing, check) {
    for (const x of [10, 14, 18]) {
      check.role(x, 1, 10, 'windmill');
      check.hasFeature({ type: 'door', on: [x, 1, 10] });
    }
    check.equal(check.applied('R-W01.windmill'), 5, 'windmills');
    // One cap, on the top block, owning the hub.
    const cap = check.hasFeature({ type: 'cap', variant: 'mill-cap', on: [18, 1, 10] });
    check.equal(cap.length, 1, 'caps on the three-cell mill');
    check.equal(cap[0]!.cell! >> 12, 3, 'the cap is on the top block');
    check.hasSocket({ type: 'mill-hub' }, 5);
    check.hasTag(22, 3, 10, 'raised');
    check.hasTag(26, 2, 10, 'raised');
    // The sails are an actor at the hub (the stand-in for L03 places them).
    check.equal(dressing.actors.filter((a) => a.type === 'windmill-sails').length, 5, 'sets of sails');
  },
});
