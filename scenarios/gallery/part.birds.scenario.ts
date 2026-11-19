// Gallery: the three birds, held still so they can be looked at. One row
// each (gull at the back, pigeon, swift in front), four drawings a row:
//
//   sitting, wings folded · gliding · wings up · wings down
//
// The last two are the ends of a wing beat. The birds are placed by a rule
// of this scenario with the gallery-only `hold` param; in a town they come
// from L11, L12 and L13 and are alive (scenarios/rules/L11…L16).

import { key } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

const X0 = 22, Z0 = 22;
const SPECIES = ['gull', 'pigeon', 'swift'] as const;
const HOLDS = ['sit', 'spread', 'up', 'down'] as const;

const specimens = defineRule<{ species: (typeof SPECIES)[number]; hold: (typeof HOLDS)[number] }>({
  id: 'X-PARTS.birds',
  part: 'life',
  tier: 1,
  priority: -500,
  about: 'Gallery: one bird of each species in each held drawing, on a strip of plaza.',
  find: () => SPECIES.flatMap((species, row) => HOLDS.map((hold, col) => ({ anchor: key(X0 + col, 1, Z0 + row), data: { species, hold } }))),
  apply(c, out) {
    out.actor({ type: c.data.species, at: { cell: c.anchor, pos: 'c', face: 1 }, params: { hold: c.data.hold } });
  },
});

export default scenario({
  name: 'part.birds',
  seed: 1116,
  about: 'Gull, pigeon and swift: sitting, gliding, and the two ends of a wing beat.',
  rules: [specimens],
  build(b) {
    b.path(X0, Z0 + 1, X0 + 3, Z0 + 1); // the pigeons stand on a path; the gulls and swifts are over grass
  },
  cameras: [
    { name: 'front', yaw: 30, pitch: 30, zoom: 11, target: [X0 + 2, 1.2, Z0 + 1.5] },
    { name: 'back', yaw: 215, pitch: 38, zoom: 11, target: [X0 + 2, 1.2, Z0 + 1.5] },
    { name: 'playing-zoom', yaw: 45, pitch: 33, zoom: 3.3, target: [X0 + 2, 1, Z0 + 1.5] },
    { name: 'dusk', yaw: 30, pitch: 30, zoom: 11, target: [X0 + 2, 1.2, Z0 + 1.5], time: 'dusk' },
  ],
  expect(_plan, _dressing, check) {
    for (const species of SPECIES) check.equal(check.actors({ type: species, rule: 'X-PARTS.birds' }).length, HOLDS.length, `${species} specimens`);
  },
});
