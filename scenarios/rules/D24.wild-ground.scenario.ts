// Fixture for D24 (wild ground). A small hamlet in the west and open country
// to the east: long grass and wildflowers get commoner the farther they are
// from the houses and the path, there are none on the path or in front of a
// door, boulders lie at the foot of the cliff, driftwood and shells on the
// beach, reeds and lily pads in the ponds but not round the jetty.

import { scenario } from '@/scenario';

export default scenario({
  name: 'D24.wild-ground',
  seed: 2424,
  about: 'Tufts and wildflowers thicken away from the town; boulders at a cliff foot; finds on sand; reeds and lily pads in sheltered water, away from docks.',
  terrain(t) {
    t.flat(1);
    t.rect(30, 6, 40, 12, 3); // a bluff with a cliff on three sides
    t.water(22, 24, 27, 28); // a pond
    t.water(8, 30, 12, 34); // a boat pond with a jetty
  },
  build(b) {
    b.path(8, 14, 16, 14);
    b.house(9, 13, { color: 2 });
    b.house(12, 13, { floors: 2, color: 4 });
    b.house(11, 15, { color: 0 });
    b.put('tree', 15, 12);
    for (let z = 30; z <= 32; z++) b.block('dock', 10, 0, z);
  },
  cameras: [
    { name: 'far', yaw: 45, pitch: 36, zoom: 1.6, target: [24, 1, 20] },
    { name: 'meadow', yaw: 45, pitch: 30, zoom: 5, target: [24, 1, 17] },
    { name: 'cliff', yaw: 45, pitch: 30, zoom: 6, target: [34, 1, 14] },
    { name: 'pond', yaw: 45, pitch: 34, zoom: 6.5, target: [24.5, 0.6, 26.5] },
    { name: 'pond-back', yaw: 225, pitch: 34, zoom: 6.5, target: [24.5, 0.6, 26.5] },
    { name: 'beach', yaw: 135, pitch: 32, zoom: 6, target: [8, 1, 22] },
    { name: 'tuft-close', yaw: 45, pitch: 26, zoom: 12, target: [26, 1.1, 16] },
  ],
  expect(_plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D24.wild-ground');
    const cellOf = (p: (typeof mine)[number]): [number, number, number] => {
      const c = 'cell' in p.at ? p.at.cell : 0;
      return [c & 63, c >> 12, (c >> 6) & 63];
    };
    const tufts = mine.filter((p) => p.type === 'tuft');
    // Denser away from the town: compare a block of open country with the same area round the hamlet.
    const within = (x0: number, z0: number, x1: number, z1: number): number => tufts.filter((p) => { const [x, , z] = cellOf(p); return x >= x0 && x <= x1 && z >= z0 && z <= z1; }).length;
    const near = within(7, 11, 16, 17), far = within(20, 14, 29, 20);
    check.ok(far >= 8, `open country has tufts (${far})`);
    check.ok(near * 2 < far, `far fewer by the houses (${near} against ${far})`);
    check.ok(tufts.some((p) => p.variant === 'flowers') && tufts.some((p) => p.variant === 'grass'), 'some tufts flower, some do not');
    // Never on the path, never on the doorstep, never in a cell with a block.
    for (let x = 8; x <= 16; x++) check.noProp({ type: 'tuft', at: [x, 1, 14] });
    check.noProp({ type: 'tuft', at: [15, 1, 12] });
    // Boulders only where a cliff rises beside the cell.
    const boulders = check.hasProp({ type: 'boulder' }, 2);
    for (const p of boulders) {
      const [x, , z] = cellOf(p);
      check.ok((x === 29 || x === 41) ? z >= 6 && z <= 12 : z === 13 || z === 5, `boulder at ${x}, ${z} is at the foot of the bluff`);
    }
    // Finds only on sand; water plants only in the pond, none in the harbour.
    check.hasProp({ type: 'beach-find' }, 3);
    check.hasProp({ type: 'reeds' }, 2);
    check.hasProp({ type: 'lily-pads' }, 2);
    for (const p of mine.filter((q) => q.type === 'reeds' || q.type === 'lily-pads')) {
      const [x, y, z] = cellOf(p);
      check.ok(y === 0 && ((x >= 22 && x <= 27 && z >= 24 && z <= 28) || (x >= 8 && x <= 12 && z >= 30 && z <= 34)), `water plant at ${x}, ${z} is in still water`);
      check.ok(!(x >= 9 && x <= 11 && z >= 30 && z <= 33), `water plant at ${x}, ${z} keeps away from the dock`);
    }
  },
});
