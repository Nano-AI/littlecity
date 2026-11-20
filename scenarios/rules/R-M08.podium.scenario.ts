// R-M08: a marble mass that carries a temple, has a great stair cut into it
// or holds a forum on its top is a podium (balustrades, no battlements, no
// garrison). The same mass with a curtain wall touching it stays a keep, and
// a plain pile stays a keep. J29 gives the podium a door into its vaults.

import { scenario } from '@/scenario';

export default scenario({
  name: 'R-M08.podium',
  seed: 4108,
  about: 'A temple podium with a stair (podium); a plaza on a 3-tall slab (podium); the same slab with a wall beside it (keep); a plain pile (keep).',
  build(b) {
    // A 6 × 4 podium 3 tall with a temple on it and a stair up its south side, a path at its foot.
    b.fill('marble', 8, 8, 13, 11, { floors: 3 });
    for (const x of [9, 12]) for (const z of [8, 10]) b.stack('pillar', x, z, { floors: 2 });
    for (let x = 9; x <= 12; x++) for (let z = 8; z <= 10; z++) b.block('marble', x, 6, z, { color: 2 });
    for (let i = 0; i < 3; i++) for (const x of [10, 11]) b.stack('marble', x, 14 - i, { floors: i + 1 });
    b.path(6, 15, 15, 15);
    // A forum: a plaza on a 4 × 4 slab 3 tall.
    b.fill('marble', 20, 8, 23, 11, { floors: 3, color: 1 });
    b.plaza(20, 8, 23, 10);
    // The same with a wall run against it: a castle keep.
    b.fill('marble', 28, 8, 31, 11, { floors: 3, color: 1 });
    b.plaza(28, 8, 31, 10);
    for (let x = 28; x <= 31; x++) b.put('wall', x, 12);
    // A plain pile: a keep.
    b.fill('marble', 20, 16, 21, 17, { floors: 3 });
  },
  cameras: [
    { name: 'temple', yaw: 30, pitch: 30, zoom: 3.2, target: [11, 2.5, 11] },
    { name: 'all', yaw: 40, pitch: 34, zoom: 2.2, target: [19, 2, 12] },
    { name: 'dusk', yaw: 210, pitch: 32, zoom: 2.4, target: [19, 2, 12], time: 'dusk' },
  ],
  expect(_plan, dressing, check) {
    check.role(8, 1, 8, 'podium');
    check.noFeature({ type: 'battlement', on: [8, 1, 8] });
    check.hasFeature({ type: 'railing', variant: 'balustrade', on: [8, 1, 8], rule: 'R-M08.podium' }, 8);
    check.hasFeature({ type: 'broad-steps', on: [8, 1, 8] }, 4);
    check.hasFeature({ type: 'door', on: [8, 1, 8], rule: 'J29.vault-door' });
    check.role(20, 1, 8, 'podium');
    check.role(28, 1, 8, 'keep');
    check.hasFeature({ type: 'battlement', on: [28, 1, 8] }, 4);
    check.role(20, 1, 16, 'keep');
    // No soldiers for a temple: the only garrisons are the keeps'.
    const homes = dressing.actors.filter((a) => a.type === 'garrison').map((a) => a.home);
    check.ok(!homes.includes(check.structure(8, 1, 8).id), 'no garrison round the temple podium');
    check.ok(!homes.includes(check.structure(20, 1, 8).id), 'no garrison round the forum');
  },
});
