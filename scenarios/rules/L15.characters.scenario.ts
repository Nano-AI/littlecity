// L14 and L15: a village with a long street (sparrows), a dovecote by its
// garden (doves), a tower (the stork on its tip), trees (the owl at
// night), a little inlet (the duck and her ducklings) and a wheat field by
// the windmill (a crow on the scarecrow).
//
//   node src/life/testing/sequence.mjs L15.characters --frames 12 --every 300 --name doves --zoom 7 --target 14,2,12
//   node src/life/testing/sequence.mjs L15.characters --frames 12 --every 300 --name ducks --zoom 9 --target 21.5,0,26

import { scenario } from '@/scenario';

export default scenario({
  name: 'L15.characters',
  seed: 1515,
  about: 'Sparrows on a street (L14); doves, a stork, an owl, a duck with ducklings and a crow (L15).',
  terrain(t) {
    t.flat(0);
    t.rect(6, 6, 36, 29, 1);
    t.rect(21, 23, 21, 29, 0); // a narrow inlet: water with land either side
  },
  build(b) {
    b.garden(12, 11, 14, 12).tower(13, 10, { floors: 3, color: 2 }); // a dovecote
    b.path(8, 18, 30, 18); // a long street
    b.house(16, 15, { floors: 3, w: 2, color: 3 });
    b.tower(9, 14, { floors: 4, color: 1 }); // the stork's tower
    for (let i = 0; i < 4; i++) b.house(19 + i * 2, 16, { floors: 1 + (i % 2), color: i });
    b.put('tree', 10, 22).put('tree', 12, 23).put('tree', 26, 22);
    b.stack('windmill', 29, 10, { floors: 2 });
    b.garden(30, 10, 32, 12); // wheat, with a scarecrow
  },
  cameras: [
    { name: 'village', yaw: 45, pitch: 32, zoom: 2.4, target: [20, 1, 18] },
    { name: 'dovecote', yaw: 45, pitch: 30, zoom: 7, target: [13, 2, 11] },
    { name: 'night', yaw: 45, pitch: 32, zoom: 2.4, target: [20, 1, 18], time: 'night' },
  ],
  expect(_plan, _dressing, check) {
    const kinds = (v: string): number => check.actors({ type: 'small-bird' }).filter((a) => a.variant === v).length;
    check.ok(kinds('sparrow') >= 3, `sparrows on the street, got ${kinds('sparrow')}`);
    check.ok(kinds('dove') >= 3, `doves at the dovecote, got ${kinds('dove')}`);
    check.equal(kinds('stork'), 1, 'one stork');
    check.equal(kinds('owl'), 1, 'one owl');
    check.equal(kinds('duck'), 1, 'one duck');
    check.ok(kinds('crow') >= 1, 'a crow on the scarecrow');
  },
});
