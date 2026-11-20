// Fixture for R-H07 (shop): a ground-storey facade on a plaza; or on a
// street when the house has 2+ storeys, near a plaza (FX-02: farther out,
// only by a seeded chance). West to east: a one-storey house on a square
// (shop), a two-storey house on the street 3 steps from it (shop), a
// one-storey house on a street (cottage), a two-storey house set back from
// the street (cottage), and a shop on the quay square by the docks, the
// only place a fishmonger may be.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'R-H07.shop',
  seed: 5107,
  rules: houseDressing,
  terrain(t) {
    t.rect(4, 4, 43, 16, 1);
  },
  build(b) {
    b.plaza(9, 12, 12, 14);
    b.path(13, 12, 23, 12);
    b.plaza(24, 12, 27, 13); // a quay square by the docks
    b.path(28, 12, 30, 12);
    b.house(10, 11, { w: 2, color: 6 });
    b.house(14, 11, { floors: 2, color: 2 });
    b.house(18, 11, { color: 0 });
    b.house(21, 9, { floors: 2, color: 3 });
    b.house(25, 11, { w: 2, floors: 2, color: 4 });
    for (let x = 24; x <= 28; x++) b.block('dock', x, 0, 17);
    b.path(26, 14, 26, 16);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 5.2, target: [19, 1.5, 12] },
    { name: 'back', yaw: 225, pitch: 32, zoom: 5.2, target: [19, 1.5, 12] },
    { name: 'close', yaw: 40, pitch: 26, zoom: 11, target: [14.6, 1.4, 11.8] },
  ],
  expect(plan, dressing, check) {
    check.role(10, 1, 11, 'shop');
    check.role(14, 1, 11, 'shop');
    check.role(18, 1, 11, 'cottage');
    check.role(21, 1, 9, 'cottage');
    check.role(25, 1, 11, 'shop');
    check.equal(check.applied('R-H07.shop'), 3, 'shops');
    // Every shop has exactly one type; fish only by the docks.
    for (const [x, z] of [[10, 11], [14, 11], [25, 11]] as const) {
      const tags = [...(plan.tags.get(check.structure(x, 1, z).id) ?? [])].filter((t) => t.startsWith('shop:'));
      check.equal(tags.length, 1, `shop types of the shop at ${x}, ${z}`);
      if (x !== 25) check.ok(tags[0] !== 'shop:fish', 'no fishmonger away from the docks');
    }
    // The shopfront: a shop door on the street side, owning the awning and sign sockets.
    const door = check.hasFeature({ type: 'door', variant: 'shop', on: [14, 1, 11] })[0]!;
    check.equal(door.dir, 2, 'the shop door faces the street');
    check.hasSocket({ type: 'awning-mount', at: [14, 1, 11] });
    check.hasSocket({ type: 'sign-bracket', at: [14, 1, 11] });
    check.hasFeature({ type: 'window', variant: 'shopfront', on: [10, 1, 11] });
    check.noFeature({ type: 'window', variant: 'shopfront', on: [18, 1, 11] });
    // Dressed by the stand-in for D07.
    check.ok(dressing.props.filter((p) => p.type === 'awning').length >= 3, 'an awning per shopfront');
    check.ok(dressing.props.filter((p) => p.type === 'hanging-sign').length === 3, 'a sign per shop');
  },
});
