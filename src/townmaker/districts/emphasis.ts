// What makes a character unmistakable: its signature repeated across the
// town, not one showpiece. Woods and tree lines for every town; more quays
// for a harbour; a town wall with gates and towers for a castle town;
// colonnades, shrines and monuments for a marble city; market places for a
// market town; wheat farms for a farming village.

import { columnIndex, key } from '@/core/grid';
import { rand } from '@/core/rand';
import { TREE } from '@/style/ground';
import { CLAIM, type Grower } from '../grower';
import { search } from '../frame';
import { chebFromSquare, fits, fromSquare, rectFlat, rectFree, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';
import { D4 } from '../site';

function openWater(g: Grower, x: number, z: number): boolean {
  return g.inMap(x, z) && g.h(x, z) === 0 && !g.world.blocks.has(key(x, 0, z)) && !g.claimed(x, z, CLAIM.keep);
}
function seaBlockNear(g: Grower, x: number, z: number, r: number): boolean {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (g.inMap(x + dx, z + dz) && g.world.blocks.has(key(x + dx, 0, z + dz))) return true;
  return false;
}
/** Bare ground nothing uses: free, land, no block or floor on its top. */
function bare(g: Grower, x: number, z: number): boolean {
  if (!g.inMap(x, z) || g.h(x, z) === 0 || !g.free(x, z) || g.groundTaken(x, z)) return false;
  return !g.world.floors.has(key(x, g.h(x, z), z));
}

// ───────────────────────────────────────────────────────────── trees ──

/** Value noise in [0, 1) on a lattice of `size`: where the woods are. */
function woodsNoise(seed: number, x: number, z: number, size: number): number {
  const fx = x / size, fz = z / size;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const v = (a: number, b: number): number => rand(seed, 'townmaker', 'woods', a, b);
  const top = v(ix, iz) + (v(ix + 1, iz) - v(ix, iz)) * tx;
  const bot = v(ix, iz + 1) + (v(ix + 1, iz + 1) - v(ix, iz + 1)) * tx;
  return top + (bot - top) * tz;
}

/**
 * Woods: dense clumps of trees over the land the town left bare (five or
 * more touching trees make a grove, R-P01), thickest where the noise says
 * and away from the heart of the town; a tree here and there elsewhere.
 * `amount` 0 to 1 scales it by character. Trees never stand on a street or
 * beside a door (they keep a column off any building and street).
 */
export function buildWoods(town: Town, amount: number): void {
  const { g, site } = town;
  startDistrict(town, 'woods', town.square?.x ?? 24, town.square?.z ?? 24);
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      if (!bare(g, x, z)) continue;
      const i = columnIndex(x, z);
      const d = fromSquare(town, x, z);
      if (d < 7) continue;
      // Keep the cells round buildings and beside streets open (doors, yards, carts).
      let ok = true;
      for (const [dx, dz] of D4) {
        const nx = x + dx, nz = z + dz;
        if (!g.inMap(nx, nz)) continue;
        const b = g.block(nx, g.h(nx, nz), nz);
        if (b && b.kind !== 'tree') ok = false;
        if (g.claimed(nx, nz, CLAIM.street) && g.chance(0.75, 'woods-verge', x, z)) ok = false;
      }
      if (!ok) continue;
      const n = woodsNoise(g.seed, x, z, 7);
      const edge = Math.min(1, (d - 7) / 8);
      const p = n > 0.55 ? 0.85 * amount : n > 0.42 ? 0.35 * amount : 0.06 * amount;
      if (!g.chance(p * (0.5 + 0.5 * edge), 'woods', x, z)) continue;
      if (site.waterDist[i]! < 1) continue;
      if (g.put('tree', x, g.h(x, z), z, 0)) g.mark(x, z, CLAIM.built);
    }
  }
}

/**
 * Tree lines: a tree every other cell along the streets out of town (an
 * avenue, a lane between fields), on the bare verge; `chance` per cell.
 */
