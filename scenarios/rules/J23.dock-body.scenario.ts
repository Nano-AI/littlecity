// J23 Dock body: planks along the run, stilts at corners and every 2 cells,
// bracing on outer edges, and the fittings each role gets.
//   a long pier           planks run out to sea; stilts every second cell
//   a 3 × 4 platform      one deck, no seams; corner posts; planks along the long way
//   a dock under a house  the house's corner has no post through its floor
//   a dock against a cliff and a stone pier: no stilts or beam on those sides
// Stained docks (palette indices) keep their colour through frame and piles.

import { scenario } from '@/scenario';

export default scenario({
  name: 'J23.dock-body',
  seed: 123,
  about: 'The dock body: planks, stilts, bracing, corner posts, and how a deck meets a cliff, a block and a beach.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
    t.rect(30, 26, 36, 29, 3); // a cliff standing in the water
  },
  build(b) {
    for (let z = 30; z <= 36; z++) b.block('dock', 10, 0, z, { color: 0 });
    for (let x = 15; x <= 18; x++) for (let z = 32; z <= 34; z++) b.block('dock', x, 0, z, { color: 3 });
    // A boathouse corner: a house standing on the end of a short dock.
    for (let z = 30; z <= 31; z++) for (let x = 22; x <= 23; x++) b.block('dock', x, 0, z, { color: 5 });
    b.house(22, 31, { color: 4 });
    // Under the cliff, with a marble pier at its east end.
    for (let x = 30; x <= 33; x++) b.block('dock', x, 0, 30, { color: 1 });
    b.block('marble', 34, 0, 30);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 2.9, target: [22, 1, 32] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 2.9, target: [22, 1, 32] },
    { name: 'platform', yaw: 45, pitch: 30, zoom: 7, target: [17, 1, 33.5] },
    { name: 'platform-low', yaw: 135, pitch: 18, zoom: 7, target: [17, 1, 33.5] },
    { name: 'cliff', yaw: 60, pitch: 32, zoom: 6, target: [32.5, 1, 30.5] },
  ],
  expect(_plan, _dressing, check) {
    check.equal(check.structure(15, 0, 32).cells.length, 12, 'the platform is one dock');
    check.sameStructure([22, 0, 30], [23, 0, 31]);
    check.kind(22, 1, 31, 'house');
    check.role(10, 0, 33, 'pier');
    check.role(16, 0, 33, 'jetty');
    check.role(31, 0, 30, 'quay');
    // Bollards stand on open edges only, each with its mooring, and never under the house.
    for (const f of check.hasFeature({ type: 'bollard' }, 6)) check.ok(f.dir !== undefined && f.cell !== undefined, 'a bollard has a cell and a side');
    check.noFeature({ type: 'bollard', at: [22, 0, 31] });
    check.equal(check.sockets({ type: 'mooring' }).length, check.features({ type: 'bollard' }).length, 'one mooring per bollard');
    // The quay's bollards face the water, not the cliff or the marble.
    for (const f of check.features({ type: 'bollard', on: [31, 0, 30] })) check.equal(f.dir, 2, 'quay bollards face south');
  },
});
