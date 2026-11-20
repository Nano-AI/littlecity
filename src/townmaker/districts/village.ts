// Village and pleasure-town pieces: a village green between two rows of
// cottages (U15, maypole), a farmstead (a barn by its field, R-H18, and the
// farmhouse), an orchard (U18: trees in rows two apart), a smithy (a
// one-storey house against a short tower, R-H19), a schoolhouse with its
// fenced yard (R-H21), a park with a bandstand (R-M11 on garden), and
// playing fields (Field floor, R-G03: the shape decides the game).

import { columnIndex } from '@/core/grid';
import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, fromSquare, rectFlat, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';

/** Searches the island for a flat, free local rectangle (with a margin), scored by distance from the square. */
function place(town: Town, name: string, u1: number, v1: number, near: number, minD = 5, turns: readonly (0 | 1 | 2 | 3)[] = [0, 1, 2, 3]) {
  const { g, site } = town;
  return search(g, name, (f) => {
    if (!fits(g, f, 0, 0, u1, v1)) return null;
    const h = rectFlat(g, f, 0, 0, u1, v1);
    if (h < 0) return null;
    if (site.waterDist[columnIndex(f.x(u1 >> 1, v1 >> 1), f.z(u1 >> 1, v1 >> 1))]! < 2) return null;
    const d = fromSquare(town, f.x(u1 >> 1, v1 >> 1), f.z(u1 >> 1, v1 >> 1));
    if (d < minD) return null;
    return { score: Math.abs(d - near), data: h };
  }, { turns });
}

/**
 *   u: 0 1 2 3 4 5 6 7
 *   v=0  = = = = = = = =       a lane behind the north row
 *   v=1  = H . H . H . .       cottages facing south across the green
 *   v=2  =                     the green (grass), a tree on it
 *   …    =
 *   v=6  =
 *   v=7  = H . H . H . .       cottages facing north
 *   v=8  = = = = = = = =
 */
export function buildVillageGreen(town: Town, near = 9): boolean {
  const { g } = town;
  const found = place(town, 'green', 7, 8, near, 6);
  if (!found) return false;
  const f = found.frame, h = found.data;
  const V = new Local(g, f);
  const d = startDistrict(town, 'village-green', f.x(4, 4), f.z(4, 4));
  V.claim(0, 0, 7, 8, CLAIM.built);
  for (let v = 0; v <= 8; v++) pave(g, f.x(0, v), f.z(0, v));
  for (let u = 1; u <= 7; u++) {
    pave(g, f.x(u, 0), f.z(u, 0));
    pave(g, f.x(u, 8), f.z(u, 8));
  }
  for (const u of [1, 3, 5]) {
    V.house(u, 1, u, 1, 1 + (g.chance(0.5, 'green-n', u) ? 1 : 0), `green-n${u}`);
    V.house(u, 7, u, 7, 1 + (g.chance(0.5, 'green-s', u) ? 1 : 0), `green-s${u}`);
  }
  V.put('tree', 6, h, 4, 0);
  V.way(d, 0, 0);
  V.way(d, 0, 8);
  return true;
}

/**
 * A farmstead: a long one-storey barn by its field, the farmhouse beside it,
 * a lane a cell off (a barn wants no street at its walls).
 *   u: 0 1 2 3 4 5 6 7 8
 *   v=0  B B B B . g g g g      B barn (4 × 2), g field (garden)
 *   v=1  B B B B . g g g g
 *   v=2  . . . . . g g g g
 *   v=3  F F . . . . . . .      F farmhouse (2 storeys)
 *   v=4  . . . . . . . . .
 *   v=5  = = = = = = = = =      the lane
 */
