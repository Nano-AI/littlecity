// Gallery: fences, walls, gates, railings and stairs, each where the real
// rules give it its style (R-E01, R-E02, J18, J19, J20).
//
//   north row    fences as cell runs: a picket run from a house wall with a
//                gate on a path, a corner and a tee; iron on a house roof;
//                a balustrade on marble
//   second row   fences and walls as edge runs: pickets round a garden with
//                a gate; a low wall with an arched opening; a garden wall
//                with creepers; a curtain wall between two towers with a
//                gateway
//   third row    edge railings (J19): pickets on a terrace, a balustrade on
//                marble, iron on a roof garden, rope on a bridge deck
//   south row    stairs: single, wide, a long flight with a landing and
//                handrails, a flight against a wall
//   the water    rope and post along a dock

import { edgeKey } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

/** Every garden wall here carries creepers (the real rule gives them to four in ten). */
const creepersEverywhere = defineRule({
  id: 'X-EDGES.creepers',
  part: 'joinery',
  tier: 1,
  priority: 1,
  find({ plan }) {
    return [...plan.roles].filter(([, r]) => r.role === 'garden-wall').map(([id]) => ({ anchor: 0, key: id, structure: id }));
  },
  apply(c, out) {
    out.tag(c.structure!, 'creepers');
  },
});

