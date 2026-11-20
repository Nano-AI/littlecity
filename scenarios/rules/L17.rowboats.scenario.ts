// The harbour fixture for the water and the boats: L06 (rings round posts
// and pillars), L17 (moored rowboats) and L19 (sailboats on the sea lane).
// An island with a pier, a quay, a lone jetty block, a pillar in the sea and
// a lighthouse. Every dock a rowboat fits at gets one ("Boats and ships"):
// one per two cells, round the docks in turn; the sea always has sailboats.
//
//   node src/life/testing/sequence.mjs L17.rowboats --frames 12 --every 400 --name moored --zoom 8 --target 18,0,31
//   node src/life/testing/sequence.mjs L17.rowboats --frames 12 --every 5000 --name loop --zoom 1.3 --target 24,0,24

import { key, SEA_Y } from '@/core/grid';
import { computeLane, obstacleDistance } from '@/rules/life/sea-lanes.fact';
import { scenario } from '@/scenario';

export default scenario({
  name: 'L17.rowboats',
  seed: 517,
  about: 'A harbour: rings on the water round posts and pillars (L06), moored rowboats (L17), sailboats looping the island (L19).',
  terrain(t) {
    t.flat(0);
    t.rect(15, 13, 31, 27, 1);
    t.disc(22, 19, 4, 2);
  },
  build(b) {
    for (let z = 28; z <= 33; z++) b.block('dock', 18, 0, z); // the pier
    for (let x = 22; x <= 28; x++) b.block('dock', x, 0, 28); // the quay
    b.block('dock', 32, 0, 22); // a lone jetty: too small for a boat
    b.block('pillar', 13, 0, 30).block('pillar', 13, 1, 30);
    b.stack('lighthouse', 30, 20, { floors: 5 });
    b.path(18, 27, 28, 27);
    for (let i = 0; i < 3; i++) b.house(19 + i * 3, 25, { floors: 1 + (i % 2), w: 2, color: i * 2 });
  },
  cameras: [
    { name: 'harbour', yaw: 45, pitch: 32, zoom: 4.2, target: [22, 0, 29] },
    { name: 'pier', yaw: 135, pitch: 28, zoom: 7.5, target: [18.5, 0, 31] },
    { name: 'island', yaw: 45, pitch: 40, zoom: 1.25, target: [24, 0, 24] },
    { name: 'dusk', yaw: 225, pitch: 30, zoom: 4.2, target: [22, 0, 29], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    // L17: the pier (6 cells), the quay (7) and the lone block each moor boats, one per 2 cells at most, two columns apart.
    const boats = check.actors({ type: 'rowboat', rule: 'L17.rowboats' });
    check.ok(boats.length >= 4 && boats.length <= 8, `4 to 8 moored rowboats, got ${boats.length}`);
    const moorings = new Set(check.sockets({ type: 'mooring' }).map((s) => s.id));
    const used = boats.map((a) => (a.at && 'socket' in a.at ? a.at.socket : ''));
    check.ok(used.every((id) => moorings.has(id)), 'every rowboat is tied to a mooring socket');
    check.equal(new Set(used).size, used.length, 'no two boats on one mooring');
    check.ok(boats.some((a) => a.home === plan.structureAt.get(key(32, 0, 22))), 'a single dock block gets a rowboat too');
    for (const a of boats) check.ok(typeof (a.params as { rank?: number }).rank === 'number', 'each knows its rank (a phone shows fewer)');
    // L19: two always (no lighthouse needed), one more per 14 dock cells: 14 here.
    const sail = check.actors({ type: 'sailboat', rule: 'L19.sailboats' });
    check.equal(sail.length, 3, 'two sailboats, and one more for fourteen dock cells');
    check.ok(sail.every((a) => a.at === null), 'sailboats roam free');
    const lane = computeLane(plan.terrain, plan.kinds);
    check.ok(lane.points.length >= 16, 'the island has a sea lane');
    for (const [x, z] of lane.points) check.ok(obstacleDistance(plan.terrain, plan.kinds, x, z) >= 3, `the lane keeps 3 columns from land and docks at (${x.toFixed(1)}, ${z.toFixed(1)})`);
    // L06: rings where things stand in the sea.
    const rings = check.actors({ type: 'water-ring', rule: 'L06.water-rings' });
    check.ok(rings.length >= 6, `rings round the dock posts and the pillar, got ${rings.length}`);
    check.hasActor({ type: 'water-ring', variant: 'pillar' });
    check.ok(SEA_Y > 0 && dressing.actors.length > 0, 'there is life on the water');
  },
});
