// Fixture for R-H06 (inn): 6+ cells, 2+ storeys, a ground-storey facade on a
// street or plaza, at a place where travellers arrive (FX-02), one per
// place. West to east: a 3 × 1 house of two storeys on the street just off
// a square (the square's inn); the same house with one storey (3 cells, a
// cottage); the same two-storey house on the plain street between the
// squares (a home or a shop, never an inn); a two-storey 2 × 2 on a second
// square (8 cells: an inn, not a shop: the inn rule comes first); a big
// house away from any floor (a cottage).
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H06.inn',
  seed: 5106,
  rules: houseDressing,
  build(b) {
    b.path(8, 13, 22, 13);
    b.plaza(8, 14, 12, 16); // a square just south of the street
    b.house(10, 12, { w: 3, floors: 2, color: 6 });
    b.house(15, 12, { w: 3, color: 2 });
    b.house(19, 12, { w: 3, floors: 2, color: 3 });
    b.plaza(23, 13, 26, 15);
    b.house(24, 11, { w: 2, d: 2, floors: 2, color: 0 });
    b.house(30, 9, { w: 3, floors: 2, color: 4 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 5, target: [20, 2, 12] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 5, target: [20, 2, 12] },
    { name: 'close', yaw: 40, pitch: 26, zoom: 9, target: [11.5, 1.6, 12.6] },
  ],
  expect(_plan, dressing, check) {
    check.role(10, 1, 12, 'inn');
    check.role(15, 1, 12, 'cottage');
    check.role(24, 1, 11, 'inn');
    check.role(30, 1, 9, 'cottage');
    check.ok(_plan.roles.get(check.structure(19, 1, 12).id)?.role !== 'inn', 'no inn on a plain street');
    check.equal(check.applied('R-H06.inn'), 2, 'inns');
    // The inn sign hangs from a bracket by the door (the stand-in for D07 dresses the socket).
    const door = check.hasFeature({ type: 'door', on: [10, 1, 12] })[0]!;
    check.equal(door.dir, 2, 'the inn door is on the street');
    check.hasSocket({ type: 'sign-bracket', at: [door.cell! & 63, 1, 12] });
    // Which house a prop at a door socket belongs to.
    const owner = (p: (typeof dressing.props)[number]): number | undefined =>
      'socket' in p.at ? _plan.sockets.find((s) => s.id === (p.at as { socket: string }).socket)?.structure : undefined;
    const inns = new Set([check.structure(10, 1, 12).id, check.structure(24, 1, 11).id]);
    check.equal(dressing.props.filter((p) => p.type === 'hanging-sign' && inns.has(owner(p) ?? -1)).length, 2, 'two inn signs');
    check.ok(dressing.props.every((p) => p.type !== 'awning' || !inns.has(owner(p) ?? -1)), 'an inn has no shop awning');
    check.hasProp({ type: 'role-prop', variant: 'lantern' }, 2);
  },
});
