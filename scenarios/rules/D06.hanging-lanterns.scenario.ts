// Fixture for D06 (hanging lanterns) and D11 (doorsteps).
//   a gateway through a wall, a path under it        a lantern hangs from the crown of the arch
//   eight alleys between pairs of tall houses        about four in ten have a lantern on a wall bracket
//   a gap one cell long between two houses           too short to be an alley: none
//   every house door                                 a doormat; some have pots, a barrel, a bicycle;
//                                                    the ones that face a street have a little lantern

import { scenario } from '@/scenario';

export default scenario({
  name: 'D06.hanging-lanterns',
  seed: 6061,
  about: 'A lantern under every gateway and on a wall bracket in about four alleys in ten; a doormat at every house door, with pots, a barrel or a bicycle at some and a lantern where the door faces a street.',
  build(b) {
    // The gateway: an arch in a wall, a street through it.
    b.path(8, 10, 8, 16);
    b.block('arch', 8, 1, 13);
    for (const x of [6, 7, 9, 10]) b.put('wall', x, 13);
    // Eight alleys three cells long, each between two houses.
    for (let i = 0; i < 8; i++) {
      const x = 13 + i * 3;
      b.house(x, 9, { w: 2, d: 3, floors: 2, color: i % 8 });
      if (i === 7) b.house(x + 3, 9, { w: 2, d: 3, floors: 2, color: 3 });
    }
    b.path(12, 12, 39, 12);
    // A gap one cell long.
    b.house(14, 16, { floors: 2, color: 1 }).house(16, 16, { floors: 2, color: 5 });
    b.path(13, 17, 18, 17);
  },
  cameras: [
    { name: 'all', yaw: 45, pitch: 36, zoom: 2.4, target: [22, 1.5, 12] },
    { name: 'gateway', yaw: 20, pitch: 24, zoom: 9, target: [8.5, 1.4, 13.5] },
    { name: 'alleys', yaw: 10, pitch: 30, zoom: 5, target: [24, 1.6, 11] },
    { name: 'doors', yaw: 30, pitch: 24, zoom: 9, target: [20, 1.3, 12.3] },
    { name: 'night', yaw: 10, pitch: 30, zoom: 5, target: [24, 1.6, 11], time: 'night' },
    { name: 'doors-night', yaw: 30, pitch: 24, zoom: 9, target: [20, 1.3, 12.3], time: 'night' },
  ],
  expect(plan, dressing, check) {
    const lanterns = dressing.props.filter((p) => p.rule === 'D06.hanging-lanterns');
    check.role(8, 1, 13, 'gateway');
    check.equal(lanterns.filter((p) => p.variant !== 'bracket').length, 1, 'one lantern under the gateway');
    const brackets = lanterns.filter((p) => p.variant === 'bracket');
    check.ok(brackets.length >= 1 && brackets.length <= 6, `some alleys have a lantern, not all (${brackets.length} of 8)`);
    for (const p of brackets) {
      const mount = dressing.sockets.find((s) => 'socket' in p.at && s.id === p.at.socket);
      check.ok(mount !== undefined && plan.kinds.get(mount.cell) === 'house' && ((mount.cell >> 6) & 63) <= 11, 'on a house wall in one of the alleys');
    }
    for (const p of lanterns) check.ok(dressing.sockets.some((s) => s.owner === p.id && s.type === 'lamp-head'), 'each lantern owns its light');
    // D11: one doorstep per ground-level house door.
    const steps = dressing.props.filter((p) => p.type === 'doorstep');
    const doors = plan.features.filter((f) => f.type === 'door' && plan.kinds.get(f.cell ?? -1) === 'house');
    check.equal(steps.length, doors.length, 'a doorstep at every house door');
    const param = (p: (typeof steps)[number], k: string): number => (p.params as Record<string, number>)[k] ?? 0;
    check.ok(steps.some((p) => param(p, 'pots') === 1) && steps.some((p) => param(p, 'pots') === 0), 'some doors have pots, some do not');
    check.ok(steps.some((p) => param(p, 'lantern') === 1), 'doors on a street have a lantern');
    for (const p of steps.filter((q) => param(q, 'lantern') === 1)) check.ok(dressing.sockets.some((s) => s.owner === p.id && s.type === 'lamp-head'), 'and it owns its light');
  },
});
