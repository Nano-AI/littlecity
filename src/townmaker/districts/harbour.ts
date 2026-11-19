// The harbour, built from small pieces fitted to the real shoreline (an
// island's coast is rarely straight for long): a quay along the shore with a
// promenade behind it and a fish stall, a pier straight out to sea with rope
// rails, stilt houses on their own platforms, a boathouse on the beach, a
// quay wall, palms and a reed bed. Each piece's frame faces the sea: land at
// v ≤ 0, water from v = 1.

import { columnIndex, key } from '@/core/grid';
import { CLAIM, type Grower } from '../grower';
import { search, type Frame } from '../frame';
import { startDistrict, type District, type Town, Local } from '../town';
import { pave } from '../route';

/** Open water with no block at sea level. */
function openWater(g: Grower, x: number, z: number): boolean {
  // Water kept clear (beside the willow) counts as taken.
  return g.inMap(x, z) && g.h(x, z) === 0 && !g.world.blocks.has(key(x, 0, z)) && !g.claimed(x, z, CLAIM.keep);
}
/** A dock (or anything) at sea level in a side neighbour. */
function besideSeaBlock(g: Grower, x: number, z: number): boolean {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (g.inMap(x + dx, z + dz) && g.world.blocks.has(key(x + dx, 0, z + dz))) return true;
  }
  return false;
}
function landFree(g: Grower, x: number, z: number, h?: number): boolean {
  const height = g.h(x, z);
  return height > 0 && (h === undefined || height === h) && g.free(x, z);
}
function near(a: readonly [number, number], f: Frame): number {
  return Math.abs(f.ox - a[0]) + Math.abs(f.oz - a[1]);
}

export function buildHarbour(town: Town): boolean {
  const { g } = town;
  // The quay first: it decides where the harbour is. Best is a berth for a big ship (a galleon wants
  // a straight run of 8 docks, open sea 3 wide alongside, a clear lane out to the map edge).
  const berth = search(g, 'berth8', (f) => {
    let land = 0;
    for (let u = 0; u < 8; u++) {
      if (!openWater(g, f.x(u, 1), f.z(u, 1)) || besideSeaBlock(g, f.x(u, 1), f.z(u, 1))) return null;
      const h = g.h(f.x(u, 0), f.z(u, 0));
      if (h === 0) continue;
      if (h !== 1 || !landFree(g, f.x(u, 0), f.z(u, 0), 1)) return null;
      land++;
    }
    if (land < 5) return null;
    for (let v = 2; v <= 4; v++) for (let u = -1; u <= 8; u++) if (!openWater(g, f.x(u, v), f.z(u, v))) return null;
    for (const u of [0, 4, 7]) {
      for (let v = 5; ; v++) {
        const x = f.x(u, v), z = f.z(u, v);
        if (!g.inMap(x, z)) break;
        if (!openWater(g, x, z)) return null;
      }
    }
    const d = town.square ? Math.abs(f.ox - town.square.x) + Math.abs(f.oz - town.square.z) : 0;
    return { score: d, data: 8 };
  });
  let quay = berth;
  for (let Q = 6; Q >= 4 && !quay; Q--) {
    const len = Q;
    quay = search(g, `quay${len}`, (f) => {
      for (let u = 0; u < len; u++) {
        const x = f.x(u, 0), z = f.z(u, 0);
        if (!landFree(g, x, z, 1)) return null;
        if (!landFree(g, f.x(u, -1), f.z(u, -1))) return null;
        if (!openWater(g, f.x(u, 1), f.z(u, 1)) || !openWater(g, f.x(u, 2), f.z(u, 2))) return null;
      }
      if (besideSeaBlock(g, f.x(0, 1), f.z(0, 1)) || besideSeaBlock(g, f.x(len - 1, 1), f.z(len - 1, 1))) return null;
      const d = town.square ? Math.abs(f.ox - town.square.x) + Math.abs(f.oz - town.square.z) : 0;
      return { score: d + town.site.exposure[columnIndex(f.ox, f.oz)]! * 0.3, data: len };
    });
  }
  if (!quay) return false;
  const qf = quay.frame;
  const qlen = quay.data;
  const d = startDistrict(town, 'harbour', qf.x(qlen / 2, 0), qf.z(qlen / 2, 0));
  const Lq = new Local(g, qf);
  // The promenade and the landing behind the quay, then the docks (Auto over the sea is a dock).
  for (let u = -1; u <= qlen; u++) {
    if (g.h(qf.x(u, -1), qf.z(u, -1)) > 0 && g.h(qf.x(u, 0), qf.z(u, 0)) > 0) pave(g, qf.x(u, -1), qf.z(u, -1));
  }
  for (let u = 0; u < qlen; u++) if (g.h(qf.x(u, 0), qf.z(u, 0)) > 0) pave(g, qf.x(u, 0), qf.z(u, 0));
  Lq.claim(0, 0, qlen - 1, 2, CLAIM.built);
  const rows = qlen >= 5 ? 1 : 2;
  for (let v = 1; v <= rows; v++) for (let u = 0; u < qlen; u++) Lq.put('auto', u, 0, v, 'auto');
  // A fish stall on the landing.
  if (g.h(qf.x(qlen - 1, 0), qf.z(qlen - 1, 0)) > 0) Lq.put('stall', qlen - 1, 1, 0);
  for (let u = 0; u < qlen; u++) {
    if (g.h(qf.x(u, 0), qf.z(u, 0)) > 0) {
      d.ways.push([qf.x(u, 0), qf.z(u, 0)]);
      break;
    }
  }
  const anchor: [number, number] = [qf.x(qlen / 2, 0), qf.z(qlen / 2, 0)];

  buildPier(town, d, anchor);
  for (let i = 0; i < 2; i++) buildStiltHouse(town, d, anchor, i);
  buildBoathouse(town, d, anchor);
  buildQuayWall(town, anchor);
  shoreTrees(town, anchor);
  return true;
}

