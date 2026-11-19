// R-E02: a wall takes its style from what it touches. A low wall on open
// ground; curtain walls between towers and running out from marble; low
// stone walls round gardens, about four in ten of them with creepers.

import { edgeKey } from '@/core/grid';
import { scenario } from '@/scenario';

/** The six little walled gardens: [x, z] of each north-west corner. */
const GARDENS = [[8, 26], [12, 26], [16, 26], [20, 26], [24, 26], [28, 26]] as const;

export default scenario({
  name: 'R-E02.wall-style',
  seed: 12,
  about: 'Wall style: the plain low wall, crenellated curtain walls touching towers and marble, garden walls with and without creepers.',
  build(b) {
    // The plain low wall: a run with a corner, cell pieces; and a few edge pieces.
    for (let x = 8; x <= 12; x++) b.put('wall', x, 16);
    b.put('wall', 12, 17).put('wall', 12, 18);
    for (let x = 8; x <= 10; x++) b.wallEdge(x, 20, 'S');
    // Curtain walls: between two towers, and round a yard beside a marble keep.
    b.tower(16, 16, { floors: 3 }).tower(22, 16, { floors: 3 });
    for (let x = 17; x <= 21; x++) b.put('wall', x, 16);
    b.fill('marble', 26, 14, 27, 15, { floors: 2 });
    for (let z = 16; z <= 18; z++) b.wallEdge(26, z, 'W').wallEdge(27, z, 'E');
    b.wallEdge(26, 18, 'S').wallEdge(27, 18, 'S');
    // Garden walls.
    for (const [x, z] of GARDENS) {
      b.garden(x, z, x + 1, z + 1);
      b.fenceAround(x, z, x + 1, z + 1, 'wall');
    }
    // A cell piece beside a garden is a garden wall too.
    b.garden(33, 20, 34, 21);
    for (let z = 20; z <= 21; z++) b.put('wall', 35, z);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 34, zoom: 2.9, target: [20, 1, 21] },
    { name: 'back', yaw: 225, pitch: 34, zoom: 2.9, target: [20, 1, 21] },
    { name: 'gardens', yaw: 45, pitch: 38, zoom: 4.4, target: [19, 1, 27] },
  ],
  expect(plan, _dressing, check) {
    const runAt = (x: number, z: number, side: 'E' | 'S'): number => plan.edgeAt.get(edgeKey(x, 1, z, side)) ?? -1;
    check.role(8, 1, 16, 'low-wall');
    check.equal(plan.roles.get(runAt(9, 20, 'S'))?.role, 'low-wall', 'edge pieces on open ground');
    check.role(19, 1, 16, 'curtain-wall');
    check.equal(plan.roles.get(runAt(27, 17, 'E'))?.role, 'curtain-wall', 'edge pieces running out from marble');
    check.role(35, 1, 20, 'garden-wall');
    let withCreepers = 0;
    for (const [x, z] of GARDENS) {
      const id = runAt(x, z + 1, 'S');
      check.equal(plan.roles.get(id)?.role, 'garden-wall', `the wall round the garden at ${x}, ${z}`);
      if (plan.tags.get(id)?.has('creepers')) withCreepers++;
    }
    check.ok(withCreepers >= 1 && withCreepers < GARDENS.length, `some garden walls carry creepers and some do not (${withCreepers} of ${GARDENS.length})`);
    check.ok(!plan.tags.get(check.structure(8, 1, 16).id)?.has('creepers'), 'only garden walls carry creepers');
  },
});