export function buildTreeLines(town: Town, chance: number, minD = 8): void {
  const { g } = town;
  startDistrict(town, 'tree-lines', town.square?.x ?? 24, town.square?.z ?? 24);
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      if (!g.claimed(x, z, CLAIM.street) || (x + z) % 2 !== 0) continue;
      if (fromSquare(town, x, z) < minD) continue;
      for (const [dx, dz] of D4) {
        const vx = x + dx, vz = z + dz;
        if (!bare(g, vx, vz) || g.h(vx, vz) !== g.h(x, z) || g.h(vx, vz) >= TREE.pineLevel + 4) continue;
        // Not where a door could want the verge: no house beside it.
        if (D4.some(([ax, az]) => g.block(vx + ax, g.h(vx, vz), vz + az)?.kind === 'house')) continue;
        if (!g.chance(chance, 'tree-line', vx, vz)) continue;
        if (g.put('tree', vx, g.h(vx, vz), vz, 0)) g.mark(vx, vz, CLAIM.built);
        break;
      }
    }
  }
}

// ───────────────────────────────────────────────────────── harbour ──

/**
 * Another quay along the coast, away from the docks there are: a berth of
 * eight where the sea is wide and open, else six, five or four docks; a
 * landing and promenade behind, a warehouse facing it across the harbour
 * street, a fish stall. Several of these make the waterfront the town.
 */
export function buildQuayStretch(town: Town, n: number): boolean {
  const { g } = town;
  const harbour = town.districts.find((d) => d.name === 'harbour');
  for (const len of [8, 6, 5, 4]) {
    const found = search(g, `quay-stretch${n}-${len}`, (f) => {
      for (let u = 0; u < len; u++) {
        const x = f.x(u, 0), z = f.z(u, 0);
        if (g.h(x, z) !== 1 || !g.free(x, z) || g.groundTaken(x, z)) return null;
        if (!openWater(g, f.x(u, 1), f.z(u, 1)) || !openWater(g, f.x(u, 2), f.z(u, 2))) return null;
      }
      if (len >= 8) for (let v = 3; v <= 4; v++) for (let u = -1; u <= len; u++) if (!openWater(g, f.x(u, v), f.z(u, v))) return null;
      if (seaBlockNear(g, f.x(0, 1), f.z(0, 1), 2) || seaBlockNear(g, f.x(len - 1, 1), f.z(len - 1, 1), 2)) return null;
      if (town.site.river[columnIndex(f.x(len >> 1, 2), f.z(len >> 1, 2))]) return null;
      const d = harbour ? Math.abs(f.ox - harbour.x) + Math.abs(f.oz - harbour.z) : fromSquare(town, f.ox, f.oz);
      if (d < 5) return null;
      return { score: d, data: len };
    });
    if (!found) continue;
    const f = found.frame;
    const Q = new Local(g, f);
    const d = startDistrict(town, `quay${n}`, f.x(len >> 1, 0), f.z(len >> 1, 0));
    for (let u = 0; u < len; u++) pave(g, f.x(u, 0), f.z(u, 0));
    for (let u = -1; u <= len; u++) if (g.h(f.x(u, -1), f.z(u, -1)) > 0) pave(g, f.x(u, -1), f.z(u, -1));
    Q.claim(0, 0, len - 1, 2, CLAIM.built);
    for (let u = 0; u < len; u++) Q.put('auto', u, 0, 1, 'auto');
    Q.put('stall', len - 1, 1, 0);
    if (rectFree(g, f, 1, -3, 3, -2) && rectFlat(g, f, 1, -3, 3, -2) === g.h(f.x(1, -1), f.z(1, -1))) {
      Q.claim(1, -3, 3, -2, CLAIM.built);
      Q.house(1, -3, 3, -2, 2, `quay-store${n}`);
    }
    Q.way(d, 0, 0);
    return true;
  }
  return false;
}

