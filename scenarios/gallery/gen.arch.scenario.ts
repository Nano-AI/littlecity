// The gallery's arch entry, and the fixture for the tier 2 arch roles: every
// arch role side by side. Along the channel: a stone bridge (R-A01). On the
// land, left to right: a gateway over a path (R-A04), a sky bridge between
// two houses (R-A02), a loggia hung off a house (R-A05), flying buttresses
// against a tower and a marble wall (R-A03), and a two-tier viaduct (R-A06).

import { scenario } from '@/scenario';

export default scenario({
  name: 'gen.arch',
  seed: 55,
  about: 'Every arch role: stone bridge, sky bridge, flying buttress, gateway, loggia, viaduct.',
  terrain(t) {
    t.flat(1);
    t.water(4, 17, 43, 19);
  },
  build(b) {
    for (let z = 17; z <= 19; z++) b.block('arch', 10, 0, z); // stone bridge
    b.path(10, 12, 10, 16).put('arch', 10, 14); // gateway
    // Sky bridge: three cells between two houses, two levels up, with a storey of each house above it.
    b.house(13, 12, { floors: 4, color: 2 }).house(17, 12, { floors: 5, color: 4 });
    for (let x = 14; x <= 16; x++) b.block('arch', x, 3, 12);
    // Loggia: two cells hanging off a house.
    b.house(20, 12, { floors: 3, color: 6 }).block('arch', 21, 2, 12).block('arch', 22, 2, 12);
    // Flying buttresses: off a tower (two cells) and off a marble wall (three cells, so the third stands on a pier).
    b.tower(26, 12, { floors: 5, color: 1 }).block('arch', 27, 3, 12).block('arch', 28, 3, 12);
    b.fill('marble', 31, 10, 32, 11, { floors: 4 });
    for (let z = 12; z <= 14; z++) b.block('arch', 31, 3, z);
    // Viaduct: two tiers.
    for (let x = 35; x <= 39; x++) b.put('arch', x, 12);
    for (let x = 36; x <= 38; x++) b.block('arch', x, 2, 12);
  },
  cameras: [
    { name: 'front', yaw: 30, pitch: 28, zoom: 2.3, target: [24.5, 2, 13.5] },
    { name: 'back', yaw: 210, pitch: 30, zoom: 2.3, target: [24.5, 2, 13.5] },
    { name: 'sky-bridge', yaw: 25, pitch: 24, zoom: 5.4, target: [15.5, 3, 12] },
    { name: 'loggia', yaw: 40, pitch: 24, zoom: 6, target: [21.5, 2.6, 12] },
    { name: 'buttress', yaw: 35, pitch: 26, zoom: 4.6, target: [29.5, 3, 12] },
    { name: 'buttress-back', yaw: 250, pitch: 28, zoom: 4.6, target: [29.5, 3, 12] },
  ],
  expect(plan, _dressing, check) {
    check.role(10, 0, 18, 'stone-bridge');
    check.role(10, 1, 14, 'gateway');
    check.role(15, 3, 12, 'sky-bridge');
    check.hasTag(15, 3, 12, 'deck:covered');
    const bays = check.hasFeature({ type: 'covered-gallery', on: [15, 3, 12] }, 3);
    check.equal((bays[0]!.params as { color: number }).color, 2, 'in the colour of the house it starts from');
    check.role(21, 2, 12, 'loggia');
    check.hasFeature({ type: 'loggia-rail', on: [21, 2, 12] }, 2);
    check.hasFeature({ type: 'arch-opening', variant: 'half', at: [22, 2, 12] });
    check.role(27, 3, 12, 'flying-buttress');
    check.hasTag(27, 3, 12, 'arch:buttress');
    check.hasFeature({ type: 'pinnacle', at: [28, 3, 12] });
    check.role(31, 3, 13, 'flying-buttress');
    check.hasFeature({ type: 'pinnacle', at: [31, 3, 14] });
    check.hasFeature({ type: 'pier', at: [31, 3, 14] }); // beyond two cells: a pier
    check.role(37, 1, 12, 'viaduct');
    check.equal(plan.trace.find((t) => t.rule === 'R-A06.viaduct')?.applied, 1, 'only the viaduct falls through to the default');
  },
});
