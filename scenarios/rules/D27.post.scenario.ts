// Fixture for D27 (post):
//   a street of fifteen cells with houses opening onto it    a red pillar box near its middle; mailboxes
//                                                            by some of the doors
//   a street of six cells                                    no pillar box: too short

import { scenario } from '@/scenario';

export default scenario({
  name: 'D27.post',
  seed: 2727,
  about: 'Every street of ten cells or more gets one red pillar box near its middle; some houses opening straight onto a street get a mailbox by the door.',
  build(b) {
    b.path(8, 12, 22, 12);
    for (let x = 8; x <= 22; x += 2) b.house(x, 11, { color: x % 8 });
    for (let x = 9; x <= 21; x += 3) b.house(x, 13, { color: (x + 3) % 8 });
    b.path(8, 22, 13, 22);
    b.house(9, 21, { color: 2 }).house(12, 23, { color: 5 });
  },
  cameras: [
    { name: 'street', yaw: 20, pitch: 30, zoom: 4, target: [15, 1, 12] },
    { name: 'close', yaw: 30, pitch: 24, zoom: 8, target: [15, 1.2, 12] },
    { name: 'short', yaw: 20, pitch: 30, zoom: 5, target: [10.5, 1, 22] },
  ],
  expect(_plan, dressing, check) {
    const boxes = dressing.props.filter((p) => p.type === 'postbox');
    check.equal(boxes.length, 1, 'one pillar box: on the long street only');
    const at = boxes[0]?.at;
    check.ok(!!at && 'cell' in at && ((at.cell >> 6) & 63) === 12 && Math.abs((at.cell & 63) - 15) <= 3, 'near the middle of the long street');
    const mail = dressing.props.filter((p) => p.type === 'mailbox');
    check.ok(mail.length >= 1 && mail.length <= 7, `some mailboxes (${mail.length})`);
    for (const p of [...boxes, ...mail]) check.ok('cell' in p.at && p.at.pos.length === 2, 'on a corner, off the walking line');
  },
});
