// Second-round signatures for the four characters that read weakest: the
// farming village's small centre and its vegetable plots, the river town's
// built-up banks, the hill town's terraced rows, the market town's great
// market. See README.md.

import { columnIndex, key } from '@/core/grid';
import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, fromSquare, rectFlat, rectFree, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';
import { D4 } from '../site';

// ───────────────────────────────────────────────────────── farming ──

/**
 * The village centre: a small green-side plaza with a well, the inn on it,
 * a few cottages, no town hall or clock tower (a village, not a town).
 *   u: 0 1 2 3 4
 *   v=0  I I I . .        I inn (3 × 1, two storeys: six cells on a square)
 *   v=1  = P P P =        P plaza (3 × 3), the well in the middle
 *   v=2  = P W P =
 *   v=3  = P P P =
 *   v=4  = = = = =
 */
export function buildVillageCentre(town: Town): boolean {
  const { g, site } = town;
  const found = search(g, 'village-centre', (f) => {
    if (!fits(g, f, 0, 0, 4, 4)) return null;
    const h = rectFlat(g, f, 0, 0, 4, 4);
    if (h < 0) return null;
    const cx = f.x(2, 2), cz = f.z(2, 2);
    if (site.waterDist[columnIndex(cx, cz)]! < 3) return null;
    // Near the middle of the island, so the farmland can lie all round it.
    return { score: Math.abs(cx - site.centre[0]) + Math.abs(cz - site.centre[1]), data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const V = new Local(g, f);
  town.square = { x: f.x(2, 2), z: f.z(2, 2), h };
  const d = startDistrict(town, 'square', town.square.x, town.square.z);
  V.claim(0, 0, 4, 4, CLAIM.built);
  for (let v = 1; v <= 3; v++) for (let u = 1; u <= 3; u++) V.floor('plaza', u, v, h);
  for (let v = 1; v <= 4; v++) {
    pave(g, f.x(0, v), f.z(0, v));
    pave(g, f.x(4, v), f.z(4, v));
  }
  for (let u = 1; u <= 3; u++) pave(g, f.x(u, 4), f.z(u, 4));
  V.house(0, 0, 2, 0, 2, 'village-inn');
  if (!town.pumps) V.put('fountain', 2, h, 2);
  V.put('tree', 3, h, 3, 0);
  for (const [u, v] of [[0, 4], [4, 4], [4, 1]] as const) V.way(d, u, v);
  return true;
}

/**
 * A vegetable plot by its farmhouse: a garden 4 × 2 against a two-storey
 * cottage (a kitchen garden, R-G01: next to a house and under nine cells),
 * fenced on its open sides, a lane along it.
 */
export function buildVegPlot(town: Town, n: number): boolean {
  const { g } = town;
  const found = search(g, `veg-plot${n}`, (f) => {
    if (!fits(g, f, 0, 0, 4, 2)) return null;
    const h = rectFlat(g, f, 0, 0, 4, 2);
    if (h < 0) return null;
    const d = fromSquare(town, f.x(2, 1), f.z(2, 1));
    if (d < 8) return null;
    return { score: Math.abs(d - 12), data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const P = new Local(g, f);
  const d = startDistrict(town, `veg-plot${n}`, f.x(2, 1), f.z(2, 1));
  P.claim(0, 0, 4, 1, CLAIM.built);
  P.house(0, 0, 0, 0, 2, `veg-farmhouse${n}`);
  for (let v = 0; v <= 1; v++) for (let u = 1; u <= 4; u++) P.floor('garden', u, v, h);
  for (let u = 1; u <= 4; u++) P.edge(u, h, 0, 0, 'fence');
  for (let v = 0; v <= 1; v++) P.edge(4, h, v, 1, 'fence');
  for (let u = 0; u <= 4; u++) pave(g, f.x(u, 2), f.z(u, 2));
  P.way(d, 0, 2);
  return true;
}

// ─────────────────────────────────────────────────────────── river ──

/**
 * The river front: along both banks for the river's whole length, a walk on
 * the bank and two-storey houses one cell back facing it, every other
 * cell (so they stand apart, with laundry and gardens between).
 */
export function buildRiverFront(town: Town): boolean {
  const { g, site } = town;
  const banks: [number, number, number, number][] = [];
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      if (g.h(x, z) === 0 || !g.free(x, z) || g.groundTaken(x, z)) continue;
      for (const [dx, dz] of D4) {
        const wx = x + dx, wz = z + dz;
        if (!g.inMap(wx, wz) || !site.river[columnIndex(wx, wz)] || g.world.blocks.has(key(wx, 0, wz))) continue;
        banks.push([x, z, dx, dz]);
        break;
      }
    }
  }
  if (banks.length < 8) return false;
  const d = startDistrict(town, 'river-front', banks[banks.length >> 1]![0], banks[banks.length >> 1]![1]);
  let houses = 0;
  for (const [x, z, dx, dz] of banks) {
    if (!g.free(x, z) || g.groundTaken(x, z)) continue;
    const h = g.h(x, z);
    // The walk on the bank.
    if (!pave(g, x, z)) continue;
    // A house one cell back, facing the walk.
    const bx = x - dx, bz = z - dz;
    if ((x + z) % 2 !== 0 || !g.free(bx, bz) || g.groundTaken(bx, bz) || g.h(bx, bz) !== h) continue;
    if (g.world.floors.has(key(bx, h, bz))) continue;
    const c = g.colorFor('house', [[bx, h, bz], [bx, h + 1, bz]], `river-house${houses}`);
    g.put('house', bx, h, bz, c);
    g.put('house', bx, h + 1, bz, c);
    g.mark(bx, bz, CLAIM.built);
    houses++;
  }
  // Join the walk to the town at a few points along it.
  for (let i = 0; i < banks.length; i += Math.max(1, banks.length >> 2)) d.ways.push([banks[i]![0], banks[i]![1]]);
  return houses > 0;
}

// ──────────────────────────────────────────────────────────── hill ──

/**
 * A terraced row: four to six houses side by side along a terrace edge, each
 * standing against the terrace one level up behind it, a street along their
 * fronts. Several, at different heights, make the town climb the hill.
 */
export function buildTerraceRow(town: Town, n: number): boolean {
  const { g } = town;
  let found = null;
  let len = 0;
  for (const L of [6, 5, 4]) {
    found = search(g, `terrace-row${n}-${L}`, (f) => {
      const h = rectFlat(g, f, 0, 0, L - 1, 1);
      if (h < 1) return null;
      if (!rectFree(g, f, 0, 0, L - 1, 1)) return null;
      // The terrace behind: rising all along (a step, or a face it stands against); or, high on the
      // hill, open shelf ground.
      let rise = 0;
      for (let u = 0; u < L; u++) if (g.h(f.x(u, -1), f.z(u, -1)) > h) rise++;
      if (rise < L && h < town.site.maxH - 3) return null;
      if (!rectFree(g, f, -1, 0, L, 2, CLAIM.built | CLAIM.keep)) return null;
      const d = fromSquare(town, f.x(L >> 1, 0), f.z(L >> 1, 0));
      // Higher terraces first: the town climbs.
      return { score: -h * 3 + d * 0.3 - (rise === L ? 4 : 0), data: h };
    });
    if (found) {
      len = L;
      break;
    }
  }
  if (!found) return false;
  const f = found.frame;
  const T = new Local(g, f);
  const d = startDistrict(town, `terrace-row${n}`, f.x(len >> 1, 0), f.z(len >> 1, 0));
  T.claim(0, 0, len - 1, 0, CLAIM.built);
  for (let u = 0; u < len; u++) T.house(u, 0, u, 0, 2 + (u % 3 === 1 ? 1 : 0), `terrace${n}-${u}`);
  for (let u = -1; u <= len; u++) pave(g, f.x(u, 1), f.z(u, 1));
  T.way(d, -1, 1);
  T.way(d, len, 1);
  return true;
}

// ────────────────────────────────────────────────────────── market ──

/**
 * The great market: a plaza 9 × 6 with two rows of stalls, a market cross
 * among them (D37), and along its north side a market hall: a long marble
 * roof on a row of pillars a cell off the plaza (a stoa, R-M12, with goods
 * in its back bays). Streets lead in at its corners.
 *   u:  0 1 2 3 4 5 6 7 8
 *   v=-3     o o o o o o o        the market hall (marble 2 deep on pillars)
 *   v=-2     o o o o o o o
 *   v=-1 . . . . . . . . .        a cell between
 *   v=0  P P P P P P P P P
 *   v=1  P s P s P s P s P        s stalls
 *   v=2  P P P P X P P P P        X market cross
 *   v=3  P P P P P P P P P
 *   v=4  P s P s P s P s P
 *   v=5  P P P P P P P P P
 */
export function buildGreatMarket(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'great-market', (f) => {
    if (!fits(g, f, 0, -3, 8, 5)) return null;
    const h = rectFlat(g, f, 0, -3, 8, 5);
    if (h < 0) return null;
    const d = fromSquare(town, f.x(4, 2), f.z(4, 2));
    if (d < 8) return null;
    return { score: Math.abs(d - 10), data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const M = new Local(g, f);
  const d = startDistrict(town, 'great-market', f.x(4, 2), f.z(4, 2));
  M.claim(0, -3, 8, 5, CLAIM.built);
  for (let v = 0; v <= 5; v++) for (let u = 0; u <= 8; u++) M.floor('plaza', u, v, h);
  for (const v of [1, 4]) for (const u of [1, 3, 5, 7]) M.put('stall', u, h, v);
  M.put('marble', 4, h, 2, 3);
  const hall = M.color('marble', [[1, h + 2, -2]], 'market-hall');
  for (let u = 1; u <= 7; u++) M.stack('pillar', u, -2, 2, 0);
  for (let u = 1; u <= 7; u++) for (const v of [-2, -3]) M.put('marble', u, h + 2, v, hall);
  for (const [u, v] of [[-1, 0], [9, 0], [-1, 5], [9, 5]] as const) if (pave(g, f.x(u, v), f.z(u, v))) M.way(d, u, v);
  return true;
}
