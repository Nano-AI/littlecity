// Gallery: every ground piece on one sheet, each standing where the real
// rules give it its variant. (The closer studies are ground-trees,
// ground-floors, ground-edges, ground-props and ground-docks.)
//
//   row 1   trees: the seeded mix, a grove, pines on the hill
//   row 2   planter trees on a plaza, fruit trees on a garden, a path, a
//           5 × 5 square with the tiered fountain, a well in a walled court
//   row 3   gardens: flower, kitchen, wheat, herb (walled), park; a basin;
//           market stalls and a flower stall
//   row 4   fences and walls: picket with a gate, iron on a roof terrace,
//           balustrade on marble with a stair, low wall, curtain wall
//   shore   palms, a pier with a rope fence, a jetty, a fish stall, a reed
//           bed, willows

import type { Role } from '@/core/vocab';
import { scenario } from '@/scenario';

const WANTED: readonly Role[] = [
  'palm', 'willow', 'pine', 'planter-tree', 'fruit-tree', 'grove-tree', 'round-tree', 'cypress', 'bush',
  'tiered-fountain', 'well', 'birdbath', 'basin',
  'fish-stall', 'flower-stall', 'market-stall',
  'wheat-field', 'herb-garden', 'reed-bed', 'park-lawn', 'kitchen-garden', 'flower-garden',
  'picket-fence', 'rope-fence', 'iron-railing', 'stone-balustrade',
  'low-wall', 'garden-wall', 'curtain-wall',
  'pier', 'jetty',
];

export default scenario({
  name: 'ground-gallery',
  seed: 53,
  about: 'Every ground piece side by side: nine tree species, four fence and three wall styles, paths, plazas and six gardens, four fountains, three stalls, a pier and a jetty.',
  terrain(t) {
    t.flat(1);
    t.water(4, 32, 43, 43);
    t.rect(34, 7, 38, 11, 2);
    t.rect(35, 8, 37, 10, 4); // the pine hill
    t.rect(26, 29, 31, 31, 2); // a grass bank on the water
  },
  build(b) {
    // ── row 1: trees ──
    for (const [x, z] of [[8, 9], [10, 10], [12, 9], [14, 10], [16, 9], [18, 10], [20, 9], [28, 10], [30, 9], [32, 10]] as const) b.put('tree', x, z);
    for (const [x, z] of [[23, 9], [24, 9], [25, 9], [23, 10], [24, 10], [25, 10]] as const) b.put('tree', x, z);
    b.put('tree', 35, 8).put('tree', 37, 9).put('tree', 36, 10);

    // ── row 2: plaza trees, fruit trees, a path, the square, a walled court ──
    b.plaza(8, 13, 9, 14).put('tree', 8, 13).put('tree', 10, 14);
    b.garden(12, 13, 13, 14).put('tree', 12, 13).put('tree', 13, 14);
    b.path([15, 13], [18, 13], [18, 15], [20, 15]);
    b.plaza(21, 13, 25, 17).put('fountain', 23, 15);
    b.fenceAround(28, 13, 30, 15, 'wall');
    b.put('fountain', 29, 14);

    // ── row 3: gardens, a basin, stalls ──
    b.garden(8, 19, 9, 20);
    b.house(11, 19, { color: 2 }).garden(12, 19, 13, 20);
    b.stack('windmill', 16, 19, { floors: 2 }).garden(17, 19, 18, 20);
    b.garden(21, 20, 22, 21).fenceAround(21, 20, 22, 21, 'wall');
    b.garden(27, 19, 29, 21).put('fountain', 28, 20);
    b.path(26, 20);
    b.put('fountain', 31, 18);
    b.path(31, 20, 36, 20);
    b.put('stall', 32, 19).put('stall', 34, 19);
    b.garden(36, 21, 37, 22).put('stall', 36, 21);

    // ── row 4: fences and walls ──
    b.path(9, 24, 9, 26);
    b.put('fence', 8, 25).put('fence', 9, 25).put('fence', 10, 25).put('fence', 11, 25).put('fence', 11, 26);
    b.house(13, 25, { w: 2, color: 4 });
    b.plaza(13, 25, 14, 25);
    b.fenceEdge(13, 25, 'S').fenceEdge(14, 25, 'S').fenceEdge(14, 25, 'E').fenceEdge(13, 25, 'W').fenceEdge(13, 25, 'N').fenceEdge(14, 25, 'N');
    b.fill('marble', 17, 25, 18, 25);
    b.block('stairs', 16, 1, 25, { rot: 1 });
    b.fenceEdge(17, 25, 'S').fenceEdge(18, 25, 'S').fenceEdge(18, 25, 'E').fenceEdge(17, 25, 'N').fenceEdge(18, 25, 'N');
    b.put('wall', 20, 25).put('wall', 21, 25).put('wall', 22, 25).put('wall', 22, 26);
    b.tower(25, 25, { floors: 3, color: 1 });
    b.put('wall', 26, 25).put('wall', 27, 25).put('wall', 28, 25);

    // ── the shore ──
    b.put('tree', 8, 31).put('tree', 10, 31);
    for (let z = 32; z <= 35; z++) b.block('dock', 13, 0, z);
    b.fenceEdge(13, 33, 'W').fenceEdge(13, 34, 'W').fenceEdge(13, 33, 'E').fenceEdge(13, 34, 'E');
    b.block('dock', 17, 0, 32).block('dock', 17, 0, 33);
    b.put('stall', 15, 31);
    b.garden(20, 31, 23, 31);
    b.put('tree', 27, 31).put('tree', 30, 31);
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 38, zoom: 1.7, target: [22.5, 1, 21] },
    { name: 'back', yaw: 225, pitch: 38, zoom: 1.7, target: [22.5, 1, 21] },
    { name: 'west', yaw: 135, pitch: 38, zoom: 1.7, target: [22.5, 1, 21] },
    { name: 'east', yaw: 315, pitch: 38, zoom: 1.7, target: [22.5, 1, 21] },
    { name: 'trees', yaw: 45, pitch: 34, zoom: 3.3, target: [20, 1, 11.5] },
    { name: 'square', yaw: 45, pitch: 36, zoom: 3.3, target: [20, 1, 15.5] },
    { name: 'gardens', yaw: 45, pitch: 36, zoom: 3.3, target: [22, 1, 20.5] },
    { name: 'fences', yaw: 45, pitch: 34, zoom: 3.3, target: [18.5, 1, 25.5] },
    { name: 'shore', yaw: 45, pitch: 32, zoom: 3.3, target: [19, 1, 31.5] },
  ],
  expect(plan, _dressing, check) {
    const have = new Set<string>();
    for (const r of plan.roles.values()) have.add(r.role);
    for (const role of WANTED) check.ok(have.has(role), `the gallery shows '${role}'`);
    check.hasFeature({ type: 'gate' });
    check.hasFeature({ type: 'plaza-motif' });
    check.hasFeature({ type: 'ramp' }, 2);
  },
});
