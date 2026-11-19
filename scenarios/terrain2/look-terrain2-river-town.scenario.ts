// The rules on river water (design section 6, "Terrain, second generation"):
// on a generator-2 island, a stone bridge across the river, paths to it, a
// pier out from the beach and a few houses on the banks. Places are found
// from the island itself (the narrowest straight crossing between two low
// banks), so the scenario follows the generator when it is tuned.
//
//   npm run shots -- look-terrain2-river-town

import { columnIndex, SIZE_X, SIZE_Z } from '@/core/grid';
import { scenario } from '@/scenario';
import { hAt } from '@/terrain/noise';
import { islandSights } from './terrain2';

const SEED = 24;
const { isl, mid } = islandSights(SEED);
const h = isl.terrain.height;
const river = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < SIZE_X && z < SIZE_Z && isl.river[columnIndex(x, z)] === 1;

/** A straight crossing: 2–4 river columns with a low bank (height 1) at each end, beside more bank. */
function crossing(): { x0: number; z0: number; dx: number; dz: number; n: number } | null {
  let best: { x0: number; z0: number; dx: number; dz: number; n: number; score: number } | null = null;
  for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
    for (let z = 1; z < SIZE_Z - 1; z++) {
      for (let x = 1; x < SIZE_X - 1; x++) {
        // (x, z) is the bank the bridge starts from.
        if (hAt(h, x, z) !== 1 || !river(x + dx, z + dz)) continue;
        let n = 0;
        while (n < 5 && river(x + dx * (n + 1), z + dz * (n + 1))) n++;
        if (n < 2 || n > 4 || hAt(h, x + dx * (n + 1), z + dz * (n + 1)) !== 1) continue;
        // Room on both banks for a path and houses; far from the sea, so it is the river that is crossed.
        if (hAt(h, x - dx, z - dz) !== 1 || hAt(h, x + dx * (n + 2), z + dz * (n + 2)) < 1) continue;
        const score = -Math.hypot(x - mid[0], z - mid[2]) - n * 2;
        if (!best || score > best.score) best = { x0: x, z0: z, dx, dz, n, score };
      }
    }
  }
  return best;
}

/** A beach column with three columns of open sea straight out from it, for a pier. */
function pierFoot(): { x: number; z: number; dx: number; dz: number } | null {
  for (let r = 0; r < 30; r++) {
    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        if (Math.max(Math.abs(x - Math.round(mid[0])), Math.abs(z - Math.round(mid[2]))) !== r) continue;
        if (hAt(h, x, z) !== 1 || isl.terrain.material[columnIndex(x, z)] !== 1) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          let open = true;
          for (let k = 1; k <= 5 && open; k++) {
            for (let s = -1; s <= 1; s++) {
              const cx = x + dx * k + (dz !== 0 ? s : 0), cz = z + dz * k + (dx !== 0 ? s : 0);
              if (hAt(h, cx, cz) !== 0 || river(cx, cz)) open = false;
            }
          }
          if (open) return { x, z, dx, dz };
        }
      }
    }
  }
  return null;
}

const bridge = crossing();
const pier = pierFoot();

export default scenario({
  name: 'look-terrain2-river-town',
  seed: SEED,
  about: 'A stone bridge over a river on a generator-2 island, with a pier and a few houses: the rules fire on river water as on the sea.',
  terrain: 'generated',
  terrainGen: 2,
  startingTrees: true,
  build(b) {
    if (!bridge || !pier) throw new Error('look-terrain2-river-town: no crossing or pier site on this island');
    const { x0, z0, dx, dz, n } = bridge;
    for (let k = 1; k <= n; k++) b.block('arch', x0 + dx * k, 0, z0 + dz * k);
    // The road over it, two columns on from each end.
    const ax = x0 - dx * 2, az = z0 - dz * 2, ex = x0 + dx * (n + 3), ez = z0 + dz * (n + 3);
    for (const [px, pz] of [[ax, az], [x0 - dx, z0 - dz], [x0, z0], [x0 + dx * (n + 1), z0 + dz * (n + 1)], [x0 + dx * (n + 2), z0 + dz * (n + 2)], [ex, ez]] as const) {
      if (hAt(h, px, pz) > 0 && b.world.blocks.size >= 0) b.path(px, pz);
    }
    // Houses on the banks beside the road ends.
    const sx = dz, sz = dx; // across the road
    for (const [hx, hz] of [[x0 - dx + sx * 2, z0 - dz + sz * 2], [x0 - dx - sx * 2, z0 - dz - sz * 2], [x0 + dx * (n + 2) + sx * 2, z0 + dz * (n + 2) + sz * 2]] as const) {
      if (hAt(h, hx, hz) > 0 && !river(hx, hz)) b.house(hx, hz, { floors: 2 });
    }
    // A pier out from the beach.
    for (let k = 1; k <= 4; k++) b.block('dock', pier.x + pier.dx * k, 0, pier.z + pier.dz * k);
  },
  cameras: [
    ...(bridge
      ? [
          { name: 'bridge', yaw: 45, pitch: 34, zoom: 3.6, target: [bridge.x0 + bridge.dx * (bridge.n / 2 + 0.5) + 0.5, 1, bridge.z0 + bridge.dz * (bridge.n / 2 + 0.5) + 0.5] as [number, number, number] },
          { name: 'bridge-dusk', yaw: 135, pitch: 30, zoom: 3.2, target: [bridge.x0 + bridge.dx * (bridge.n / 2 + 0.5) + 0.5, 1, bridge.z0 + bridge.dz * (bridge.n / 2 + 0.5) + 0.5] as [number, number, number], time: 'dusk' as const },
        ]
      : []),
    { name: 'overview', yaw: 45, pitch: 35, zoom: 1.25, target: mid },
    ...(pier ? [{ name: 'pier', yaw: 45, pitch: 32, zoom: 3.6, target: [pier.x + pier.dx * 2 + 0.5, 0.5, pier.z + pier.dz * 2 + 0.5] as [number, number, number] }] : []),
  ],
  expect(plan, _dressing, check) {
    check.ok(bridge !== null && pier !== null, 'a crossing and a pier site');
    if (!bridge || !pier) return;
    check.role(bridge.x0 + bridge.dx, 0, bridge.z0 + bridge.dz, 'stone-bridge');
    check.role(pier.x + pier.dx, 0, pier.z + pier.dz, 'pier');
    const roles = new Set([...plan.roles.values()].map((r) => r.role));
    check.ok(roles.has('willow'), 'a willow on a river bank (a starting tree beside the river)');
  },
});
