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

import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, rectFlat, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';

export function buildSquare(town: Town): boolean {
  const { g, site } = town;
  for (const k of [5, 4, 3]) {
    const found = search(g, `square${k}`, (f) => {
      if (!fits(g, f, -2, 0, k + 1, k + 1)) return null;
      const h = rectFlat(g, f, -2, 0, k + 1, k + 1);
      if (h < 0) return null;
      const [cx, cz] = [f.x((k + 1) / 2, (k + 1) / 2), f.z((k + 1) / 2, (k + 1) / 2)];
      const water = site.waterDist[Math.round(cx) + Math.round(cz) * 48]!;
      if (water < 4) return null;
      const d = Math.abs(cx - site.centre[0]) + Math.abs(cz - site.centre[1]);
      // Facing the default camera (from the south-east) with its open side: tall shops to the north and west.
      return { score: d + (h > 2 ? 4 : 0) + (f.r === 0 ? 0 : 4), data: h };
    });
    if (!found) continue;
    const f = found.frame;
    const L = new Local(g, f);
    const h = found.data;
    const mid = Math.ceil(k / 2);
    town.square = { x: f.x(mid, mid), z: f.z(mid, mid), h };
    const d = startDistrict(town, 'square', town.square.x, town.square.z);
    L.claim(-2, 0, k + 1, k + 1, CLAIM.built);
    L.claim(-3, -1, k + 2, k + 2, CLAIM.open);

    // The ground: the plaza and the paths round it.
    for (let v = 1; v <= k; v++) for (let u = 1; u <= k; u++) L.floor('plaza', u, v, h);
    for (let u = 0; u <= k + 1; u++) if (u !== 2) pave(g, f.x(u, k + 1), f.z(u, k + 1));
    for (const [u, v] of [[1, 0], [k + 1, 0], [k + 1, 1], [0, 1]] as const) pave(g, f.x(u, v), f.z(u, v));
    for (let v = 2; v <= Math.min(4, k); v++) L.floor('garden', -2, v, h);

    // Shops along the north side and down the east side; storeys vary, colours never match a neighbour.
    for (let u = 2; u <= k; u++) L.house(u, 0, u, 0, 2 + (g.chance(0.35, 'shop-n', u) ? 1 : 0), `shop-n${u}`);
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
    // The fountain, stalls and planter trees.
    L.put('fountain', mid, h, mid);
    L.put('stall', k, h, 2);
    L.put('stall', k, h, Math.max(3, k - 1));
    L.put('tree', 1, h, k);
    L.put('tree', 0, h, k);
    // A statue on its plinth by the square.
    L.put('marble', 2, h, k + 1, 1);

    for (const [u, v] of [[1, -1], [k + 1, -1], [k + 2, 1], [-1, k + 1], [k + 2, k + 1], [-1, 1]] as const) {
      if (pave(g, f.x(u, v), f.z(u, v))) L.way(d, u, v);
    }
    return true;
  }
  return false;
}
