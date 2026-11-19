// Fixture for U11 (civic hall) and U11-F (its front). Squares with houses
// round them:
//   a big house of three storeys (footprint 8) on the square's north side   the town hall: an arcade on the
//                                                                            square, a balcony and a clock
//                                                                            over the door, a flag
//   a house of two storeys (footprint 4) on the east side                   a shop, not a hall
//   a big house on a small plaza of 2 × 3                                   not a hall: no square
//   a big house of two storeys on a second square, south-west              a hall of two storeys: its
//                                                                            clock beside the balcony, and
//                                                                            no room for a flag there

import { scenario } from '@/scenario';

export default scenario({
  name: 'U11.civic-hall',
  seed: 1111,
  about: 'A house of footprint 8+ looking out onto a square is the town hall: arcade, balcony, clock and flag. Smaller houses on a square, and big houses on a small plaza, are not.',
  build(b) {
    b.plaza(14, 14, 19, 19);
    b.house(15, 12, { w: 4, d: 2, floors: 3, color: 5 });
    b.house(20, 15, { w: 2, d: 2, floors: 2, color: 2 });
    b.path(20, 17, 26, 17);
    // A small plaza.
    b.plaza(30, 14, 31, 16);
    b.house(30, 12, { w: 4, d: 2, floors: 2, color: 3 });
    // A second square with a two-storey hall.
    b.plaza(6, 24, 10, 28);
    b.house(6, 29, { w: 4, d: 2, floors: 2, color: 0 });
  },
  cameras: [
    { name: 'hall', yaw: 20, pitch: 28, zoom: 5.5, target: [17, 1.5, 14] },
    { name: 'hall-close', yaw: 340, pitch: 20, zoom: 9, target: [17, 1.4, 13.6] },
    { name: 'hall-back', yaw: 200, pitch: 32, zoom: 5, target: [17, 1.5, 14] },
    { name: 'small', yaw: 200, pitch: 30, zoom: 5.5, target: [8, 1.2, 28] },
    { name: 'dusk', yaw: 20, pitch: 28, zoom: 5.5, target: [17, 1.5, 14], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    check.role(15, 1, 12, 'town-hall');
    check.ok(plan.roles.get(check.structure(20, 1, 15).id)?.role !== 'town-hall', 'a small house on the square is not a hall');
    check.ok(plan.roles.get(check.structure(30, 1, 12).id)?.role !== 'town-hall', 'a big house on a small plaza is not a hall');
    check.role(6, 1, 29, 'town-hall');
    const halls = [check.structure(15, 1, 12).id, check.structure(6, 1, 29).id];
    // The front: an arcade bay in front of each ground-storey cell on the square, a balcony, a clock, a flag.
    check.equal(plan.features.filter((f) => f.type === 'arcade' && f.structure === halls[0]).length, 4, 'arcade bays on the square');
    for (const id of halls) {
      check.ok(plan.features.some((f) => f.structure === id && f.type === 'balcony' && f.rule === 'U11-F.hall-front'), `hall ${id} has its balcony`);
      check.ok(plan.features.some((f) => f.structure === id && f.type === 'vista' && f.variant === 'clock'), `hall ${id} has its clock`);
    }
    check.equal(dressing.props.filter((p) => p.type === 'flag' && p.variant === 'wall').length, 1, 'the tall hall flies a flag beside its clock');
    // The hall's door opens onto the square, and no window shares the clock's wall.
    const door = plan.features.find((f) => f.structure === halls[0] && f.type === 'door' && (f.params as { main?: number }).main === 1);
    check.equal(door?.dir, 2, 'the door faces the square (south)');
    for (const clock of plan.features.filter((f) => f.type === 'vista')) {
      check.ok(!plan.features.some((f) => f.type === 'window' && f.cell === clock.cell && f.dir === clock.dir), 'no window behind the clock');
    }
  },
});