export default scenario({
  name: 'ground-edges',
  seed: 41,
  about: 'Every fence and wall style as cell runs and edge runs, gates and arched openings, the four edge railings, and stairs single, wide, long and against a wall.',
  rules: [creepersEverywhere],
  terrain(t) {
    t.flat(1);
    t.water(4, 36, 43, 43);
    t.rect(8, 22, 12, 25, 3); // a terrace two levels up
    t.rect(8, 26, 12, 26, 2); // and a step below it
  },
  build(b) {
    // ── fences as cell pieces ──
    b.house(7, 10, { color: 2 });
    for (let x = 8; x <= 13; x++) b.put('fence', x, 10);
    b.put('fence', 13, 11).put('fence', 13, 12).put('fence', 12, 12).put('fence', 14, 12); // a corner, then a tee
    b.path(10, 8, 10, 13); // crosses the run: a gate
    b.put('fence', 9, 13); // a lone piece
    // Iron on a roof.
    b.house(17, 9, { w: 3, d: 3, color: 4 });
    b.fenceAround(17, 9, 19, 11);
    // A balustrade on marble.
    b.fill('marble', 23, 9, 25, 11);
    b.fenceAround(23, 9, 25, 11);
    for (let x = 28; x <= 31; x++) b.put('marble', x, 10);
    for (let x = 28; x <= 31; x++) b.put('fence', x, 10);

    // ── edge runs ──
    b.garden(8, 16, 11, 18);
    b.path(11, 17, 14, 17);
    b.fenceAround(8, 16, 11, 18); // the edge between the two path cells is a gate
    // A low wall of cell pieces with an arched opening, a corner, and an end against a house.
    b.house(15, 16, { color: 6 });
    for (let x = 16; x <= 20; x++) b.put('wall', x, 16);
    b.put('wall', 20, 17).put('wall', 20, 18);
    b.path(18, 14, 18, 18);
    // A garden wall of edge pieces, with a gate.
    b.garden(23, 16, 26, 18);
    b.path(26, 17, 28, 17);
    b.fenceAround(23, 16, 26, 18, 'wall');
    // A curtain wall between two towers, with a gateway.
    b.tower(30, 16, { floors: 2 }).tower(36, 16, { floors: 2 });
    for (let x = 31; x <= 35; x++) b.put('wall', x, 16);
    b.path(33, 14, 33, 18);
    // A curtain wall of edge pieces running out from a marble block, with a corner.
    b.fill('marble', 38, 13, 38, 13, { floors: 1 });
    for (let z = 14; z <= 16; z++) b.wallEdge(38, z, 'W');
    b.wallEdge(38, 16, 'S').wallEdge(39, 16, 'S');

    // ── edge railings ──
    b.plaza(8, 22, 12, 25); // on the terrace: pickets
    b.fill('marble', 15, 22, 17, 24, { floors: 2 });
    b.plaza(15, 22, 17, 24); // on marble: a balustrade
    b.house(20, 22, { w: 3, d: 2, floors: 2, color: 1 });
    b.garden(20, 22, 22, 23); // a roof garden: iron
    for (let x = 25; x <= 29; x++) b.stack('arch', x, 23, { floors: 2 });
    b.path(25, 23, 29, 23); // a bridge deck: rope

    // ── stairs ──
    b.put('marble', 8, 30);
    b.block('stairs', 8, 1, 31, { rot: 0 }); // single
    b.fill('marble', 11, 30, 13, 30);
    for (let x = 11; x <= 13; x++) b.block('stairs', x, 1, 31, { rot: 0 }); // wide
    // A long flight: five cells up a stepped marble spine, one cell wide.
    for (let i = 1; i <= 5; i++) b.stack('marble', 17, 33 - i, { floors: i });
    for (let i = 0; i < 5; i++) b.block('stairs', 17, 1 + i, 33 - i, { rot: 0 });
    b.plaza(17, 28);
    // Two cells wide against a wall, climbing east.
    b.fill('marble', 23, 28, 24, 28, { floors: 2 });
    b.fill('marble', 24, 29, 24, 30, { floors: 1 });
    for (const z of [29, 30]) b.block('stairs', 23, 1, z, { rot: 1 });
    b.fill('marble', 25, 29, 25, 30, { floors: 2 });
    for (const z of [29, 30]) b.block('stairs', 24, 2, z, { rot: 1 });
    // Up a terrace, on plain ground.
    for (const x of [10, 11]) b.block('stairs', x, 1, 27, { rot: 0 }).block('stairs', x, 2, 26, { rot: 0 });

    // ── a dock with rope and post ──
    for (let x = 28; x <= 33; x++) for (const z of [36, 37]) b.block('dock', x, 0, z);
    for (let x = 28; x <= 33; x++) b.fenceEdge(x, 37, 'S');
    b.fenceEdge(33, 37, 'E').fenceEdge(33, 36, 'E');
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 36, zoom: 1.75, target: [23, 1, 23] },
    { name: 'back', yaw: 225, pitch: 36, zoom: 1.75, target: [23, 1, 23] },
    { name: 'pickets', yaw: 45, pitch: 34, zoom: 5.5, target: [11, 1, 11.5] },
    { name: 'pickets-nw', yaw: 225, pitch: 34, zoom: 5.5, target: [11, 1, 11.5] },
    { name: 'roofs', yaw: 45, pitch: 34, zoom: 4.6, target: [24, 2, 10.5] },
    { name: 'garden', yaw: 135, pitch: 34, zoom: 5, target: [10.5, 1, 17] },
    { name: 'walls', yaw: 45, pitch: 34, zoom: 4, target: [22, 1, 17] },
    { name: 'walls-ne', yaw: 315, pitch: 34, zoom: 4, target: [22, 1, 17] },
    { name: 'curtain', yaw: 45, pitch: 32, zoom: 4.2, target: [35, 1, 16] },
    { name: 'curtain-sw', yaw: 135, pitch: 32, zoom: 4.2, target: [35, 1, 16] },
    { name: 'railings', yaw: 45, pitch: 36, zoom: 3.2, target: [18.5, 2, 23.5] },
    { name: 'railings-nw', yaw: 225, pitch: 36, zoom: 3.2, target: [18.5, 2, 23.5] },
    { name: 'stairs', yaw: 45, pitch: 34, zoom: 3.6, target: [17, 2, 30.5] },
    { name: 'stairs-sw', yaw: 135, pitch: 34, zoom: 3.6, target: [17, 2, 30.5] },
    { name: 'stairs-ne', yaw: 315, pitch: 34, zoom: 3.6, target: [17, 2, 30.5] },
    { name: 'dock', yaw: 45, pitch: 32, zoom: 5, target: [30.5, 1, 36.5] },
  ],
  expect(plan, _dressing, check) {
    const edgeRole = (x: number, y: number, z: number, side: 'E' | 'S'): string | undefined => {
      const id = plan.edgeAt.get(edgeKey(x, y, z, side));
      return id === undefined ? undefined : plan.roles.get(id)?.role;
    };
    check.role(9, 1, 10, 'picket-fence');
    check.equal(edgeRole(17, 2, 11, 'S'), 'iron-railing', 'fence on a roof');
    check.equal(edgeRole(23, 2, 11, 'S'), 'stone-balustrade', 'fence on marble');
    check.role(29, 2, 10, 'stone-balustrade');
    check.equal(edgeRole(30, 1, 37, 'S'), 'rope-fence', 'fence on a dock');
    check.role(17, 1, 16, 'low-wall');
    check.equal(edgeRole(24, 1, 18, 'S'), 'garden-wall', 'wall round a garden');
    check.role(33, 1, 16, 'curtain-wall');
    check.equal(edgeRole(37, 1, 15, 'E'), 'curtain-wall', 'wall running out from marble');
    check.hasFeature({ type: 'gate', variant: 'picket', at: [10, 1, 10] });
    check.hasFeature({ type: 'gate', variant: 'arched', at: [18, 1, 16] });
    check.hasFeature({ type: 'gate', variant: 'arched', at: [33, 1, 16] });
    check.equal(check.features({ type: 'gate' }).filter((f) => f.edge !== undefined).length, 2, 'gates in edge runs');
    check.hasFeature({ type: 'railing', variant: 'picket', at: [8, 3, 22] });
    check.hasFeature({ type: 'railing', variant: 'balustrade', at: [15, 3, 22] });
    check.hasFeature({ type: 'railing', variant: 'iron', at: [20, 3, 22] });
    check.hasFeature({ type: 'railing', variant: 'rope', at: [27, 3, 23] });
    check.hasFeature({ type: 'stair-landing', at: [17, 4, 30] });
    check.hasFeature({ type: 'railing', at: [17, 3, 31], dir: 1 });
    check.noFeature({ type: 'railing', at: [8, 1, 31] });
    check.sameStructure([23, 1, 29], [24, 2, 30]);
  },
});
