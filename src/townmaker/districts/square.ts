// The market square: a plaza (5 × 5 where it fits) with a tiered fountain,
// market stalls and planter trees; shops round two sides, an inn with a
// loggia over its garden (and a flower stall in it) on the third, a clock
// tower in the corner, a statue on a plinth by the open side where the
// high street runs.
//
//   v=0     T  .  S  S  S  S  .        T clock tower (touches no house)
//   v=1     .  P  P  P  P  P  .        S shop, I inn, P plaza, . path
//   v=2   g I  P  P  P  P  P  S        g garden under the inn's loggia
//   v=3   g I  P  P  F  P  P  S        F fountain
//   v=4   g I  P  P  P  P  P  S
//   v=5     t  P  P  P  P  P  S        t planter tree
//   v=6     .  .  M  .  .  .  .        M plinth with a statue
//        u=-2 0  1  2  3  4  5  6

import { key } from '@/core/grid';
import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, rectFlat, startDistrict, type Town, Local } from '../town';
import { canPave, pave } from '../route';

export function buildSquare(town: Town): boolean {
  const { g, site } = town;
  // The biggest square that fits away from the water; then, on a small or broken island, nearer it.
  for (const [k, shore] of [[5, 4], [4, 4], [5, 2], [4, 2], [3, 2], [3, 1]] as const) {
    // The town hall along the north side: k − 1 wide, deep enough for a footprint of 8.
    const hd = Math.ceil(8 / (k - 1));
    const top = 1 - hd;
    const found = search(g, `square${k}-${shore}`, (f) => {
      if (!fits(g, f, -3, top - 1, k + 2, k + 2, 1)) return null;
      const h = rectFlat(g, f, -2, top, k + 1, k + 1);
      if (h < 0) return null;
      const [cx, cz] = [f.x((k + 1) / 2, (k + 1) / 2), f.z((k + 1) / 2, (k + 1) / 2)];
      const water = site.waterDist[Math.round(cx) + Math.round(cz) * 48]!;
      if (water < shore) return null;
      const d = Math.abs(cx - site.centre[0]) + Math.abs(cz - site.centre[1]);
      // Facing the default camera (from the south-east) with its open side: the hall to the north, the inn west.
      // Near a river (a crossing, a waterfront) is the best place for a square.
      const rd = site.riverDist[Math.round(cx) + Math.round(cz) * 48]!;
      const river = rd >= 4 && rd <= 8 ? -6 : 0;
      return { score: d + (h > 2 ? 4 : 0) + (f.r === 0 ? 0 : 4) + river, data: h };
    });
    if (!found) continue;
    const f = found.frame;
    const L = new Local(g, f);
    const h = found.data;
    const mid = Math.ceil(k / 2);
    town.square = { x: f.x(mid, mid), z: f.z(mid, mid), h };
    const d = startDistrict(town, 'square', town.square.x, town.square.z);
    L.claim(-2, top, k + 1, k + 1, CLAIM.built);

    // The ground: the plaza, the paths round it, and the ring road one step out.
    for (let v = 1; v <= k; v++) for (let u = 1; u <= k; u++) L.floor('plaza', u, v, h);
    for (let u = 0; u <= k + 1; u++) if (u !== 2) pave(g, f.x(u, k + 1), f.z(u, k + 1));
    for (let v = top - 1; v <= 1; v++) {
      pave(g, f.x(1, v), f.z(1, v));
      pave(g, f.x(k + 1, v), f.z(k + 1, v));
    }
    for (let u = -3; u <= 0; u++) pave(g, f.x(u, 1), f.z(u, 1));
    ringRoad(town, L, -3, top - 1, k + 2, k + 2);
    for (let v = 2; v <= Math.min(4, k); v++) L.floor('garden', -2, v, h);

    // The town hall on the north side, shops down the east side; colours never match a neighbour.
    L.house(2, top, k, 0, 2, 'town-hall');
    for (let v = 2; v <= k; v++) L.house(k + 1, v, k + 1, v, 1 + (g.chance(0.3, 'shop-e', v) ? 1 : 0), `shop-e${v}`);
    // The inn, facing the square, two storeys.
    const innTo = Math.min(4, k);
    L.house(-1, 2, 0, innTo, 2, 'inn');
    // Its loggia: an arch hanging off the upper storey over the garden.
    L.put('arch', -2, h + 1, 3);
    L.put('stall', -2, h, Math.min(4, k));
    for (let v = 2; v <= innTo; v++) L.edge(-2, h, v, 3, 'fence');
    // The clock tower in the corner.
    L.stack('tower', 0, 0, 5, L.color('tower', [[0, h, 0]], 'clock'));
    // The fountain (a town without fountains draws water at a pump instead), stalls and planter trees.
    if (!town.pumps) L.put('fountain', mid, h, mid);
    L.put('stall', k, h, 2);
    L.put('stall', k, h, Math.max(3, k - 1));
    L.put('tree', 1, h, k);
    L.put('tree', 0, h, k);
    // Corner houses inside the ring road's corners (streets on two sides: U10 corner turrets).
    for (const [u, v] of [[-2, top], [-2, k + 1]] as const) {
      if (!g.groundTaken(f.x(u, v), f.z(u, v)) && !g.world.floors.has(key(f.x(u, v), h, f.z(u, v)))) L.house(u, v, u, v, 2 + (g.chance(0.4, 'corner', u, v) ? 1 : 0), `corner${v}`);
    }
    // A statue on its plinth by the square.
    L.put('marble', 2, h, k + 1, 1);

    for (const [u, v] of [[-3, top - 1], [k + 2, top - 1], [-3, k + 2], [k + 2, k + 2]] as const) {
      if (g.claimed(f.x(u, v), f.z(u, v), CLAIM.street)) L.way(d, u, v);
    }
    return true;
  }
  return false;
}

