// Fixture for D10 (creepers).
//   a long house with a garden along its south side   creepers climb about four in ten of its wall bays,
//                                                     two storeys where the house has two
//   a ring of houses round a courtyard                some of the walls that face the courtyard have one
//   a house on a street with no garden                none
//   no creeper ever on the bay with the door

import { scenario } from '@/scenario';

export default scenario({
  name: 'D10.creepers',
  seed: 1010,
  about: 'Creepers up about four in ten of the house wall bays that face a garden or a courtyard, one or two storeys high, never on the door.',
  build(b) {
    b.house(8, 10, { w: 8, floors: 2, color: 5 });
    b.garden(8, 11, 15, 12);
    b.path(7, 13, 30, 13);
    // A courtyard.
    b.house(20, 8, { w: 4, floors: 2, color: 2 });
    b.house(20, 9, { d: 2, floors: 2, color: 4 });
    b.house(23, 9, { d: 2, floors: 2, color: 0 });
    b.house(20, 11, { w: 4, floors: 2, color: 6 });
    // No garden.
    b.house(27, 12, { w: 3, floors: 2, color: 1 });
  },
  cameras: [
    { name: 'garden', yaw: 20, pitch: 28, zoom: 6, target: [12, 1.6, 11.5] },
    { name: 'garden-far', yaw: 45, pitch: 34, zoom: 3, target: [18, 1.5, 11] },
    { name: 'courtyard', yaw: 45, pitch: 50, zoom: 7, target: [22, 1.6, 10] },
    { name: 'dusk', yaw: 20, pitch: 28, zoom: 6, target: [12, 1.6, 11.5], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    const creepers = dressing.props.filter((p) => p.type === 'creeper');
    const at = (p: (typeof creepers)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const garden = creepers.filter((p) => at(p)[1] === 11 && at(p)[0] >= 8 && at(p)[0] <= 15);
    check.ok(garden.length >= 2 && garden.length <= 6, `some bays over the garden have a creeper, not all (${garden.length} of 8)`);
    for (const p of garden) check.equal((p.params as { storeys: number }).storeys, 2, 'two storeys up a two-storey wall');
    const yard = creepers.filter((p) => at(p)[0] >= 21 && at(p)[0] <= 22 && at(p)[1] >= 9 && at(p)[1] <= 10);
    check.ok(yard.length >= 1, 'a creeper in the courtyard');
    check.equal(creepers.length, garden.length + yard.length, 'none anywhere else');
    // Never on a door's bay.
    for (const f of plan.features.filter((q) => q.type === 'door')) {
      const out = f.cell! + (f.dir === 0 ? -64 : f.dir === 2 ? 64 : f.dir === 1 ? 1 : -1);
      check.ok(!creepers.some((p) => 'cell' in p.at && p.at.cell === out && p.at.face === f.dir), 'no creeper over a door');
    }
  },
});
