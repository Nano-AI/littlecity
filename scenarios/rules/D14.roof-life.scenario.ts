// Fixture for D14 and D14-T (roof life). A village of fourteen houses round
// a street, one of them a tall house in the middle:
//   the tallest chimney in a town of 12+ houses     a stork's nest on it, and no smoke from it
//   a few houses                                    a birdhouse under the eaves
//   a town of fewer than twelve houses (the test)   no stork (see the expect in the town-wide test)

import { scenario } from '@/scenario';

export default scenario({
  name: 'D14.roof-life',
  seed: 1414,
  about: 'Once a town has twelve houses, a stork nests on its tallest chimney (which then does not smoke); one house in ten has a birdhouse under its eaves.',
  build(b) {
    b.path(6, 12, 30, 12);
    for (let i = 0; i < 7; i++) b.house(6 + i * 4, 10, { w: 2, floors: 1 + (i % 2), color: i });
    for (let i = 0; i < 6; i++) b.house(7 + i * 4, 14, { w: 2, floors: 1 + ((i + 1) % 2), color: (i + 3) % 8 });
    b.house(18, 6, { w: 2, d: 2, floors: 4, color: 4 });
  },
  cameras: [
    { name: 'stork', yaw: 30, pitch: 22, zoom: 9, target: [19, 3.6, 7] },
    { name: 'village', yaw: 20, pitch: 30, zoom: 2.8, target: [18, 1.5, 11] },
    { name: 'village-back', yaw: 200, pitch: 30, zoom: 2.8, target: [18, 1.5, 11] },
  ],
  expect(plan, dressing, check) {
    const nests = dressing.props.filter((p) => p.type === 'stork-nest');
    check.equal(nests.length, 1, 'one stork nest');
    const at = nests[0]?.at;
    const socket = at && 'socket' in at ? plan.sockets.find((s) => s.id === at.socket) : undefined;
    check.equal(socket?.structure, check.structure(18, 1, 6).id, 'the nest is on the tall house');
    check.ok(!dressing.actors.some((a) => a.type === 'smoke' && 'socket' in (a.at ?? {}) && (a.at as { socket: string }).socket === socket?.id), 'the nest chimney does not smoke');
    check.ok(dressing.actors.some((a) => a.type === 'smoke'), 'the other chimneys do');
    const boxes = dressing.props.filter((p) => p.type === 'birdhouse');
    check.ok(boxes.length >= 1 && boxes.length <= 4, `a birdhouse or a few (${boxes.length})`);
  },
});