/** A fish market: a little plaza by the water with stalls on it (within reach of the docks: fish stalls). */
export function buildFishMarket(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'fish-market', (f) => {
    if (!fits(g, f, 0, 0, 2, 2)) return null;
    const h = rectFlat(g, f, 0, 0, 2, 2);
    if (h !== 1) return null;
    let docks = false;
    for (let dz = -3; dz <= 5; dz++) for (let dx = -3; dx <= 5; dx++) if (g.world.blocks.get(key(f.x(dx, dz), 0, f.z(dx, dz)))?.kind === 'dock' || g.world.blocks.get(key(f.x(dx, dz), 0, f.z(dx, dz)))?.kind === 'auto') docks = true;
    if (!docks) return null;
    return { score: fromSquare(town, f.ox, f.oz) * 0.2, data: h };
  }, { turns: [0] });
  if (!found) return false;
  const f = found.frame;
  const M = new Local(g, f);
  const d = startDistrict(town, 'fish-market', f.x(1, 1), f.z(1, 1));
  M.claim(0, 0, 2, 2, CLAIM.built);
  for (let v = 0; v <= 2; v++) for (let u = 0; u <= 2; u++) M.floor('plaza', u, v, 1);
  M.put('stall', 0, 1, 0);
  M.put('stall', 2, 1, 0);
  M.put('stall', 1, 1, 2);
  M.way(d, 1, 1);
  return true;
}

// ────────────────────────────────────────────────────────── castle ──

/**
 * The town wall: a ring of wall pieces round the heart of the town at
 * `radius` from the square, on the ground the town left free; where a
 * street crosses the line, an arch over it (a gateway, R-A04, with the wall
 * on both sides); towers at the corners and every few cells where nothing
 * else stands (castle turrets, touching the wall on two sides, R-T02).
 */
export function buildTownWall(town: Town, radius: number): boolean {
  const { g } = town;
  if (!town.square) return false;
  const { x: cx, z: cz } = town.square;
  startDistrict(town, 'town-wall', cx, cz - radius);
  const ring: [number, number][] = [];
  for (let x = cx - radius; x <= cx + radius; x++) ring.push([x, cz - radius]);
  for (let z = cz - radius + 1; z <= cz + radius; z++) ring.push([cx + radius, z]);
  for (let x = cx + radius - 1; x >= cx - radius; x--) ring.push([x, cz + radius]);
  for (let z = cz + radius - 1; z > cz - radius; z--) ring.push([cx - radius, z]);
  const wallAt = new Set<number>();
  const corners = new Set([columnIndex(cx - radius, cz - radius), columnIndex(cx + radius, cz - radius), columnIndex(cx + radius, cz + radius), columnIndex(cx - radius, cz + radius)].filter((i) => i >= 0));
  let walls = 0;
  // The wall pieces first.
  for (const [x, z] of ring) {
    if (!g.inMap(x, z) || g.h(x, z) === 0 || corners.has(columnIndex(x, z))) continue;
    if (!bare(g, x, z)) continue;
    if (g.put('wall', x, g.h(x, z), z, 0)) {
      g.mark(x, z, CLAIM.built);
      wallAt.add(columnIndex(x, z));
      walls++;
    }
  }
  if (walls < 8) return false;
  const isWall = (x: number, z: number): boolean => g.inMap(x, z) && wallAt.has(columnIndex(x, z));
  // Gates: an arch over each street crossing the line, between two wall pieces along it.
  for (let k = 0; k < ring.length; k++) {
    const [x, z] = ring[k]!;
    if (!g.inMap(x, z) || !g.claimed(x, z, CLAIM.street) || g.groundTaken(x, z)) continue;
    const [px, pz] = ring[(k + ring.length - 1) % ring.length]!;
    const [nx, nz] = ring[(k + 1) % ring.length]!;
    if (!isWall(px, pz) || !isWall(nx, nz)) continue;
    if (g.h(px, pz) !== g.h(x, z) || g.h(nx, nz) !== g.h(x, z)) continue;
    g.put('arch', x, g.h(x, z), z, 0);
  }
  // Towers at the corners, where nothing else stands and no house is beside (it would read as a steeple).
  const houseBeside = (x: number, z: number): boolean => D4.some(([dx, dz]) => {
    const b = g.block(x + dx, g.h(x, z), z + dz);
    return !!b && (b.kind === 'house' || b.kind === 'auto');
  });
  for (const i of corners) {
    const x = i % 48, z = Math.floor(i / 48);
    if (!bare(g, x, z) || houseBeside(x, z)) continue;
    g.stack('tower', x, z, 3, g.colorFor('tower', [[x, g.h(x, z), z]], 'wall-tower'));
    g.mark(x, z, CLAIM.built);
  }
  return true;
}