/**
 * The small square, for an island with no room for the big one (small,
 * steep or cut up by rivers): a 3 × 3 plaza with its fountain and a stall,
 * the town hall (4 × 2) along the north side, shops down the east side, the
 * clock tower at the south-west corner, streets round it.
 *
 *   v=-1   H H H H          H town hall
 *   v=0    H H H H
 *   v=1    . P P P S        P plaza, S shop, . path
 *   v=2    . P F P S
 *   v=3    . P P P S
 *   v=4    T . . . .        T clock tower
 */
export function buildSmallSquare(town: Town): boolean {
  const { g, site } = town;
  const found = search(g, 'square-small', (f) => {
    if (!fits(g, f, 0, -1, 4, 4, 0)) return null;
    const h = rectFlat(g, f, 0, -1, 4, 4);
    if (h < 0) return null;
    const cx = f.x(2, 2), cz = f.z(2, 2);
    const d = Math.abs(cx - site.centre[0]) + Math.abs(cz - site.centre[1]);
    const rd = site.riverDist[cx + cz * 48]!;
    return { score: d + (h > 2 ? 4 : 0) + (f.r === 0 ? 0 : 3) + (rd >= 3 && rd <= 7 ? -6 : 0), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const L = new Local(g, f);
  const h = found.data;
  town.square = { x: f.x(2, 2), z: f.z(2, 2), h };
  const d = startDistrict(town, 'square', town.square.x, town.square.z);
  L.claim(0, -1, 4, 4, CLAIM.built);
  for (let v = 1; v <= 3; v++) for (let u = 1; u <= 3; u++) L.floor('plaza', u, v, h);
  for (let v = 1; v <= 3; v++) pave(g, f.x(0, v), f.z(0, v));
  for (let u = 1; u <= 4; u++) pave(g, f.x(u, 4), f.z(u, 4));
  L.house(0, -1, 3, 0, 2, 'town-hall');
  for (let v = 1; v <= 3; v++) L.house(4, v, 4, v, 1 + (g.chance(0.4, 'small-shop', v) ? 1 : 0), `small-shop${v}`);
  L.stack('tower', 0, 4, 4, L.color('tower', [[0, h, 4]], 'clock'));
  if (!town.pumps) L.put('fountain', 2, h, 2);
  L.put('stall', 3, h, 1);
  L.put('tree', 1, h, 3, 0);
  for (const [u, v] of [[0, 1], [4, 4], [0, 3]] as const) L.way(d, u, v);
  return true;
}

/** A street round the outside of a local rectangle, where the ground allows (steps of one level at most). */
function ringRoad(town: Town, L: Local, u0: number, v0: number, u1: number, v1: number): void {
  const { g } = town;
  const cells: [number, number][] = [];
  for (let u = u0; u <= u1; u++) cells.push([u, v0]);
  for (let v = v0 + 1; v <= v1; v++) cells.push([u1, v]);
  for (let u = u1 - 1; u >= u0; u--) cells.push([u, v1]);
  for (let v = v1 - 1; v > v0; v--) cells.push([u0, v]);
  for (const [u, v] of cells) {
    const x = L.x(u, v), z = L.z(u, v);
    if (g.h(x, z) === 0 || !canPave(g, x, z)) continue;
    pave(g, x, z);
  }
}
