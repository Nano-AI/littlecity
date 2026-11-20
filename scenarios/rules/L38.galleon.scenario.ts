// L38: a harbour town with a long quay and a pier. Whatever fits calls: the
// galleon most often, with the galley and the cog taking turns at the quay. It comes up over the edge of the map, lines up with
// the quay (the pier stands in the way from the east, so from that side it
// comes in at an angle and swings its stern in), comes alongside and moors.
//
//   npm run shots -- L38.galleon                (opened: the galleon is in)
//   node src/life/testing/sequence.mjs L38.galleon --edit 'erase@24,0,27' --frames 12 --every 1500 --name leave
//                                             (erase a quay cell: it casts off and leaves)

import { scenario } from '@/scenario';

export default scenario({
  name: 'L38.galleon',
  seed: 3801,
  about: 'A long quay and a pier: a galleon, a galley and a cog take turns at the quay (L38–L40); rowboats moor along both.',
  terrain(t) {
    t.flat(0);
    t.rect(14, 12, 34, 26, 1);
  },
  build(b) {
    for (let x = 18; x <= 27; x++) b.block('dock', x, 0, 27); // the quay
    for (let z = 27; z <= 30; z++) b.block('dock', 31, 0, z); // a pier
    b.path(17, 26, 31, 26);
    for (let i = 0; i < 4; i++) b.house(18 + i * 3, 23, { floors: 1 + (i % 3), w: 2, color: i * 2 + 1 });
    b.put('lighthouse', 33, 25);
  },
  cameras: [
    { name: 'harbour', yaw: 40, pitch: 30, zoom: 3, target: [23, 1, 28.5] },
    { name: 'island', yaw: 45, pitch: 40, zoom: 1.3, target: [24, 0, 24] },
    { name: 'close', yaw: 70, pitch: 24, zoom: 6, target: [22, 1.6, 28.5] },
    { name: 'night', yaw: 40, pitch: 30, zoom: 3, target: [23, 1, 28.5], time: 'night' },
  ],
  expect(_plan, _dressing, check) {
    const calls = check.actors({ type: 'ship-call', rule: 'L38.galleon' });
    check.equal(calls.length, 1, 'one galleon calls');
    const p = calls[0]!.params as { x: number; z: number; cells: number; out: number; dir: number };
    check.equal(p.z, 27, 'its berth is the quay');
    check.ok(p.cells >= 8, `a berth of 8+ cells, got ${p.cells}`);
    check.equal(p.out, 2, 'with the water to the south');
    check.ok(p.dir === 1 || p.dir === -1, 'it lies along the quay, one way or the other');
    check.hasSocket({ type: 'haunt-ship' }, 2);
    // Everything that fits calls, and takes turns: a galley and a cog at the quay too (the pier is too short for any).
    check.equal(check.actors({ type: 'ship-call', rule: 'L40.galley' }).length, 1, 'a galley at the quay');
    check.equal(check.actors({ type: 'ship-call', rule: 'L39.cog' }).length, 1, 'a cog at the quay');
    // And the quay still has its rowboats: no water is kept for a ship that is not there.
    check.hasActor({ type: 'rowboat', rule: 'L17.rowboats' }, 2);
  },
});