function buildPier(town: Town, d: District, anchor: readonly [number, number]): boolean {
  const { g } = town;
  const P = 4;
  const found = search(g, 'pier', (f) => {
    if (!landFree(g, f.ox, f.oz)) return null;
    if (!landFree(g, f.x(0, -1), f.z(0, -1)) && !g.claimed(f.x(0, -1), f.z(0, -1), CLAIM.street)) return null;
    if (Math.abs(g.h(f.x(0, -1), f.z(0, -1)) - g.h(f.ox, f.oz)) > 1) return null;
    for (let v = 1; v <= P; v++) {
      if (!openWater(g, f.x(0, v), f.z(0, v)) || besideSeaBlock(g, f.x(0, v), f.z(0, v))) return null;
      if (v >= 2 && (!openWater(g, f.x(-1, v), f.z(-1, v)) || !openWater(g, f.x(1, v), f.z(1, v)))) return null;
    }
    if (!openWater(g, f.x(0, P + 1), f.z(0, P + 1))) return null;
    const dist = near(anchor, f);
    if (dist < 3) return null;
    return { score: dist, data: null };
  });
  if (!found) return false;
  const f = found.frame;
  const L = new Local(g, f);
  pave(g, f.x(0, -1), f.z(0, -1));
  pave(g, f.ox, f.oz);
  L.claim(0, 0, 0, P, CLAIM.built);
  for (let v = 1; v <= P; v++) L.put('dock', 0, 0, v, 0);
  for (let v = 1; v <= P; v++) L.floor('path', 0, v, 1);
  for (let v = 2; v <= P - 1; v++) {
    L.edge(0, 1, v, 1, 'fence');
    L.edge(0, 1, v, 3, 'fence');
  }
  d.ways.push([f.x(0, -1), f.z(0, -1)]);
  return true;
}

/**
 * A stilt house on a platform two docks out from the beach: the dock next to
 * the shore carries a path, so the house's door opens onto it and people
 * walk out to it from the land.
 */
function buildStiltHouse(town: Town, d: District, anchor: readonly [number, number], i: number): boolean {
  const { g } = town;
  const found = search(g, `stilt${i}`, (f) => {
    if (!landFree(g, f.ox, f.oz, 1)) return null;
    for (const [u, v] of [[0, 1], [0, 2], [-1, 1], [1, 1], [-1, 2], [1, 2], [0, 3]] as const) if (!openWater(g, f.x(u, v), f.z(u, v))) return null;
    if (besideSeaBlock(g, f.x(0, 1), f.z(0, 1)) || besideSeaBlock(g, f.x(0, 2), f.z(0, 2))) return null;
    const dist = near(anchor, f);
    if (dist < 2) return null;
    return { score: dist, data: null };
  });
  if (!found) return false;
  const f = found.frame;
  const L = new Local(g, f);
  pave(g, f.ox, f.oz);
  L.put('dock', 0, 0, 1, 0);
  L.put('dock', 0, 0, 2, 0);
  L.floor('path', 0, 1, 1);
  const c = L.color('house', [[0, 1, 2]], `stilt${i}`);
  L.put('house', 0, 1, 2, c);
  if (g.chance(0.5, 'stilt-up', i)) L.put('house', 0, 2, 2, c);
  L.claim(0, 1, 0, 3, CLAIM.built);
  L.way(d, 0, 0);
  return true;
}

