// Fixture for D28 (terrace furniture). Eight houses with a two-storey part
// and a one-storey wing of 2 × 2, some of whose wings J05 makes terraces:
//   a terrace                        for most, a parasol, a deck chair and a cluster of pots
//   a wing with a pitched roof       nothing on it
//   a terrace laid as a roof garden  nothing on it: it is a garden

import { scenario } from '@/scenario';

export default scenario({
  name: 'D28.terrace-furniture',
  seed: 2828,
  about: 'Most flat roof terraces get a parasol with a table, a deck chair and pots; pitched roofs and roof gardens do not.',
  build(b) {
    for (let i = 0; i < 8; i++) {
      const x = 8 + (i % 4) * 7, z = 8 + Math.floor(i / 4) * 8;
      b.house(x, z, { d: 2, floors: 2, color: i % 8 });
      b.house(x + 1, z, { w: 2, d: 2, color: i % 8 });
    }
    b.house(10, 26, { w: 2, d: 2, color: 4 }).garden(10, 26, 11, 27);
  },
  cameras: [
    { name: 'all', yaw: 30, pitch: 48, zoom: 2.6, target: [19, 1.5, 15] },
    { name: 'close', yaw: 30, pitch: 34, zoom: 6, target: [10, 1.8, 9] },
  ],
  expect(plan, dressing, check) {
    const mine = dressing.props.filter((p) => p.rule === 'D28.terrace-furniture');
    const terraces = plan.features.filter((f) => f.type === 'roof' && f.variant === 'flat' && plan.structures.get(f.structure)?.kind === 'house');
    check.ok(terraces.length >= 2, `some wings are terraces (${terraces.length})`);
    check.ok(mine.length >= 2, `some terraces are furnished (${mine.length})`);
    for (const p of mine) {
      if (!('cell' in p.at)) continue;
      const under = plan.structureAt.get(p.at.cell - 4096);
      check.ok(terraces.some((t) => t.structure === under), 'furniture stands on a terrace');
      check.ok(!plan.world.floors.has(p.at.cell), 'never on a roof garden');
    }
  },
});
