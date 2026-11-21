// Gallery: the small round things, side by side, to judge their outlines (soft ink: a round thing
// is drawn as one smooth mass with one outline, src/gen/soft.ts). Held still:
//
//   row 1   the scuffle's dust cloud (its three drawings), the swearing balloons, the chat bubble,
//           what pops out of the cloud, a dazed star
//   row 2   people: sixteen seeded looks (hair, hats, children), standing
//   row 3   a dog in each pose in two coats, cats, hens, a sheep, a pigeon, a gull
//   row 4   what people carry, set down: a basket of apples, a bouquet, a lantern, loaves...
//   then    a market street of stalls (fruit, bread, cheese...) and an orchard
//
// The balloons are turned to the 'close' cameras (yaw 30, pitch 30), as the game turns them to its camera.

import { key } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { scenario } from '@/scenario';

const X0 = 10;
type Spec = { type: string; variant?: string; params?: Record<string, number>; pos?: 'c' | 'nw' | 'ne' | 'sw' | 'se' | 'w' | 'e' };
const FACE = { yaw: 30, pitch: 30 };

function rows(): { x: number; z: number; spec: Spec }[] {
  const out: { x: number; z: number; spec: Spec }[] = [];
  const row = (z: number, specs: Spec[]): void => specs.forEach((spec, i) => out.push({ x: X0 + i, z, spec }));
  row(12, [
    ...[0, 1, 2].map((n): Spec => ({ type: 'specimen', variant: 'cloud', params: { n } })),
    ...[0, 1, 2, 3].map((n): Spec => ({ type: 'specimen', variant: 'swear', params: { n, ...FACE } })),
    { type: 'specimen', variant: 'chat', params: { n: 0, ...FACE } },
    ...[0, 1, 2, 3].map((n): Spec => ({ type: 'specimen', variant: 'pop', params: { n, ...FACE } })),
    { type: 'specimen', variant: 'daze', params: { n: 0 } },
  ]);
  row(14, Array.from({ length: 16 }, (_, i): Spec => ({ type: 'figure', variant: 'stand', params: { look: 2000 + i * 17, phase: 0, child: i % 6 === 5 ? 1 : 0 } })));
  row(16, [
    ...Array.from({ length: 10 }, (_, n): Spec => ({ type: 'specimen', variant: 'dog', params: { n } })),
    ...Array.from({ length: 8 }, (_, n): Spec => ({ type: 'specimen', variant: 'animal', params: { n } })),
  ]);
  row(18, Array.from({ length: 10 }, (_, n): Spec => ({ type: 'specimen', variant: 'load', params: { n } })));
  return out;
}

const specimens = defineRule<{ spec: Spec }>({
  id: 'X-SOFT.specimens',
  part: 'life',
  tier: 1,
  priority: -500,
  about: 'Gallery only: the small round things of life held still in rows.',
  find: () => rows().map(({ x, z, spec }, i) => ({ anchor: key(x, 1, z), key: `s${i}`, data: { spec } })),
  apply(c, out) {
    const s = c.data.spec;
    out.actor({ type: s.type, ...(s.variant ? { variant: s.variant } : {}), at: { cell: c.anchor, pos: s.pos ?? 'c', face: 2 }, params: s.params ?? {} } as never);
  },
});

export default scenario({
  name: 'soft-ink',
  seed: 4242,
  about: 'Round things side by side: the scuffle cloud and balloons, people, dogs and animals, carried goods, stalls and an orchard.',
  terrain(t) {
    t.flat(1);
  },
  rules: [specimens],
  build(b) {
    // A market street of stalls, their goods from each stall's seed.
    b.path(X0 - 1, 22, X0 + 12, 22);
    for (let x = X0; x <= X0 + 12; x += 2) b.put('stall', x, 21);
    // An orchard: trees on a 2-cell grid.
    for (let x = 30; x <= 34; x += 2) for (let z = 12; z <= 16; z += 2) b.put('tree', x, z);
  },
  cameras: [
    { name: 'close-fight', yaw: 30, pitch: 30, zoom: 13, target: [X0 + 3, 1.3, 12.5] },
    { name: 'close-balloons', yaw: 30, pitch: 30, zoom: 13, target: [X0 + 9, 1.3, 12.5] },
    { name: 'close-people', yaw: 30, pitch: 22, zoom: 12, target: [X0 + 4, 1.3, 14.5] },
    { name: 'close-people-b', yaw: 30, pitch: 22, zoom: 12, target: [X0 + 11, 1.3, 14.5] },
    { name: 'close-dogs', yaw: 30, pitch: 28, zoom: 13, target: [X0 + 4, 1.2, 16.5] },
    { name: 'close-animals', yaw: 30, pitch: 28, zoom: 13, target: [X0 + 12, 1.2, 16.5] },
    { name: 'close-goods', yaw: 30, pitch: 32, zoom: 12, target: [X0 + 4.5, 1.2, 18.5] },
    { name: 'close-stalls', yaw: 30, pitch: 32, zoom: 9, target: [X0 + 3, 1.3, 21.5] },
    { name: 'close-orchard', yaw: 30, pitch: 28, zoom: 8, target: [32, 1.6, 14] },
    { name: 'playing', yaw: 45, pitch: 33, zoom: 3.4, target: [X0 + 7, 1, 16] },
    { name: 'far', yaw: 45, pitch: 35, zoom: 1.6, target: [X0 + 10, 1, 17] },
  ],
  expect(_plan, dressing, check) {
    check.ok(dressing.actors.filter((a) => a.type === 'specimen').length >= 30, 'the specimens are laid out');
  },
});