/** A boathouse on the beach, its boat doors onto a short landing stage that joins the beach beside it. */
export function buildBoathouse(town: Town, d: District, anchor: readonly [number, number]): boolean {
  const { g } = town;
  const found = search(g, 'boathouse', (f) => {
    if (!landFree(g, f.ox, f.oz, 1) || !landFree(g, f.x(1, 0), f.z(1, 0), 1) || !landFree(g, f.x(2, 0), f.z(2, 0), 1)) return null;
    for (let u = 0; u <= 2; u++) if (!openWater(g, f.x(u, 1), f.z(u, 1)) || besideSeaBlock(g, f.x(u, 1), f.z(u, 1))) return null;
    if (!landFree(g, f.x(0, -1), f.z(0, -1))) return null;
    const dist = near(anchor, f);
    if (dist < 2) return null;
    return { score: dist, data: null };
  });
  if (!found) return false;
  const f = found.frame;
  const L = new Local(g, f);
  L.claim(0, 0, 1, 0, CLAIM.built);
  L.claim(0, 1, 2, 1, CLAIM.built);
  pave(g, f.x(2, 0), f.z(2, 0));
  L.house(0, 0, 1, 0, 1, 'boathouse');
  for (let u = 0; u <= 2; u++) L.put('dock', u, 0, 1, 0);
  for (let u = 0; u <= 2; u++) L.floor('path', u, 1, 1);
  L.way(d, 2, 0);
  if (g.h(f.x(0, -1), f.z(0, -1)) > 0) {
    pave(g, f.x(0, -1), f.z(0, -1));
    L.way(d, 0, -1);
  }
  return true;
}

function buildQuayWall(town: Town, anchor: readonly [number, number]): boolean {
  const { g } = town;
  const found = search(g, 'quay-wall', (f) => {
    for (let u = 0; u < 2; u++) {
      if (!landFree(g, f.x(u, 0), f.z(u, 0), 1)) return null;
      if (!openWater(g, f.x(u, 1), f.z(u, 1))) return null;
    }
    const dist = near(anchor, f);
    if (dist < 2) return null;
    return { score: dist, data: null };
  });
  if (!found) return false;
  const L = new Local(g, found.frame);
  L.claim(0, 0, 1, 0, CLAIM.built);
  const c = L.color('marble', [[0, 1, 0]], 'quay-wall');
  L.put('marble', 0, 1, 0, c);
  L.put('marble', 1, 1, 0, c);
  return true;
}

/** Palms on the sand by the water, and a reed bed. */
function shoreTrees(town: Town, anchor: readonly [number, number]): void {
  const { g, site } = town;
  const spots: [number, number, number][] = [];
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      if (g.h(x, z) !== 1 || !site.isSand(x, z) || !g.free(x, z)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => openWater(g, x + dx!, z + dz!))) continue;
      spots.push([x, z, Math.abs(x - anchor[0]) + Math.abs(z - anchor[1]) + g.rand('palm', x, z) * 6]);
    }
  }
  spots.sort((a, b) => a[2] - b[2]);
  let palms = 0, reeds = 0;
  for (const [x, z, dist] of spots) {
    if (dist < 3 || !g.free(x, z)) continue;
    if (palms < 4) {
      if (g.put('tree', x, 1, z, 0)) {
        g.mark(x, z, CLAIM.built);
        palms++;
      }
    } else if (reeds < 1 && g.free(x + 1, z) && g.h(x + 1, z) === 1) {
      g.floor('garden', x, z, 1);
      g.floor('garden', x + 1, z, 1);
      g.mark(x, z, CLAIM.keep);
      g.mark(x + 1, z, CLAIM.keep);
      reeds++;
    }
    if (palms >= 4 && reeds >= 1) break;
  }
}
