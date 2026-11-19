// L36: a castle on open ground, a keep inside curtain walls with four
// turrets and a gatehouse, grass all round: a troop of six marches in step
// round the outside of the walls and halts at the gate each lap. A second,
// small walled castle (no keep) has a troop of four. A lone tower is not a
// castle and has no troop.
//
//   node src/life/testing/sequence.mjs L36.garrison --zoom 8 --aim '(s => [s.x, s.y, s.z])(window.__lcGarrison.list[0].troop.soldiers[2])' --follow --frames 8 --every 500 --name march

import { scenario } from '@/scenario';

export default scenario({
  name: 'L36.garrison',
  seed: 360,
  about: 'A garrison marches round each castle (L36): six for a keep with walls, four for a walled castle with no keep; none for a lone tower.',
  build(b) {
    // The big castle.
    b.fill('marble', 14, 14, 16, 16, { floors: 4 });
    for (const [x, z] of [[11, 11], [19, 11], [11, 19], [19, 19]] as const) b.tower(x, z, { floors: 3, color: 2 });
    for (let x = 12; x <= 18; x++) b.put('wall', x, 11);
    for (let z = 12; z <= 18; z++) b.put('wall', 11, z).put('wall', 19, z);
    for (let x = 12; x <= 13; x++) b.put('wall', x, 19);
    for (let x = 17; x <= 18; x++) b.put('wall', x, 19);
    b.stack('marble', 14, 19, { floors: 2, color: 3 }).stack('marble', 16, 19, { floors: 2, color: 3 });
    b.put('arch', 15, 19);
    b.path(15, 20, 15, 26);
    b.plaza(13, 27, 17, 29);
    // The small castle: walls and two turrets, no keep.
    for (const [x, z] of [[30, 12], [36, 12]] as const) b.tower(x, z, { floors: 3, color: 4 });
    for (let x = 31; x <= 35; x++) b.put('wall', x, 12).put('wall', x, 17);
    for (let z = 13; z <= 16; z++) b.put('wall', 30, z).put('wall', 36, z);
    b.put('wall', 30, 17).put('wall', 36, 17);
    // A lone tower.
    b.tower(32, 30, { floors: 3 });
  },
  cameras: [
    { name: 'castle', yaw: 45, pitch: 35, zoom: 3.5, target: [15, 1, 17] },
    { name: 'small', yaw: 45, pitch: 35, zoom: 4, target: [33, 1, 14] },
  ],
  expect(_plan, _dressing, check) {
    const troops = check.actors({ type: 'garrison', rule: 'L36.garrison' });
    check.equal(troops.length, 2, 'a troop for each castle, none for the lone tower');
    check.equal(troops.map((t) => Number((t.params as { size?: number }).size)).sort().join(','), '4,6', 'six for the keep with walls, four for the walled castle');
    check.equal(check.sockets({ type: 'workplace' }).filter((s) => (s.name ?? '').startsWith('guard')).length, 0, 'no lone guard on a garrisoned keep');
  },
});
