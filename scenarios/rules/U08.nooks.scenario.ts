// Fixture for U08 (nooks): the odd empty corners a town always fills.
//   a marble terrace on a square with a stair up its side   the corners between stair and terrace hold
//                                                           something each, and never the same thing twice
//   a bridge between two marble blocks                      the ground under its ends is used; the path
//                                                           through the middle arch stays clear
//   a house raised on posts beside a wall                   the space under it is used
//   a stair standing alone on the grass                     nothing: one side is not a nook
//   the foot of every stair                                 always clear

import { scenario } from '@/scenario';

export default scenario({
  name: 'U08.nooks',
  seed: 8808,
  about: 'An empty cell beside a stair or grand steps, or under a deck, shut in on two or more sides, holds crates, barrels, a cat on a crate, a cart, a wall fountain or a kiosk; stair feet, doorways and paths stay clear.',
  build(b) {
    // A terrace on a square, a stair on its east side climbing north, another on its south side.
    b.plaza(8, 9, 17, 16);
    b.fill('marble', 10, 11, 13, 13, { floors: 1 });
    b.block('stairs', 14, 1, 12, { rot: 3 });
    b.block('stairs', 11, 1, 14, { rot: 0 });
    // A bridge between two marble blocks, a path under its middle.
    b.stack('marble', 21, 12, { floors: 2 }).stack('marble', 25, 12, { floors: 2 });
    for (let x = 22; x <= 24; x++) b.block('arch', x, 2, 12);
    b.path(23, 9, 23, 15);
    // A house on posts in the angle of two walls.
    b.stack('marble', 29, 11, { floors: 1 }).stack('marble', 30, 10, { floors: 1 });
    b.block('house', 30, 2, 11, { color: 2 });
    // A stair alone on the grass.
    b.block('stairs', 34, 1, 12, { rot: 1 });
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 36, zoom: 2.7, target: [21, 1, 12] },
    { name: 'all-back', yaw: 225, pitch: 36, zoom: 2.7, target: [21, 1, 12] },
    { name: 'terrace', yaw: 45, pitch: 32, zoom: 6.5, target: [12.5, 1.4, 12.5] },
    { name: 'terrace-nw', yaw: 225, pitch: 32, zoom: 6.5, target: [12.5, 1.4, 12.5] },
    { name: 'terrace-ne', yaw: 315, pitch: 32, zoom: 6.5, target: [12.5, 1.4, 12.5] },
    { name: 'bridge', yaw: 30, pitch: 26, zoom: 7, target: [23, 1.4, 12.5] },
    { name: 'posts', yaw: 60, pitch: 28, zoom: 8, target: [30, 1.4, 11.5] },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'U08.nooks');
    const at = (x: number, z: number): (typeof mine)[number] | undefined => mine.find((p) => 'cell' in p.at && (p.at.cell & 63) === x && ((p.at.cell >> 6) & 63) === z);
    const what = (p: (typeof mine)[number] | undefined): string => (p ? `${p.type}/${p.variant ?? ''}` : 'nothing');
    // Beside the east stair: the two corners between it and the terrace.
    check.ok(at(14, 11) && at(14, 13), `both corners beside the east stair are used (${what(at(14, 11))}, ${what(at(14, 13))})`);
    // Beside the south stair.
    check.ok(at(10, 14) && at(12, 14), 'both corners beside the south stair are used');
    // Neighbouring nooks never hold the same thing.
    for (const p of mine) {
      if (!('cell' in p.at)) continue;
      for (const q of mine) {
        if (p === q || !('cell' in q.at)) continue;
        const near = Math.abs((p.at.cell & 63) - (q.at.cell & 63)) + Math.abs(((p.at.cell >> 6) & 63) - ((q.at.cell >> 6) & 63)) === 1;
        check.ok(!near || what(p) !== what(q), `two ${what(p)} side by side`);
      }
    }
    // Stair feet and heads stay clear.
    check.ok(!at(15, 12) && !at(11, 15) && !at(33, 12), 'the foot of every stair is clear');
    // Under the bridge: the ends, not the path.
    check.ok(at(22, 12) && at(24, 12), 'the ground under the ends of the bridge is used');
    check.ok(!at(23, 12), 'the path under the bridge is clear');
    // Under the house on posts.
    check.ok(at(30, 11), 'the space under the house on posts is used');
    // The lone stair has no nook; nothing out on the open square or the grass.
    check.ok(!at(34, 11) && !at(34, 13) && !at(35, 12), 'a stair alone on the grass has no nook');
    check.ok(!at(9, 10) && !at(16, 15) && !at(20, 20), 'open ground is not a nook');
    check.ok(mine.length <= 12, `restraint: ${mine.length} nooks`);
  },
});
