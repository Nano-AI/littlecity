// R-E01: a fence takes its style from what it stands on. Left to right:
// pickets on the ground, an iron railing on a roof, a stone balustrade on
// marble, rope and post on a bridge deck; and rope and post on a dock.

import { edgeKey } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'R-E01.fence-style',
  seed: 5,
  about: 'Fence style by what the run stands on: picket, iron on a roof, balustrade on marble, rope on a bridge and on a dock.',
  terrain(t) {
    t.flat(1);
    t.water(4, 30, 43, 43);
  },
  build(b) {
    // On the ground: white pickets, as cell pieces and as edge pieces.
    for (let x = 10; x <= 13; x++) b.put('fence', x, 20);
    b.put('fence', 13, 21).put('fence', 13, 22);
    b.garden(10, 24, 12, 25);
    b.fenceAround(10, 24, 12, 25);
    // On a house roof: iron.
    b.house(16, 20, { w: 3, d: 2, color: 4 });
    b.fenceAround(16, 20, 18, 21);
    // On marble: a balustrade, edge pieces and a cell piece.
    b.fill('marble', 21, 20, 23, 21);
    b.fenceAround(21, 20, 23, 21);
    b.put('marble', 22, 24).put('fence', 22, 24);
    // On a bridge deck: rope and post.
    for (let x = 26; x <= 29; x++) b.put('arch', x, 21);
    for (let x = 26; x <= 29; x++) b.fenceEdge(x, 21, 'N').fenceEdge(x, 21, 'S');
    // On a dock: rope and post.
    for (let z = 30; z <= 33; z++) b.block('dock', 20, 0, z);
    for (let z = 30; z <= 33; z++) b.fenceEdge(20, z, 'W').fenceEdge(20, z, 'E');
    b.fenceEdge(20, 33, 'S');
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 3.2, target: [20, 1, 24] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 3.2, target: [20, 1, 24] },
  ],
  expect(plan, _dressing, check) {
    const roleAt = (x: number, y: number, z: number, side: 'E' | 'S'): string | undefined => {
      const id = plan.edgeAt.get(edgeKey(x, y, z, side));
      return id === undefined ? undefined : plan.roles.get(id)?.role;
    };
    check.role(10, 1, 20, 'picket-fence');
    check.sameStructure([10, 1, 20], [13, 1, 22]);
    check.equal(roleAt(10, 1, 25, 'S'), 'picket-fence', 'edge pieces on the ground');
    check.equal(roleAt(16, 2, 21, 'S'), 'iron-railing', 'on a roof');
    check.equal(roleAt(21, 2, 21, 'S'), 'stone-balustrade', 'edge pieces on marble');
    check.role(22, 2, 24, 'stone-balustrade');
    check.equal(roleAt(27, 2, 21, 'S'), 'rope-fence', 'on a bridge deck');
    check.equal(roleAt(20, 1, 31, 'E'), 'rope-fence', 'on a dock');
    const fences = [...plan.structures.values()].filter((s) => s.kind === 'fence');
    check.equal(check.applied('R-E01.fence-style'), fences.length, 'every fence run has a style');
  },
});
