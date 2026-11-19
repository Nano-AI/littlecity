// Fixture for U02 (paddock, park or walled garden). Four enclosures and two
// that are not:
//   a picket-fenced field with four trees in it   a park: benches by the fence, a worn loop track
//   a field enclosed by walls                     a walled garden: borders, espaliers, a round bed
//   an empty fenced field                         a paddock: grazing animals and a trough
//   a fenced field of four cells                  too small: left alone
//   a field fenced on three sides only            not enclosed: left alone

import { scenario } from '@/scenario';

export default scenario({
  name: 'U02.fenced-field',
  seed: 2202,
  about: 'Grass of 6+ cells enclosed by placed fences or walls becomes a park (3+ trees), a walled garden (walls) or a paddock; smaller or open fields are left alone.',
  build(b) {
    b.path(7, 16, 36, 16);
    // The park.
    b.fenceAround(8, 10, 13, 14);
    b.put('tree', 9, 11).put('tree', 12, 11).put('tree', 10, 13).put('tree', 12, 14);
    // The walled garden.
    b.fenceAround(16, 11, 19, 14, 'wall');
    // The paddock.
    b.fenceAround(22, 11, 26, 14);
    // Too small; and open on one side.
    b.fenceAround(29, 13, 30, 14);
    for (let x = 32; x <= 35; x++) b.fenceEdge(x, 11, 'N');
    for (let z = 11; z <= 14; z++) b.fenceEdge(32, z, 'W').fenceEdge(35, z, 'E');
    b.house(15, 18, { floors: 2, color: 4 }).house(24, 18, { color: 2 });
  },
  cameras: [
    { name: 'fields', yaw: 45, pitch: 36, zoom: 2.7, target: [21, 1, 13] },
    { name: 'fields-back', yaw: 225, pitch: 36, zoom: 2.7, target: [21, 1, 13] },
    { name: 'park', yaw: 45, pitch: 32, zoom: 6.5, target: [11, 1.2, 12.5] },
    { name: 'walled', yaw: 60, pitch: 34, zoom: 8, target: [18, 1.2, 13] },
    { name: 'walled-back', yaw: 240, pitch: 34, zoom: 8, target: [18, 1.2, 13] },
    { name: 'paddock', yaw: 45, pitch: 32, zoom: 7, target: [24.5, 1.2, 13] },
    { name: 'dusk', yaw: 45, pitch: 36, zoom: 2.7, target: [21, 1, 13], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'U02.fenced-field');
    const inBox = (x0: number, z0: number, x1: number, z1: number): typeof mine =>
      mine.filter((p) => 'cell' in p.at && (p.at.cell & 63) >= x0 && (p.at.cell & 63) <= x1 && ((p.at.cell >> 6) & 63) >= z0 && ((p.at.cell >> 6) & 63) <= z1);
    const types = (list: typeof mine): Set<string> => new Set(list.map((p) => p.type));
    // The park.
    const park = inBox(8, 10, 13, 14);
    check.ok(park.filter((p) => p.type === 'bench').length >= 1, 'the park has benches');
    check.ok(park.filter((p) => p.type === 'worn-track').length >= 6, 'and a worn loop track');
    check.ok(!types(park).has('grazer') && !types(park).has('espalier'), 'and is nothing else');
    for (const bench of park.filter((p) => p.type === 'bench')) check.equal(dressing.sockets.filter((s) => s.owner === bench.id && s.type === 'seat').length, 2, 'two seats on a bench');
    // The walled garden.
    const walled = inBox(16, 11, 19, 14);
    check.ok(walled.filter((p) => p.type === 'espalier').length >= 3, 'espaliers on the garden walls');
    check.ok(walled.filter((p) => p.type === 'flower-bed' && p.variant === 'border').length >= 3, 'flower borders along them');
    check.equal(walled.filter((p) => p.type === 'flower-bed' && p.variant === 'round').length, 1, 'a round bed in the middle');
    check.ok(!types(walled).has('grazer') && !types(walled).has('worn-track'), 'no animals in the walled garden');
    // The paddock.
    const paddock = inBox(22, 11, 26, 14);
    const herd = paddock.filter((p) => p.type === 'grazer');
    check.ok(herd.length >= 2 && herd.length <= 4, `two to four animals (${herd.length})`);
    check.equal(new Set(herd.map((p) => p.variant)).size, 1, 'one kind of animal to a paddock');
    check.equal(paddock.filter((p) => p.type === 'trough').length, 1, 'a trough');
    // Left alone.
    check.equal(inBox(29, 13, 30, 14).length, 0, 'four cells are too few');
    check.equal(inBox(32, 11, 35, 14).length, 0, 'three sides are not an enclosure');
    check.equal(mine.length, park.length + walled.length + paddock.length, 'nothing anywhere else');
    for (let x = 22; x <= 26; x++) for (let z = 11; z <= 14; z++) check.noProp({ type: 'tuft', at: [x, 1, z] });
  },
});
