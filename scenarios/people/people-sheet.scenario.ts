// The model sheet for the little person: every pose in a row, and a crowd of
// seeded looks, standing still on a square beside a house for scale. Close,
// at playing zoom and from far away, because they have to read at all three.

import { key } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';
import { POSES, type PoseName } from '@/parts/people/pose';

const ROW_Z = 20;

const sheet = defineRule<{ pose: PoseName; look: number; phase: number; child: boolean }>({
  id: 'X-PEOPLE.sheet',
  part: 'life',
  tier: 1,
  priority: 0,
  about: 'Gallery only: figures in every pose and a crowd of looks.',
  find() {
    const out = [];
    // One of each pose, facing south, with two walk drawings so the stride shows.
    const poses: [PoseName, number][] = [];
    for (const p of POSES) {
      if (p === 'walk' || p === 'run') poses.push([p, 0.25], [p, 0.75]);
      else poses.push([p, 1.4]);
    }
    poses.forEach(([pose, phase], i) => {
      out.push({ anchor: key(12 + Math.floor(i / 2), 1, ROW_Z), key: `pose${i}`, data: { pose, look: 100 + i * 7, phase, child: false } });
    });
    // A crowd of looks: four to a cell.
    for (let i = 0; i < 40; i++) {
      out.push({ anchor: key(12 + (i % 10), 1, ROW_Z + 2 + Math.floor(i / 20)), key: `look${i}`, data: { pose: 'stand' as PoseName, look: 1000 + i * 13, phase: i, child: i % 7 === 3 } });
    }
    return out;
  },
  apply(c, out) {
    const index = Number(String(c.key).replace(/\D+/g, ''));
    const crowd = String(c.key).startsWith('look');
    const pos = crowd ? ((['nw', 'ne'] as const)[Math.floor(index / 10) % 2]!) : ((['w', 'e'] as const)[index % 2]!);
    out.actor({
      type: 'figure',
      variant: c.data.pose,
      at: { cell: c.anchor, pos, face: 2 },
      params: { look: c.data.look, phase: c.data.phase, child: c.data.child ? 1 : 0 },
    });
  },
});

export default scenario({
  name: 'people-sheet',
  seed: 31,
  about: 'Every pose and forty seeded looks of the little person, standing still.',
  rules: [sheet],
  build(b) {
    b.plaza(11, ROW_Z - 1, 22, ROW_Z + 4);
    b.house(10, ROW_Z - 3, { floors: 2, w: 2, color: 2 });
    b.put('tree', 23, ROW_Z);
    b.path(11, ROW_Z + 5, 22, ROW_Z + 5);
  },
  cameras: [
    { name: 'poses', yaw: 20, pitch: 22, zoom: 9, target: [15.5, 1.3, ROW_Z] },
    { name: 'poses-b', yaw: 20, pitch: 22, zoom: 9, target: [19, 1.3, ROW_Z] },
    { name: 'looks', yaw: 20, pitch: 24, zoom: 7.5, target: [17, 1.3, ROW_Z + 2.4] },
    { name: 'back', yaw: 200, pitch: 24, zoom: 7.5, target: [17, 1.3, ROW_Z + 2.4] },
    { name: 'playing', yaw: 45, pitch: 35, zoom: 2.6, target: [17, 1, ROW_Z + 1] },
    { name: 'far', yaw: 45, pitch: 35, zoom: 1.6, target: [20, 1, ROW_Z + 1] },
  ],
  expect(_plan, dressing, check) {
    check.ok(dressing.actors.filter((a) => a.type === 'figure').length === POSES.length + 2 + 40, 'every pose and forty looks are on the sheet');
  },
});
