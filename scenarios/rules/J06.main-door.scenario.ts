// Fixture for J06 (main door): one per house, on the ground-storey facade
// cell with the best score. West to east: street to the south and water to
// the north (door to the street); a plaza east and a street south (street
// wins, +5 against +4); a garden two cells west and nothing else (the
// garden side: a floor within 3); a house in an alley with one free side;
// a long house with its door on the cell the street touches.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J06.main-door',
  seed: 5306,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 9, 43, 30, 1);
  },
  build(b) {
    b.path(8, 11, 14, 11);
    b.house(10, 10, { color: 0 }); // water north (z = 8), street south
    b.house(13, 10, { color: 2 });
    b.plaza(14, 9, 15, 10); // plaza east of it
    b.house(20, 12, { color: 3 });
    b.garden(17, 12, 18, 12); // a garden two cells west
    b.house(24, 11, { d: 3, floors: 2, color: 4 });
    b.house(26, 11, { d: 3, floors: 2, color: 6 }); // an alley between them
    b.house(25, 16, { w: 4, color: 5 });
    b.path(27, 17, 27, 20); // a lane ending at its third cell
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 5, target: [19, 1.5, 13] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 5, target: [19, 1.5, 13] },
  ],
  expect(plan, _dressing, check) {
    const main = (x: number, z: number): { cell: number; dir: number } => {
      const doors = check.features({ type: 'door', on: [x, 1, z] }).filter((f) => (f.params as { main?: number } | undefined)?.main === 1);
      check.equal(doors.length, 1, `main doors of the house at ${x}, ${z}`);
      return { cell: doors[0]!.cell!, dir: doors[0]!.dir! };
    };
    check.equal(main(10, 10).dir, 2, 'street to the south beats water to the north');
    check.equal(main(13, 10).dir, 2, 'a street (+5) beats a plaza (+4)');
    check.equal(main(20, 12).dir, 3, 'the garden within 3 cells draws the door west');
    check.ok(main(24, 11).dir !== 1, 'not into the alley');
    check.ok(main(26, 11).dir !== 3, 'not into the alley');
    const long = main(25, 16);
    check.equal(long.dir, 2, 'the long house opens south');
    check.equal(long.cell & 63, 27, 'on the cell the lane touches');
    // Every house has exactly one, and every door owns its threshold socket.
    const houses = [...plan.structures.values()].filter((s) => s.kind === 'house').length;
    check.equal(check.applied('J06.main-door'), houses, 'main doors');
    check.hasSocket({ type: 'door' }, houses);
  },
});
