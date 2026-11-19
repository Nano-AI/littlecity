// J19: railings on walkable edges with a drop of two levels or more, beside
// a floor or a stair head. A plaza on a marble block two high (balustrade);
// an L-shaped path on a terrace (pickets, with an inner corner); a roof
// garden (iron); a bridge deck (rope); a low platform (no railing: the drop
// is one); a platform whose player-built wall replaces the railing on one
// side; and a stair head with no floor at all.

import { scenario } from '@/scenario';

export default scenario({
  name: 'J19.edge-railing',
  seed: 14,
  about: 'Edge railings in the four styles, at outer and inner corners, skipped at low drops and where the player built an edge piece.',
  terrain(t) {
    t.flat(1);
    t.rect(8, 14, 11, 17, 3);
    t.rect(10, 16, 11, 17, 1); // bite a corner out of the terrace: an inner corner
  },
  build(b) {
    // Marble, two high, with a plaza: a balustrade all round.
    b.fill('marble', 15, 14, 16, 15, { floors: 2 });
    b.plaza(15, 14, 16, 15);
    // The terrace: an L of path.
    b.path(8, 14, 11, 15);
    b.path(8, 16, 9, 17);
    // A roof garden.
    b.house(20, 14, { w: 2, d: 2, floors: 2, color: 3 });
    b.garden(20, 14, 21, 15);
    // A bridge between two marble blocks, with a path over it.
    b.fill('marble', 25, 14, 25, 14, { floors: 2 });
    b.fill('marble', 29, 14, 29, 14, { floors: 2 });
    for (let x = 26; x <= 28; x++) b.stack('arch', x, 14, { floors: 2 });
    b.path(25, 14, 29, 14);
    // One level up: no railing.
    b.fill('marble', 15, 20, 16, 21, { floors: 1 });
    b.plaza(15, 20, 16, 21);
    // Two levels up with a wall the player built along the south side.
    b.fill('marble', 20, 20, 21, 21, { floors: 2 });
    b.plaza(20, 20, 21, 21);
    b.wallEdge(20, 21, 'S').wallEdge(21, 21, 'S');
    // A stair head with no floor: stairs up a marble spine to a bare top.
    for (let i = 1; i <= 2; i++) b.stack('marble', 26, 23 - i, { floors: i });
    for (let i = 0; i < 2; i++) b.block('stairs', 26, 1 + i, 23 - i, { rot: 0 });
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 3.1, target: [19, 2, 18] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 3.1, target: [19, 2, 18] },
    { name: 'terrace', yaw: 45, pitch: 36, zoom: 6, target: [10, 3, 16] },
  ],
  expect(plan, _dressing, check) {
    const rail = (x: number, y: number, z: number, dir: number) => check.features({ type: 'railing', at: [x, y, z], dir })[0];
    const ends = (x: number, y: number, z: number, dir: number): string => {
      const p = rail(x, y, z, dir)?.params as { from?: number; to?: number } | undefined;
      return `${p?.from}/${p?.to}`;
    };
    // Marble plaza: eight railings, balustrade, one post per corner and per joint.
    check.equal(check.features({ type: 'railing', on: [15, 3, 14], variant: 'balustrade' }).length, 8, 'railings round the marble plaza');
    check.equal(ends(15, 3, 14, 0), '0/2', 'north side, west cell: runs on from its neighbour into the corner post');
    check.equal(ends(15, 3, 14, 3), '3/6', 'west side, north cell: the corner post belongs to the north side');
    check.equal(ends(16, 3, 14, 0), '3/6', 'north side, east cell: its east end is the east side’s corner');
    // The terrace: pickets, and an inner corner where the L turns.
    check.hasFeature({ type: 'railing', variant: 'picket', at: [8, 3, 14], dir: 0 });
    check.equal(ends(9, 3, 16, 1), '0/4', 'east side of the L’s leg: an inner corner with the post');
    check.equal(ends(10, 3, 15, 2), '5/6', 'south side of the L’s arm: the inner corner, no post');
    // Styles.
    check.hasFeature({ type: 'railing', variant: 'iron', at: [20, 3, 14] });
    check.hasFeature({ type: 'railing', variant: 'rope', at: [27, 3, 14], dir: 0 });
    check.hasFeature({ type: 'railing', variant: 'rope', at: [27, 3, 14], dir: 2 });
    check.noFeature({ type: 'railing', at: [27, 3, 14], dir: 1 }); // the deck carries on
    // A drop of one: nothing.
    check.noFeature({ type: 'railing', at: [15, 2, 20] });
    // The player's wall stands in for the railing on that side only.
    check.noFeature({ type: 'railing', at: [20, 3, 21], dir: 2 });
    check.hasFeature({ type: 'railing', at: [20, 3, 21], dir: 3 });
    check.hasFeature({ type: 'railing', at: [20, 3, 20], dir: 0 });
    // A stair head: railed on three sides, open where the stairs arrive, drawn by the stairs.
    check.equal(check.features({ type: 'railing', at: [26, 3, 21] }).length, 3, 'railings round the stair head');
    check.noFeature({ type: 'railing', at: [26, 3, 21], dir: 2 });
    check.equal(rail(26, 3, 21, 0)?.structure, check.structure(26, 1, 23).id, 'the stair head’s railings belong to the stairs');
  },
});
