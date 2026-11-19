// Fixture for J01 (stack trim): a structure has base trim only on its lowest
// cells and a roof only where a cell is open to the sky. J01 has no rule
// file: it is how the house generator draws (src/gen/house/house.test.ts
// checks the geometry). Here: stacks of one to five storeys, a stepped pile,
// a house on a marble block (trim where it stands on the block), and a cell
// hung in the air (a beam under it, not a plinth).
import { scenario } from '@/scenario';
import { roofRegions } from '@/resolve/facts/roofs.fact';

export default scenario({
  name: 'J01.stack-trim',
  seed: 5301,
  build(b) {
    for (let i = 0; i < 5; i++) b.house(10 + i * 2, 10, { floors: i + 1, color: i });
    b.house(21, 9, { w: 3, d: 3, color: 5 });
    b.house(21, 9, { w: 2, d: 2, color: 5 });
    b.house(21, 9, { color: 5 });
    b.put('marble', 26, 10);
    b.house(26, 10, { color: 6 });
    b.house(29, 10, { floors: 2, color: 7 });
    b.block('house', 30, 2, 10, { color: 7 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 30, zoom: 5, target: [20, 2.5, 10.5] },
    { name: 'back', yaw: 225, pitch: 30, zoom: 5, target: [20, 2.5, 10.5] },
  ],
  expect(plan, _dressing, check) {
    // One roof per roof region, however many storeys: the five-storey stack has exactly one.
    for (let i = 0; i < 5; i++) check.equal(check.features({ type: 'roof', on: [10 + i * 2, 1, 10] }).length, 1, `roofs on the ${i + 1}-storey stack`);
    // The stepped pile is one structure with three sky-open regions, so three roofs.
    const pile = check.structure(21, 1, 9);
    check.equal(roofRegions(plan.facts).byStructure.get(pile.id)!.length, 3, 'roof regions of the stepped pile');
    check.equal(check.features({ type: 'roof', on: [21, 1, 9] }).length, 3, 'roofs of the stepped pile');
    // A roof region is exactly the cells with nothing of the structure above them.
    for (const r of roofRegions(plan.facts).byStructure.get(pile.id)!) {
      for (const c of r.cells) check.ok(!pile.cells.includes(c + (1 << 12)), 'a roofed cell has no cell of its own structure above');
    }
    check.kind(26, 1, 10, 'marble');
    check.kind(26, 2, 10, 'house');
  },
});