/** A tower on the high ground, walled round on two sides: a fortified lookout (castle turret). */
export function buildWallTower(town: Town, n: number): boolean {
  const { g, site } = town;
  const found = search(g, `wall-tower${n}`, (f) => {
    if (!fits(g, f, -1, -1, 1, 1, 2)) return null;
    const h = rectFlat(g, f, -1, -1, 1, 1);
    if (h < 2 || site.waterDist[columnIndex(f.ox, f.oz)]! < 2) return null;
    const d = fromSquare(town, f.ox, f.oz);
    if (d < 8) return null;
    return { score: -h * 2 + Math.abs(d - 13) * 0.3, data: h };
  }, { turns: [0] });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const T = new Local(g, f);
  const d = startDistrict(town, `wall-tower${n}`, f.ox, f.oz);
  T.claim(-1, -1, 1, 1, CLAIM.built);
  T.stack('tower', 0, 0, 4, T.color('tower', [[0, h, 0]], `wall-tower${n}`));
  for (const [u, v] of [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]] as const) T.put('wall', u, h, v, 0);
  if (pave(g, f.x(0, 2), f.z(0, 2))) T.way(d, 0, 2);
  return true;
}

// ────────────────────────────────────────────────────────── marble ──

/**
 * A colonnade along a street: pillars two high on the free cells beside a
 * straight stretch of street, a marble beam over them (a long temple shape:
 * R-M01, or R-M12's stoa beside a plaza).
 */
