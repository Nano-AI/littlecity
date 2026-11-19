// L32 · Stranded. A home with no route to any floor keeps its people within
// two cells of the door: one sits on the step, the others tend pots.

import { scenario } from '@/scenario';

export default scenario({
  name: 'L32.stranded',
  seed: 46,
  about: 'A house on a mesa with no way down, and one with a street: only the first is stranded.',
  terrain(t) {
    t.flat(1);
    t.rect(20, 10, 25, 15, 3);
  },
  build(b) {
    b.house(22, 12, { floors: 2, w: 2, color: 5 }); // on the mesa
    b.path(8, 18, 16, 18);
    b.house(10, 19, { floors: 2, w: 2, color: 2 });
  },
  cameras: [
    { name: 'mesa', yaw: 45, pitch: 32, zoom: 4.2, target: [22, 3, 13] },
    { name: 'both', yaw: 45, pitch: 34, zoom: 2.4, target: [17, 1, 15] },
  ],
  expect(_plan, dressing, check) {
    const nav = dressing.nav;
    const mesa = check.structure(22, 3, 12).id;
    const stoops = check.sockets({ type: 'haunt-stoop' });
    check.ok(stoops.length >= 2 && stoops.length <= 4, 'a step and a few pots');
    check.ok(stoops.every((s) => s.structure === mesa), 'only the mesa house is stranded');
    check.equal(stoops.filter((s) => s.name === 'step').length, 1, 'steps to sit on');
    check.ok(stoops.every((s) => nav.nodeAt.has(s.cell)), 'all on the walking graph');
    // Within two cells of the door.
    const door = nav.doors[nav.doorsOf.get(mesa)!.find((i) => nav.doors[i]!.node >= 0)!]!;
    const at = nav.nodes[door.node]!.cell;
    const far = (c: number): number => Math.abs((c & 63) - (at & 63)) + Math.abs(((c >> 6) & 63) - ((at >> 6) & 63));
    check.ok(stoops.every((s) => far(s.cell) <= 2), 'within two cells of the door');
    check.equal(nav.partFloors[nav.part[door.node]!], 0, 'floor cells reachable from the mesa');
  },
});
