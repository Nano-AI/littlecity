// Discovery round 1: a town made almost entirely of Auto blocks clicked
// without a plan: clusters, single stacks, lines toward the water, blocks
// out over the sea, a few paths scribbled between them afterwards.
//
//   npm run shots -- disc1-auto-sprawl

import { scenario } from '@/scenario';
import { close, lcg, quarters, road } from './lib';

export default scenario({
  name: 'disc1-auto-sprawl',
  seed: 9109,
  about: 'Discovery: Auto blocks clicked without a plan on flat land by a sea, with a knoll, with a few scribbled paths.',
  terrain(t) {
    t.flat(1);
    t.water(4, 4, 12, 43); // the west sea
    t.disc(30, 14, 4, 2);
    t.disc(30, 14, 2, 3);
  },
  build(b) {
    const rnd = lcg(77);
    const placed = new Set<string>();
    // Clusters of Auto: pick a centre, then click around it.
    for (let c = 0; c < 9; c++) {
      const cx = 15 + Math.floor(rnd() * 26), cz = 7 + Math.floor(rnd() * 33);
      const n = 3 + Math.floor(rnd() * 8);
      for (let i = 0; i < n; i++) {
        const x = cx + Math.floor(rnd() * 5) - 2, z = cz + Math.floor(rnd() * 5) - 2;
        if (x < 13 || x > 42 || z < 5 || z > 42) continue;
        const h = 1 + Math.floor(rnd() * 3);
        const k = `${x},${z}`;
        if (placed.has(k)) continue;
        placed.add(k);
        b.auto(x, z, { floors: h });
      }
    }
    // A line of Auto from the shore out into the sea, and one out alone.
    for (let x = 8; x <= 12; x++) b.block('auto', x, 0, 20);
    b.block('auto', 7, 0, 30);
    b.block('auto', 8, 0, 30);
    // A tall lone Auto stack.
    if (!placed.has('38,38')) b.auto(38, 38, { floors: 6 });
    // Scribbled paths, avoiding blocks.
    const scribble = (pts: [number, number][]): void => {
      let [x, z] = pts[0]!;
      const lay = (): void => {
        if (placed.has(`${x},${z}`)) return;
        if (b.world.blocks.size && b.onTerrain(x, z) !== b.ground(x, z)) return;
        if (!b.world.floors.has(b.cell(x, b.floorLevel(x, z), z))) b.path(x, z);
      };
      lay();
      for (const [tx, tz] of pts.slice(1)) {
        while (x !== tx) { x += Math.sign(tx - x); lay(); }
        while (z !== tz) { z += Math.sign(tz - z); lay(); }
      }
    };
    scribble([[13, 20], [26, 20], [26, 34], [36, 34]]);
    scribble([[20, 10], [20, 40]]);
    b.put('tree', 40, 8).put('tree', 16, 42);
    void road;
  },
  cameras: [
    ...quarters([26, 1, 24], 1.8),
    close('middle', 24, 1.5, 22, 45, 3.4),
    close('sea-line', 10, 1, 20, 315, 4.5),
  ],
});