export function buildBarn(town: Town, n: number, near = 14): boolean {
  const { g } = town;
  const found = place(town, `barn${n}`, 8, 5, Math.max(near, 16), 16);
  if (!found) return false;
  const f = found.frame, h = found.data;
  const B = new Local(g, f);
  const d = startDistrict(town, `farm${n}`, f.x(4, 2), f.z(4, 2));
  B.claim(0, 0, 8, 4, CLAIM.built);
  // A barn stands off the road: no street may come up to its walls.
  B.claim(-1, -1, 4, 2, CLAIM.keep);
  for (let u = 0; u <= 8; u++) pave(g, f.x(u, 5), f.z(u, 5));
  for (let v = 0; v <= 2; v++) for (let u = 4; u <= 7; u++) B.floor('garden', u, v, h);
  B.house(0, 0, 3, 1, 1, `barn${n}`);
  B.house(0, 3, 1, 3, 2, `farmhouse${n}`);
  if (g.chance(0.5, 'farm-tree', n)) B.put('tree', 3, h, 3, 0);
  B.way(d, 0, 5);
  return true;
}

/** An orchard: twelve trees in rows two apart each way, on grass, a lane along it. */
export function buildOrchard(town: Town, n: number, near = 13): boolean {
  const { g } = town;
  const found = place(town, `orchard${n}`, 6, 5, near, 7);
  if (!found) return false;
  const f = found.frame, h = found.data;
  const O = new Local(g, f);
  const d = startDistrict(town, `orchard${n}`, f.x(3, 2), f.z(3, 2));
  O.claim(0, 0, 6, 4, CLAIM.built);
  for (let v = 0; v <= 4; v += 2) for (let u = 0; u <= 6; u += 2) O.put('tree', u, h, v, 0);
  for (let u = 0; u <= 6; u++) pave(g, f.x(u, 5), f.z(u, 5));
  O.way(d, 0, 5);
  return true;
}

/** A smithy: a one-storey house against a tower two high (its forge chimney), on a street near the square. */
export function buildSmithy(town: Town, near = 7): boolean {
  const { g } = town;
  const found = place(town, 'smithy', 2, 2, near, 4);
  if (!found) return false;
  const f = found.frame, h = found.data;
  const S = new Local(g, f);
  const d = startDistrict(town, 'smithy', f.x(1, 0), f.z(1, 0));
  S.claim(0, 0, 2, 1, CLAIM.built);
  S.house(1, 0, 2, 0, 1, 'smithy');
  S.stack('tower', 0, 0, 2, S.color('tower', [[0, h, 0]], 'forge'));
  for (let u = 0; u <= 2; u++) pave(g, f.x(u, 2), f.z(u, 2));
  S.way(d, 0, 2);
  return true;
}

/**
 * A schoolhouse: a one-storey house on a street with a fenced yard beside
 * it, and a little court (a 3 × 3 field: basketball) in the yard's corner.
 *   u: 0 1 2 3 4 5
 *   v=0  S S | y y y |      S school, y yard (fenced round)
 *   v=1  . . | y y y |
 *   v=2  . . | y y y |
 *   v=3  = = = = = =        the street
 */
export function buildSchool(town: Town, near = 9): boolean {
  const { g } = town;
  const found = place(town, 'school', 5, 3, near, 5);
  if (!found) return false;
  const f = found.frame, h = found.data;
  const S = new Local(g, f);
  const d = startDistrict(town, 'school', f.x(1, 0), f.z(1, 0));
  S.claim(0, 0, 5, 2, CLAIM.built);
  for (let u = 0; u <= 5; u++) pave(g, f.x(u, 3), f.z(u, 3));
  S.house(0, 0, 1, 0, 1, 'school');
  for (let v = 0; v <= 2; v++) for (let u = 3; u <= 5; u++) S.floor('field', u, v, h);
  for (let u = 3; u <= 5; u++) {
    S.edge(u, h, 0, 0, 'fence');
    S.edge(u, h, 2, 2, 'fence');
  }
  for (let v = 0; v <= 2; v++) {
    S.edge(3, h, v, 3, 'fence');
    S.edge(5, h, v, 1, 'fence');
  }
  S.way(d, 0, 3);
  return true;
}

/**
 * Playing fields (R-G03: the shape decides the game), each its own ground
 * with a street along it, as room allows: a big one (a football pitch or a
 * croquet lawn), a long one (a tennis court, or a running track with a boules
 * court beside it), and a square one (a bowling green, or a kickabout green).
 */
