// Fixture for J05 (roof terrace): a roof region of 2+ cells beside a taller
// part of the same house becomes a terrace with p = 0.35. Ten houses, each a
// two-storey block with a two-cell wing: about a third of the wings are
// terraces (with a door from the taller part, J07), the rest lean-tos. A
// one-cell wing is never one.
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

export default scenario({
  name: 'J05.roof-terrace',
  seed: 5305,
  rules: houseDressing,
  build(b) {
    for (let i = 0; i < 10; i++) {
      const x = 8 + (i % 5) * 5, z = 9 + Math.floor(i / 5) * 5;
      b.house(x, z, { d: 2, floors: 2, color: i % 8 });
      b.house(x + 1, z, { d: 2, color: i % 8 });
    }
    b.house(33, 9, { floors: 2, color: 3 });
    b.house(34, 9, { color: 3 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 4.4, target: [20, 1.5, 12.5] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 4.4, target: [20, 1.5, 12.5] },
    { name: 'top', yaw: 45, pitch: 62, zoom: 4.4, target: [20, 1.5, 12.5] },
  ],
  expect(_plan, _dressing, check) {
    let terraces = 0;
    for (let i = 0; i < 10; i++) {
      const x = 8 + (i % 5) * 5, z = 9 + Math.floor(i / 5) * 5;
      const flat = check.features({ type: 'roof', variant: 'flat', on: [x, 1, z] });
      if (flat.length === 0) {
        check.hasFeature({ type: 'roof', variant: 'lean-to', on: [x, 1, z] });
        continue;
      }
      terraces++;
      check.equal(flat[0]!.rule, 'J05.roof-terrace', 'who made it flat');
      // The taller part opens onto it: one door at the terrace's level, facing east.
      check.equal(check.hasFeature({ type: 'door', variant: 'deck', on: [x, 1, z], dir: 1 }).length, 1, 'doors onto the terrace');
      // And no chimney stands on a terrace.
      for (const c of check.features({ type: 'chimney', on: [x, 1, z] })) check.ok((c.cell! & 63) === x, 'chimneys stay on the pitched part');
    }
    check.ok(terraces >= 2 && terraces <= 6, `${terraces} of 10 wings are terraces (p = 0.35)`);
    check.equal(check.applied('J05.roof-terrace'), terraces, 'terraces');
    check.hasFeature({ type: 'roof', variant: 'lean-to', on: [33, 1, 9] });
  },
});