export function buildColonnade(town: Town, n: number): boolean {
  const { g } = town;
  const len = 6;
  const found = search(g, `colonnade${n}`, (f) => {
    for (let u = 0; u < len; u++) {
      if (!g.claimed(f.x(u, 0), f.z(u, 0), CLAIM.street)) return null;
    }
    if (!rectFree(g, f, 0, 1, len - 1, 1, CLAIM.built | CLAIM.keep | CLAIM.street)) return null;
    const h = rectFlat(g, f, 0, 0, len - 1, 1);
    if (h < 0) return null;
    if (!rectFree(g, f, 0, 2, len - 1, 2, CLAIM.built | CLAIM.keep)) return null;
    const d = fromSquare(town, f.ox, f.oz);
    if (d < 4) return null;
    return { score: d, data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const C = new Local(g, f);
  startDistrict(town, `colonnade${n}`, f.x(len >> 1, 1), f.z(len >> 1, 1));
  C.claim(0, 1, len - 1, 1, CLAIM.built);
  const color = C.color('marble', [[0, h + 2, 1]], `colonnade${n}`);
  for (let u = 0; u < len; u++) C.stack('pillar', u, 1, 2, 0);
  for (let u = 0; u < len; u++) C.put('marble', u, h + 2, 1, color);
  return true;
}

/** A shrine: a small temple (2 × 2 on four pillars) on grass with a path to its front. */
export function buildShrine(town: Town, n: number): boolean {
  const { g } = town;
  const found = search(g, `shrine${n}`, (f) => {
    if (!fits(g, f, 0, 0, 1, 2)) return null;
    const h = rectFlat(g, f, 0, 0, 1, 2);
    if (h < 0) return null;
    const d = fromSquare(town, f.ox, f.oz);
    if (d < 6) return null;
    return { score: Math.abs(d - 10 - n * 2), data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const S = new Local(g, f);
  const d = startDistrict(town, `shrine${n}`, f.ox, f.oz);
  S.claim(0, 0, 1, 1, CLAIM.built);
  const color = S.color('marble', [[0, h + 2, 0]], `shrine${n}`);
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) S.stack('pillar', u, v, 2, 0);
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) S.put('marble', u, h + 2, v, color);
  for (let u = 0; u <= 1; u++) pave(g, f.x(u, 2), f.z(u, 2));
  S.way(d, 0, 2);
  return true;
}

/** A monument: a small square (3 × 3 plaza) by a street with an obelisk or victory column in the middle. */
export function buildMonument(town: Town, n: number): boolean {
  const { g } = town;
  const found = search(g, `monument${n}`, (f) => {
    // After the streets: open margins of other districts may take it, buildings and streets may not.
    if (!rectFree(g, f, 0, 0, 2, 2, CLAIM.built | CLAIM.keep | CLAIM.street)) return null;
    const h = rectFlat(g, f, 0, 0, 2, 2);
    if (h < 0) return null;
    let street = false;
    for (let u = 0; u <= 2; u++) if (g.claimed(f.x(u, 3), f.z(u, 3), CLAIM.street)) street = true;
    if (!street) return null;
    const d = fromSquare(town, f.x(1, 1), f.z(1, 1));
    if (d < 7) return null;
    return { score: Math.abs(d - 9 - n * 3), data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const M = new Local(g, f);
  startDistrict(town, `monument${n}`, f.x(1, 1), f.z(1, 1));
  M.claim(0, 0, 2, 2, CLAIM.built);
  for (let v = 0; v <= 2; v++) for (let u = 0; u <= 2; u++) M.floor('plaza', u, v, h);
  M.stack('marble', 1, 1, 4 + (n % 2), M.color('marble', [[1, h, 1]], `monument${n}`));
  return true;
}

// ────────────────────────────────────────────────────────── market ──

/** A market place: a 4 × 4 plaza by a street with stalls and a market cross (D37). */
export function buildMarketPlace(town: Town, n: number): boolean {
  const { g } = town;
  // A 4 × 4 market place where there is room, else a 3 × 3 one, as near the square as the streets allow.
  for (const k of [4, 3]) {
    const found = search(g, `market${n}-${k}`, (f) => {
      if (!rectFree(g, f, 0, 0, k - 1, k - 1, CLAIM.built | CLAIM.keep | CLAIM.street)) return null;
      const h = rectFlat(g, f, 0, 0, k - 1, k - 1);
      if (h < 0) return null;
      let street = false;
      for (let u = 0; u < k; u++) if (g.claimed(f.x(u, k), f.z(u, k), CLAIM.street)) street = true;
      if (!street) return null;
      const d = fromSquare(town, f.x(1, 1), f.z(1, 1));
      if (d < 6) return null;
      return { score: Math.abs(d - 9), data: h };
    });
    if (!found) continue;
    const f = found.frame, h = found.data;
    const M = new Local(g, f);
    startDistrict(town, `market${n}`, f.x(1, 1), f.z(1, 1));
    M.claim(0, 0, k - 1, k - 1, CLAIM.built);
    for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) M.floor('plaza', u, v, h);
    M.put('marble', 0, h, 0, 3);
    M.put('stall', 2, h, 0);
    M.put('stall', 0, h, 2);
    if (k === 4) M.put('stall', 3, h, 3);
    return true;
  }
  return false;
}

// ───────────────────────────────────────────────────────── farming ──

/**
 * A wheat farm: a windmill by a fenced wheat field (R-G01: garden within two
 * of a windmill), a barn off the road by the field (R-H18), the farmhouse.
 *   u: 0 1 2 3 4 5 6 7 8 9
 *   v=0  . w w w w . . . . .
 *   v=1  W w w w w . B B B B      W windmill, w wheat, B barn
 *   v=2  . w w w w . B B B B
 *   v=3  . w w w w . . . . .
 *   v=4  . . . . . . F F . .      F farmhouse (two storeys)
 *   v=5  . . . . . . . . . .
 *   v=6  = = = = = = = = = =      the lane
 */
export function buildWheatFarm(town: Town, n: number): boolean {
  const { g } = town;
  const found = search(g, `wheat-farm${n}`, (f) => {
    if (!fits(g, f, 0, 0, 9, 6)) return null;
    const h = rectFlat(g, f, 0, 0, 9, 6);
    if (h < 0) return null;
    if (town.site.waterDist[columnIndex(f.x(4, 3), f.z(4, 3))]! < 2) return null;
    // The barn wants no square within six (R-H18): the square's plaza reaches two or three from its middle.
    if (chebFromSquare(town, f, 6, 1, 9, 2) < 10) return null;
    // No street at its walls (a barn stands in its yard, off the road).
    if (!rectFree(g, f, 5, 0, 10, 3, CLAIM.street)) return null;
    const d = fromSquare(town, f.x(5, 3), f.z(5, 3));
    return { score: Math.abs(d - 15), data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const W = new Local(g, f);
  const d = startDistrict(town, `wheat-farm${n}`, f.x(5, 3), f.z(5, 3));
  W.claim(0, 0, 9, 5, CLAIM.built);
  W.claim(5, -1, 10, 3, CLAIM.keep);
  for (let u = 0; u <= 9; u++) pave(g, f.x(u, 6), f.z(u, 6));
  for (let v = 0; v <= 3; v++) for (let u = 1; u <= 4; u++) W.floor('garden', u, v, h);
  for (let u = 1; u <= 4; u++) {
    W.edge(u, h, 0, 0, 'fence');
    W.edge(u, h, 3, 2, 'fence');
  }
  for (let v = 0; v <= 3; v++) W.edge(4, h, v, 1, 'fence');
  W.stack('windmill', 0, 1, 2 + (n % 2), 0);
  W.house(6, 1, 9, 2, 1, `wheat-barn${n}`);
  W.house(6, 4, 7, 4, 2, `wheat-farmhouse${n}`);
  W.way(d, 0, 6);
  return true;
}


/**
 * A wheat field: a windmill at the corner of a big fenced field of wheat
 * (R-G01: garden within two of a windmill), a lane along it.
 *   u: 0 1 2 3 4 5
 *   v=0  W w w w w w
 *   v=1  . w w w w w        W windmill, w wheat (fenced round)
 *   …
 *   v=4  . w w w w w
 *   v=5  = = = = = =        the lane
 */
export function buildWheatField(town: Town, n: number): boolean {
  const { g } = town;
  const found = search(g, `wheat-field${n}`, (f) => {
    if (!fits(g, f, 0, 0, 5, 5)) return null;
    const h = rectFlat(g, f, 0, 0, 5, 5);
    if (h < 0) return null;
    if (town.site.waterDist[columnIndex(f.x(3, 2), f.z(3, 2))]! < 2) return null;
    const d = fromSquare(town, f.x(3, 2), f.z(3, 2));
    if (d < 10) return null;
    return { score: Math.abs(d - 14), data: h };
  });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const W = new Local(g, f);
  const d = startDistrict(town, `wheat-field${n}`, f.x(3, 2), f.z(3, 2));
  W.claim(0, 0, 5, 4, CLAIM.built);
  for (let u = 0; u <= 5; u++) pave(g, f.x(u, 5), f.z(u, 5));
  for (let v = 0; v <= 4; v++) for (let u = 1; u <= 5; u++) W.floor('garden', u, v, h);
  for (let u = 1; u <= 5; u++) W.edge(u, h, 0, 0, 'fence');
  for (let v = 0; v <= 4; v++) W.edge(5, h, v, 1, 'fence');
  W.stack('windmill', 0, 0, 2, 0);
  W.way(d, 0, 5);
  return true;
}
