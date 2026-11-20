// A big harbour ("Boats and ships": more dock, more big ships, at the same
// time). An island with long quays on three sides, a pier, and a river with
// docks up from its mouth. The north quay is long enough for two galleons end
// to end; in all there is room for six or more big ships, and they fill the
// berths together, coming and going at a staggered rhythm, with rowboats
// along the rest of the quays and the barge on the river.
//
//   node src/life/testing/sequence.mjs ships-harbour --warm 0 --frames 16 --every 15000 --name four-min --zoom 1.15 --target 24,0,24
//   node src/life/testing/sequence.mjs ships-harbour --warm 0 --frames 16 --every 15000 --name low --zoom 1.6 --target 24,0,24 --pitch 14 --yaw 20

import { scenario } from '@/scenario';

/** The docks, as [x0, z0, x1, z1] runs (every cell of each is a dock at sea level). */
export const HARBOUR_DOCKS: readonly (readonly [number, number, number, number])[] = [
  [13, 11, 30, 11], // the north quay: eighteen, two galleons and a cog
  [37, 14, 37, 22], // the east quay: nine
  [12, 37, 19, 37], // south-west quay: eight
  [27, 37, 34, 37], // south-east quay: eight
  [37, 27, 41, 27], // a pier out from the east shore
  [21, 26, 21, 30], // up the river, on its west bank
  [25, 18, 25, 21], // further up, on its east bank
];

export default scenario({
  name: 'ships-harbour',
  seed: 4400,
  about: 'A big harbour with room for six or more big ships at once, a pier and a river: ships come and go together.',
  terrain(t) {
    t.flat(0);
    t.rect(12, 12, 36, 36, 1);
    // A river from the middle of the island out to the south shore.
    t.water(21, 16, 25, 36);
  },
  build(b) {
    for (const [x0, z0, x1, z1] of HARBOUR_DOCKS) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) b.block('dock', x, 0, z);
    b.path(14, 13, 30, 13).path(33, 14, 33, 22).path(13, 35, 20, 35).path(26, 35, 34, 35);
    for (let i = 0; i < 4; i++) b.house(15 + i * 4, 15, { w: 2, floors: 1 + (i % 3), color: i * 2 });
    for (let i = 0; i < 3; i++) b.house(30, 16 + i * 3, { w: 2, floors: 2, color: i + 3 });
    b.put('lighthouse', 35, 35);
  },
  cameras: [
    { name: 'harbour', yaw: 45, pitch: 36, zoom: 1.2, target: [24, 0, 24] },
    { name: 'north', yaw: 20, pitch: 28, zoom: 2.6, target: [22, 1, 9] },
    { name: 'low', yaw: 20, pitch: 12, zoom: 1.6, target: [24, 0.5, 24] },
  ],
  expect(_plan, dressing, check) {
    const calls = check.actors({ type: 'ship-call' }).filter((a) => a.variant !== 'passing' && a.variant !== 'barge');
    const berths = new Set(calls.map((a) => `${(a.params as { x: number }).x},${(a.params as { z: number }).z}`));
    check.ok(berths.size >= 6, `room for six or more big ships, got ${berths.size} berths`);
    const north = [...berths].filter((k) => k.endsWith(',11'));
    check.ok(north.length >= 2, 'the long north quay holds more than one ship');
    check.ok(dressing.actors.some((a) => a.type === 'ship-call' && a.variant === 'barge'), 'the barge on the river');
  },
});
