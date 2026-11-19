// Fixture for U09 (vista end). Long straight streets running into houses:
//   a street of 7 into a shop of two storeys                    an oriel over its shopfront
//   a street of 6 into the door of a cottage                    a grand doorway round the door
//   a street of 6 into the side wall of a cottage whose door    a niche with a saint
//   is on another street
//   a street of 6 into the side of an inn whose door is on      a clock on its top storey
//   another street
//   a street of 3 into a house                                  nothing: too short to be a view

import { scenario } from '@/scenario';

export default scenario({
  name: 'U09.vista-end',
  seed: 911,
  about: 'The facade a straight street of 5+ runs into gets a doorway, an oriel, a niche or a clock by what the house is; a short street does nothing.',
  build(b) {
    // Into a shop.
    b.path(5, 8, 11, 8);
    b.house(12, 8, { floors: 2, color: 2 });
    // Into the door of a cottage.
    b.path(18, 4, 18, 9);
    b.house(17, 10, { w: 2, color: 4 });
    // Into the side of a cottage that opens onto a street of its own.
    b.path(26, 4, 26, 9);
    b.house(26, 10, { color: 6 });
    b.path(24, 11, 29, 11);
    // Into the side of an inn.
    b.path(5, 20, 10, 20);
    b.house(11, 19, { w: 4, d: 3, floors: 2, color: 1 });
    b.path(15, 17, 15, 23);
    // Too short.
    b.path(30, 20, 32, 20);
    b.house(33, 20, { floors: 2, color: 3 });
  },
  cameras: [
    { name: 'oriel', yaw: 250, pitch: 22, zoom: 8, target: [12, 1.6, 8.5] },
    { name: 'doorway', yaw: 160, pitch: 24, zoom: 8, target: [18, 1.2, 9.5] },
    { name: 'niche', yaw: 160, pitch: 24, zoom: 8, target: [26.5, 1.2, 9.5] },
    { name: 'manor', yaw: 250, pitch: 26, zoom: 5, target: [11, 1.6, 20] },
    { name: 'all', yaw: 210, pitch: 40, zoom: 2.6, target: [19, 1, 14] },
  ],
  expect(plan, _dressing, check) {
    const vista = (x: number, z: number): string | undefined => {
      const id = check.structure(x, 1, z).id;
      return plan.features.find((f) => f.type === 'vista' && f.structure === id)?.variant;
    };
    check.equal(vista(12, 8), 'oriel', 'a street into a shop: an oriel over the shopfront');
    check.equal(vista(17, 10), 'doorway', 'a street into a door: a grand doorway');
    check.equal(vista(26, 10), 'niche', 'a street into the side of a cottage: a niche');
    check.equal(vista(11, 19), 'clock', 'a street into the side of an inn: a clock');
    check.equal(vista(33, 20), undefined, 'a short street: nothing');
    // The oriel is on the wall the street meets, one storey up, and no window shares it.
    const oriel = plan.features.find((f) => f.type === 'vista' && f.variant === 'oriel')!;
    check.equal(`${oriel.cell! & 63},${oriel.cell! >> 12},${(oriel.cell! >> 6) & 63},${oriel.dir}`, '12,2,8,3', 'the oriel is over the shopfront, on the wall the street meets');
    check.ok(!plan.features.some((f) => f.type === 'window' && f.cell === oriel.cell && f.dir === oriel.dir), 'no window behind the oriel');
  },
});