export function buildFields(town: Town, near = 11): boolean {
  const { g } = town;
  // Each ground: [width, depth, cells as [u0, v0, u1, v1] rectangles of field].
  const grounds: [number, number, [number, number, number, number][]][] = [
    g.chance(0.5, 'fields-big') ? [4, 6, [[0, 0, 3, 5]]] : [4, 5, [[0, 0, 3, 4]]],
    g.chance(0.5, 'fields-long') ? [2, 5, [[0, 0, 1, 4]]] : [3, 6, [[0, 0, 0, 5], [2, 0, 2, 2]]],
    g.chance(0.5, 'fields-square') ? [4, 4, [[0, 0, 3, 3]]] : [2, 2, [[0, 0, 1, 1]]],
  ];
  let made = 0;
  for (const [i, [w, dd, rects]] of grounds.entries()) {
    const found = place(town, `ground${i}`, w - 1, dd, near + i * 2, 6);
    if (!found) continue;
    const f = found.frame, h = found.data;
    const P = new Local(g, f);
    const d = startDistrict(town, made === 0 ? 'fields' : `fields${i}`, f.x(w >> 1, dd >> 1), f.z(w >> 1, dd >> 1));
    P.claim(0, 0, w - 1, dd - 1, CLAIM.built);
    for (const [u0, v0, u1, v1] of rects) for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) P.floor('field', u, v, h);
    for (let u = 0; u < w; u++) pave(g, f.x(u, dd), f.z(u, dd));
    P.way(d, 0, dd);
    made++;
  }
  return made > 0;
}

/** A park: a 5 × 5 lawn with a bandstand in the middle (marble on four pillars on the garden), trees at its corners. */
export function buildPark(town: Town, near = 10): boolean {
  const { g } = town;
  const found = place(town, 'park', 4, 5, near, 5);
  if (!found) return false;
  const f = found.frame, h = found.data;
  const P = new Local(g, f);
  const d = startDistrict(town, 'park', f.x(2, 2), f.z(2, 2));
  P.claim(0, 0, 4, 4, CLAIM.built);
  for (let v = 0; v <= 4; v++) for (let u = 0; u <= 4; u++) P.floor('garden', u, v, h);
  const color = P.color('marble', [[1, h + 2, 1]], 'bandstand');
  for (const [u, v] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) {
    P.put('pillar', u, h, v, 0);
    P.put('pillar', u, h + 1, v, 0);
  }
  for (const [u, v] of [[1, 1], [2, 1], [1, 2], [2, 2]] as const) P.put('marble', u, h + 2, v, color);
  for (const [u, v] of [[0, 0], [4, 0], [0, 4], [4, 4]] as const) P.put('tree', u, h, v, 0);
  for (let u = 0; u <= 4; u++) pave(g, f.x(u, 5), f.z(u, 5));
  P.way(d, 0, 5);
  return true;
}

/** A folly tower: the Light piece far inland (six or more from any water), a belvedere on top for the view. */
export function buildFollyTower(town: Town): boolean {
  const { g, site } = town;
  const found = search(g, 'folly-tower', (f) => {
    if (!fits(g, f, 0, 0, 0, 1)) return null;
    const i = columnIndex(f.ox, f.oz);
    if (site.waterDist[i]! < 8 || g.h(f.ox, f.oz) === 0) return null;
    if (Math.abs(g.h(f.x(0, 1), f.z(0, 1)) - g.h(f.ox, f.oz)) > 1) return null;
    return { score: -g.h(f.ox, f.oz) * 2 + Math.abs(fromSquare(town, f.ox, f.oz) - 12) * 0.3, data: null };
  }, { turns: [0, 1, 2, 3] });
  if (!found) return false;
  const f = found.frame;
  const T = new Local(g, f);
  const d = startDistrict(town, 'folly-tower', f.ox, f.oz);
  T.claim(0, 0, 0, 0, CLAIM.built);
  T.claim(-1, -1, 1, 1, CLAIM.keep);
  T.stack('lighthouse', 0, 0, 5, 0);
  if (pave(g, f.x(0, 1), f.z(0, 1))) T.way(d, 0, 1);
  return true;
}
