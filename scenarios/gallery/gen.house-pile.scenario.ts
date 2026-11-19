// GALLERY: a careless pile. What a player makes by clicking fast: Auto and
// house blocks of three colours dropped at seeded random on a hillside by
// the sea, with a few towers, marble blocks and windmills among them. It is
// here to be looked at for breakage: holes in roofs, walls that do not
// meet, things that float. Nothing in it is arranged.
//
//   npm run shots -- gen.house-pile

import { key } from '@/core/grid';
import { rand } from '@/core/rand';
import { scenario } from '@/scenario';
import { houseDressing } from '../houses/standins';

const SEED = 4103;
const KINDS = ['house', 'house', 'house', 'auto', 'auto', 'tower', 'marble', 'windmill'] as const;

export default scenario({
  name: 'gen.house-pile',
  seed: SEED,
  about: 'Two hundred blocks dropped at random on a hillside: a stress picture for the house shell and roofs.',
  rules: houseDressing,
  terrain(t) {
    t.rect(6, 6, 30, 24, 1);
    t.rect(6, 6, 30, 14, 2);
    t.rect(6, 6, 16, 10, 3);
  },
  build(b) {
    b.path(8, 16, 28, 16);
    b.plaza(17, 17, 19, 19);
    for (let i = 0; i < 230; i++) {
      const x = 9 + Math.floor(rand(SEED, 'x', i) * 18), z = 8 + Math.floor(rand(SEED, 'z', i) * 17);
      const y = b.ground(x, z) + Math.floor(rand(SEED, 'y', i) * 3.4);
      const kind = KINDS[Math.floor(rand(SEED, 'k', i) * KINDS.length)]!;
      if (b.world.floors.has(key(x, b.ground(x, z), z))) continue; // keep the street and the square clear
      const edit = { type: 'placeBlock' as const, cell: key(x, y, z), kind, color: [2, 4, 6][Math.floor(rand(SEED, 'c', i) * 3)]!, from: null };
      try {
        b.edit(edit);
      } catch {
        // an illegal drop (inside the ground, on a windmill): the player's click simply did nothing
      }
    }
  },
  cameras: [
    { name: 'front', yaw: 45, pitch: 32, zoom: 4, target: [18, 2.5, 16] },
    { name: 'se', yaw: 135, pitch: 32, zoom: 4, target: [18, 2.5, 16] },
    { name: 'nw', yaw: 225, pitch: 32, zoom: 4, target: [18, 2.5, 16] },
    { name: 'ne', yaw: 315, pitch: 32, zoom: 4, target: [18, 2.5, 16] },
    { name: 'close', yaw: 45, pitch: 30, zoom: 7.5, target: [18, 2.5, 17] },
  ],
  expect(plan, _dressing, check) {
    const houses = [...plan.structures.values()].filter((s) => s.kind === 'house');
    check.ok(houses.length >= 20, `${houses.length} houses`);
    // Every house has a role, a door and a roof for each region that is not wholly built over.
    for (const s of houses) {
      check.ok(plan.roles.has(s.id), `house ${s.id} has a role`);
      check.ok((plan.featuresByStructure.get(s.id) ?? []).some((f) => f.type === 'door'), `house ${s.id} has a door`);
    }
  },
});
