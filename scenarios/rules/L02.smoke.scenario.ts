// L02 and L03 together, on a windy rise: a row of cottages with their
// chimneys smoking, two windmills (one tall) and two towers whose tips carry
// weathervanes. Watch a gust cross it:
//
//   node src/life/testing/sequence.mjs L02.smoke --frames 12 --every 500 --name gust

import { scenario } from '@/scenario';

export default scenario({
  name: 'L02.smoke',
  seed: 12,
  about: 'Chimney smoke leaning with the wind, windmill sails and weathervanes: L02 and L03.',
  build(b) {
    for (let i = 0; i < 5; i++) b.house(14 + i * 3, 20, { floors: 1 + (i % 2), w: 2, color: i });
    b.path(13, 22, 29, 22);
    b.put('windmill', 16, 25);
    b.stack('windmill', 22, 25, { floors: 3 });
    b.tower(27, 25, { floors: 3 });
    b.tower(12, 25, { floors: 4 });
    b.put('tree', 19, 25).put('tree', 25, 26);
  },
  cameras: [
    { name: 'street', yaw: 45, pitch: 30, zoom: 4.2, target: [21, 2, 22.5] },
    { name: 'back', yaw: 215, pitch: 34, zoom: 4.2, target: [21, 2, 22.5] },
    { name: 'dusk', yaw: 45, pitch: 30, zoom: 4.2, target: [21, 2, 22.5], time: 'dusk' },
  ],
  expect(plan, dressing, check) {
    const chimneys = check.sockets({ type: 'chimney-top' }).length;
    check.ok(chimneys >= 4, `the cottages have chimneys, got ${chimneys}`);
    check.equal(check.actors({ type: 'smoke', rule: 'L02.smoke' }).length, chimneys, 'one plume per chimney');
    for (const a of check.actors({ type: 'smoke' })) check.ok(a.at !== null && 'socket' in a.at && a.at.socket.endsWith('/chimney-top'), 'smoke sits on its chimney');
    check.equal(check.actors({ type: 'windmill-sails', rule: 'L03.sails' }).length, 2, 'one wheel per mill');
    const sizes = check.actors({ type: 'windmill-sails' }).map((a) => Number((a.params as { size?: number } | undefined)?.size)).sort();
    check.ok(sizes[1]! > sizes[0]!, 'a taller mill carries longer sails');
    const tips = check.sockets({ type: 'tower-top' }).length;
    const vanes = check.actors({ type: 'weathervane' }).length;
    check.ok(vanes <= tips, 'never more vanes than tips');
    check.equal(dressing.actors.filter((a) => a.type === 'weathervane' && plan.features.some((f) => f.type === 'finial' && a.at && 'socket' in a.at && a.at.socket.includes(`@${f.cell}`))).length, 0, 'no vane on a cap that carries a cross');
  },
});
