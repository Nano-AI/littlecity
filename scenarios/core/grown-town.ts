// Grown towns (design section 15a): the generator's whole town on the real
// island for a seed, with cameras placed from where the generator put its
// districts. Shared by grown-town-1 … grown-town-3.
//
//   npm run shots -- grown-town-1
//   npm run shots -- grown-town-1 --time dusk

import { columnIndex } from '@/core/grid';
import type { CameraSpec } from '@/scenario';
import { scenario } from '@/scenario';
import { generateTerrain } from '@/terrain/terrain';
import { planTown } from '@/townmaker/index';

export function grownTown(n: number, seed: number) {
  const terrain = generateTerrain(seed, 1);
  const plan = planTown(terrain, seed);
  const at = (name: string): [number, number] | null => {
    const d = plan.districts.find((x) => x.name === name);
    return d ? [d.x, d.z] : null;
  };
  const level = (x: number, z: number): number => terrain.height[columnIndex(Math.round(x), Math.round(z))] ?? 1;
  // The middle of the land, for the overviews.
  let sx = 0, sz = 0, land = 0;
  for (let z = 0; z < 48; z++) for (let x = 0; x < 48; x++) if (terrain.height[columnIndex(x, z)]! > 0) {
    sx += x;
    sz += z;
    land++;
  }
  const mid: [number, number, number] = [sx / land + 0.5, 1, sz / land + 0.5];
  const cameras: CameraSpec[] = [
    { name: 'overview', yaw: 45, pitch: 35, zoom: 1.6, target: mid },
    { name: 'overview-ne', yaw: 135, pitch: 35, zoom: 1.6, target: mid },
    { name: 'overview-nw', yaw: 225, pitch: 35, zoom: 1.6, target: mid },
    { name: 'overview-sw', yaw: 315, pitch: 35, zoom: 1.6, target: mid },
  ];
  const close: [string, string, number, number][] = [
    ['square', 'square', 45, 4],
    ['harbour', 'harbour', 45, 3.6],
    ['castle', 'castle', 45, 3.4],
    ['acropolis', 'acropolis', 135, 3.6],
    ['housing0', 'houses', 45, 3.8],
    ['folly', 'folly', 45, 4.5],
    ['chapel', 'chapel', 225, 4.5],
    ['manor', 'manor', 315, 4],
    ['mill', 'mill', 45, 4.5],
    ['lighthouse', 'lighthouse', 315, 4.5],
  ];
  for (const [district, name, yaw, zoom] of close) {
    const p = at(district);
    if (!p) continue;
    cameras.push({ name, yaw, pitch: name === 'square' ? 44 : 32, zoom, target: [p[0] + 0.5, level(p[0], p[1]) + 0.5, p[1] + 0.5] });
  }
  const sq = plan.square;
  const town: [number, number, number] = sq ? [sq.x + 0.5, sq.h + 0.5, sq.z + 0.5] : mid;
  cameras.push(
    { name: 'town', yaw: 45, pitch: 33, zoom: 2.4, target: town },
    { name: 'dusk', yaw: 45, pitch: 35, zoom: 1.6, target: mid, time: 'dusk' },
    { name: 'dusk-town', yaw: 45, pitch: 33, zoom: 2.4, target: town, time: 'dusk' },
    { name: 'night', yaw: 45, pitch: 35, zoom: 1.6, target: mid, time: 'night' },
    { name: 'night-town', yaw: 45, pitch: 33, zoom: 2.4, target: town, time: 'night' },
  );

  return scenario({
    name: `grown-town-${n}`,
    seed,
    about: `Grow a town on the generated island for seed ${seed}: the generator's whole town, every edit legal, district by district.`,
    terrain: 'generated',
    terrainGen: 1, // pinned: this island must not move when generator 2 is tuned
    build(b) {
      for (const e of plan.edits) b.edit(e);
    },
    cameras,
    expect(shape, dressing, check) {
      const roles = new Set([...shape.roles.values()].map((r) => r.role));
      check.ok(roles.size >= 30, `a grown town shows at least 30 roles (has ${roles.size})`);
      for (const r of ['shop', 'chapel', 'steeple', 'clock-tower', 'tiered-fountain', 'lighthouse', 'windmill', 'keep', 'temple', 'pier'] as const) {
        check.ok(roles.has(r), `a ${r}`);
      }
      check.ok(dressing.props.some((p) => p.rule.startsWith('D01')), 'street lamps');
    },
  });
}
