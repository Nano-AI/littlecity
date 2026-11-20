// Fixture for U21 (castle bailey).
//   a ring of curtain wall with a keep and a gatehouse     packed earth, a well, a lean-to stable against
//                                                          the wall, hay, a practice dummy, an archery butt
//   a ring of low walls with nothing else                  a walled garden (U02), not a bailey

import { scenario } from '@/scenario';

export default scenario({
  name: 'U21.castle-bailey',
  seed: 2121,
  about: 'The ground inside a castle (a keep or gatehouse with curtain walls or turrets round it) is a working yard: packed earth, a well, a stable with a horse looking out, hay, a practice dummy and an archery butt.',
  build(b) {
    // Curtain walls x 10..20, z 10..18; the keep in the north-east corner; a gatehouse in the south wall.
    for (let x = 10; x <= 20; x++) b.put('wall', x, 10);
    for (let z = 11; z <= 17; z++) b.put('wall', 10, z).put('wall', 20, z);
    for (let x = 10; x <= 20; x++) if (x < 14 || x > 16) b.put('wall', x, 18);
    b.stack('marble', 14, 18, { floors: 2, color: 2 }).stack('marble', 16, 18, { floors: 2, color: 2 });
    b.path(15, 18, 15, 22).put('arch', 15, 18);
    b.fill('marble', 17, 11, 19, 13, { floors: 3, color: 1 });
    // A walled garden.
    b.fenceAround(26, 12, 29, 15, 'wall');
  },
  cameras: [
    { name: 'bailey', yaw: 30, pitch: 45, zoom: 4.5, target: [15, 1.5, 14] },
    { name: 'stable', yaw: 210, pitch: 32, zoom: 6, target: [14, 1.5, 14] },
    { name: 'all', yaw: 30, pitch: 45, zoom: 2.4, target: [20, 1, 15] },
  ],
  expect(_plan, dressing, check) {
    const rule = 'U21.castle-bailey';
    const xz = (p: (typeof dressing.props)[number]): [number, number] => ('cell' in p.at ? [p.at.cell & 63, (p.at.cell >> 6) & 63] : [-1, -1]);
    const mine = check.props({ rule });
    check.ok(check.props({ rule, type: 'paving' }).length >= 30, 'packed earth across the bailey');
    const well = check.hasProp({ rule, type: 'well' });
    check.ok(dressing.sockets.some((s) => s.owner === well[0]!.id && s.type === 'activity' && s.name === 'fetch-water'), 'people can draw water');
    check.hasProp({ rule, type: 'stable' });
    check.hasProp({ rule, type: 'practice-dummy' });
    check.ok(mine.every((p) => xz(p)[0] >= 11 && xz(p)[0] <= 19), 'only inside the castle');
    check.hasProp({ rule: 'U02.fenced-field', type: 'espalier' });
  },
});
