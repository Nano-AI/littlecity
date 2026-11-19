// Monuments: the acropolis (a temple on six pillars, grand steps, a
// belvedere terrace behind a stone balustrade, and the campanile, the
// tallest tower in town), the chapel with its steeple and a buttress, the
// lighthouse and its keeper's cottage on a point, a watchtower, the
// hilltop (observatory and lookout cottage among pines), a house at the
// foot of a cliff, and the folly: a viaduct on placed pillars carrying a
// tower with a windmill on top, a room hung off the tower on brackets, and
// a row of rooms on an arcade of generated supports.

import { columnIndex, key } from '@/core/grid';
import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, fromSquare, rectFlat, rectRange, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';

/** The temple, its grand steps, the belvedere and the campanile, fitted round one another. */
export function buildAcropolis(town: Town): boolean {
  const { g } = town;
  // The temple: 2 × 3 marble on six pillars two tall, in a ring of plaza; grand steps rise to its floor from the south.
  //   u 0..3, v 0..3 the temple and its ring; v 4..7 the steps (u 1..2) with paths either side; v 8 the way in.
  const found = search(g, 'temple', (f) => {
    if (!fits(g, f, 0, 0, 3, 8)) return null;
    const h = rectFlat(g, f, 0, 0, 3, 8);
    if (h < 0) return null;
    const d = fromSquare(town, f.x(1, 8), f.z(1, 8));
    if (d < 7) return null;
    return { score: Math.abs(d - 13) - h * 1.5, data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const h = found.data;
  const A = new Local(g, f);
  const d = startDistrict(town, 'acropolis', f.x(1, 4), f.z(1, 4));
  A.claim(0, 0, 3, 8, CLAIM.built);
  A.claim(-1, -1, 4, 9, CLAIM.open);
  // The plaza round the temple and the paths beside the steps.
  for (let v = 0; v <= 3; v++) for (let u = 0; u <= 3; u++) if (!(u >= 1 && u <= 2 && v >= 1)) A.floor('plaza', u, v, h);
  for (let v = 4; v <= 8; v++) for (const u of [0, 3]) pave(g, f.x(u, v), f.z(u, v));
  for (let u = 1; u <= 2; u++) pave(g, f.x(u, 8), f.z(u, 8));
  // Pillars, then the marble on them.
  const marble = A.color('marble', [[1, h + 2, 1]], 'temple');
  for (let v = 1; v <= 3; v++) for (let u = 1; u <= 2; u++) A.stack('pillar', u, v, 2, 0);
  for (let v = 1; v <= 3; v++) for (let u = 1; u <= 2; u++) A.put('marble', u, h + 2, v, marble);
  // The grand steps: rows one, two and three tall, then a landing level with the temple's floor.
  const steps = (marble + 4) % 8;
  for (let u = 1; u <= 2; u++) {
    A.stack('marble', u, 7, 1, steps);
    A.stack('marble', u, 6, 2, steps);
    A.stack('marble', u, 5, 3, steps);
    A.stack('marble', u, 4, 3, steps);
  }
  A.way(d, 0, 8);
  A.way(d, 3, 8);

  // The campanile: the tallest tower in town, near the temple.
  const camp = search(g, 'campanile', (c) => {
    if (!fits(g, c, 0, 0, 0, 0)) return null;
    const dist = Math.abs(c.ox - f.x(1, 4)) + Math.abs(c.oz - f.z(1, 4));
    if (dist < 4) return null;
    return { score: dist, data: null };
  }, { turns: [0] });
  if (camp) {
    const C = new Local(g, camp.frame);
    C.claim(0, 0, 0, 0, CLAIM.built);
    C.claim(-1, -1, 1, 1, CLAIM.keep);
    C.stack('tower', 0, 0, 7, C.color('tower', [[0, g.h(camp.frame.ox, camp.frame.oz), 0]], 'campanile'));
    if (g.h(camp.frame.x(0, 1), camp.frame.z(0, 1)) > 0) {
      pave(g, camp.frame.x(0, 2), camp.frame.z(0, 2));
      d.ways.push([camp.frame.x(0, 2), camp.frame.z(0, 2)]);
    }
  }

  // The belvedere: a marble terrace one block high behind a stone balustrade.
  const bel = search(g, 'belvedere', (b) => {
    if (!fits(g, b, 0, 0, 1, 3)) return null;
    const bh = rectFlat(g, b, 0, 0, 1, 3);
    if (bh < 0) return null;
    const dist = Math.abs(b.ox - f.x(1, 4)) + Math.abs(b.oz - f.z(1, 4));
    if (dist < 5 || town.site.waterDist[columnIndex(b.ox, b.oz)]! < 3) return null;
    return { score: dist - bh, data: bh };
  }, { turns: [0] });
  if (bel) {
    const B = new Local(g, bel.frame);
    const bh = bel.data;
    B.claim(-1, -1, 2, 2, CLAIM.built);
    B.mark(0, 3, CLAIM.open);
    const c = B.color('marble', [[0, bh, 0]], 'belvedere');
    for (let v = 0; v <= 1; v++) for (let u = 0; u <= 1; u++) B.put('marble', u, bh, v, c);
    for (let u = 0; u <= 1; u++) B.edge(u, bh + 1, 0, 0, 'fence');
    for (let v = 0; v <= 1; v++) B.edge(1, bh + 1, v, 1, 'fence');
    B.edge(0, bh + 1, 0, 3, 'fence');
    // Stairs up onto it from the south, and a path to their foot.
    pave(g, bel.frame.x(0, 3), bel.frame.z(0, 3));
    g.stairs(bel.frame.x(0, 2), bel.frame.z(0, 2), bel.frame.dir(0));
    d.ways.push([bel.frame.x(0, 3), bel.frame.z(0, 3)]);
  }
  return true;
}

/** The chapel: a house three long and two storeys with its steeple at one end and a buttress off its side. */
export function buildChapel(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'chapel', (f) => {
    if (!fits(g, f, 0, -1, 3, 1)) return null;
    const h = rectFlat(g, f, 0, -1, 3, 1);
    if (h < 0) return null;
    const d = fromSquare(town, f.x(1, 1), f.z(1, 1));
    if (d < 6) return null;
    return { score: Math.abs(d - 9), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const h = found.data;
  const C = new Local(g, f);
  const d = startDistrict(town, 'chapel', f.x(1, 0), f.z(1, 0));
  C.claim(0, -1, 3, 1, CLAIM.built);
  C.claim(-1, -2, 4, 2, CLAIM.open);
  for (let u = -1; u <= 3; u++) pave(g, f.x(u, 1), f.z(u, 1));
  pave(g, f.x(1, 2), f.z(1, 2));
  C.house(0, 0, 2, 0, 2, 'chapel');
  C.stack('tower', 3, 0, 5, C.color('tower', [[3, h, 0]], 'steeple'));
  // A flying buttress off the chapel's north wall, at the upper storey.
  C.put('arch', 1, h + 1, -1, 0);
  C.way(d, 1, 2);
  C.way(d, -1, 1);
  return true;
}

/** The lighthouse on the most exposed point, its keeper's cottage beside it. */
export function buildLighthouse(town: Town): boolean {
  const { g, site } = town;
  const found = search(g, 'lighthouse', (f) => {
    if (!g.free(f.ox, f.oz) || !g.free(f.x(0, 1), f.z(0, 1)) || !g.free(f.x(1, 1), f.z(1, 1))) return null;
    const h = g.h(f.ox, f.oz);
    if (h === 0 || g.h(f.x(0, 1), f.z(0, 1)) !== h || g.h(f.x(1, 1), f.z(1, 1)) !== h) return null;
    if (site.waterDist[columnIndex(f.ox, f.oz)]! !== 1) return null;
    const way = g.h(f.x(0, 2), f.z(0, 2));
    if (way === 0 || Math.abs(way - h) > 1 || !g.free(f.x(0, 2), f.z(0, 2))) return null;
    const d = fromSquare(town, f.ox, f.oz);
    return { score: -site.exposure[columnIndex(f.ox, f.oz)]! + (d < 10 ? 10 : 0) + d * 0.1, data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const L = new Local(g, f);
  const d = startDistrict(town, 'lighthouse', f.ox, f.oz);
  L.claim(0, 0, 1, 1, CLAIM.built);
  pave(g, f.x(0, 2), f.z(0, 2));
  L.stack('lighthouse', 0, 0, 6, 0);
  L.house(0, 1, 1, 1, 1, 'keeper');
  L.way(d, 0, 2);
  return true;
}

/** A watchtower four tall on open ground away from the town. */
export function buildWatchtower(town: Town): boolean {
  const { g, site } = town;
  const found = search(g, 'watchtower', (f) => {
    if (!fits(g, f, 0, 0, 0, 1)) return null;
    const h = g.h(f.ox, f.oz);
    if (h === 0 || h === site.maxH) return null;
    if (Math.abs(g.h(f.x(0, 1), f.z(0, 1)) - h) > 1 || g.h(f.x(0, 1), f.z(0, 1)) === 0) return null;
    const d = fromSquare(town, f.ox, f.oz);
    if (d < 10) return null;
    return { score: -h * 2 + Math.abs(d - 16) * 0.3, data: h };
  }, { turns: [0, 1, 2, 3] });
  if (!found) return false;
  const W = new Local(g, found.frame);
  const d = startDistrict(town, 'watchtower', found.frame.ox, found.frame.oz);
  W.claim(0, 0, 0, 0, CLAIM.built);
  W.claim(-1, -1, 1, 1, CLAIM.keep);
  W.stack('tower', 0, 0, 4, W.color('tower', [[0, found.data, 0]], 'watch'));
  d.anyWay = true;
  for (const [u, v] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) if (g.h(found.frame.x(u, v), found.frame.z(u, v)) > 0) W.way(d, u, v);
  return true;
}

/**
 * The hilltop: an observatory and a lookout cottage on the highest level,
 * at least four apart (the lookout wants no other structure within three);
 * when the top is too small for both, the seed chooses. Pines on the slopes.
 */
export function buildHilltop(town: Town): boolean {
  const { g, site } = town;
  const top = site.maxH;
  const tops: [number, number][] = [];
  for (let z = 0; z < 48; z++) for (let x = 0; x < 48; x++) if (g.h(x, z) === top && g.free(x, z)) tops.push([x, z]);
  if (tops.length === 0 || top < 2) return false;
  const d = startDistrict(town, 'hilltop', tops[0]![0], tops[0]![1]);
  const clearAround = (x: number, z: number, r: number): boolean => {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r + Math.abs(dz); dx <= r - Math.abs(dz); dx++) {
        if (!g.inMap(x + dx, z + dz)) continue;
        if (g.claimed(x + dx, z + dz, CLAIM.built)) return false;
        for (let y = 0; y < 12; y++) if (g.world.blocks.has(key(x + dx, y, z + dz))) return false;
      }
    }
    return true;
  };
  const obsOk = ([x, z]: [number, number]): boolean => g.free(x, z) && site.waterDist[columnIndex(x, z)]! > 4 && clearAround(x, z, 1);
  const lookOk = ([x, z]: [number, number]): boolean => g.free(x, z) && clearAround(x, z, 3);
  const order = g.chance(0.5, 'hill-first') ? ['obs', 'look'] : ['look', 'obs'];
  let made = 0;
  for (const what of order) {
    const spots = tops.filter((p) => (what === 'obs' ? obsOk(p) : lookOk(p)));
    if (spots.length === 0) continue;
    const [x, z] = spots[Math.floor(g.rand('hill', what) * spots.length)]!;
    if (what === 'obs') {
      g.stack('tower', x, z, 4, g.colorFor('tower', [[x, top, z]], 'observatory'));
      g.mark(x, z, CLAIM.built);
    } else {
      g.put('house', x, top, z, g.colorFor('house', [[x, top, z]], 'lookout'));
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3 + Math.abs(dz); dx <= 3 - Math.abs(dz); dx++) g.mark(x + dx, z + dz, CLAIM.keep);
      g.mark(x, z, CLAIM.built);
    }
    made++;
    // Its way in: any side column that a street can reach (the first that joins is used).
    const sub = startDistrict(town, what === 'obs' ? 'observatory' : 'lookout', x, z);
    sub.anyWay = true;
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const wx = x + dx, wz = z + dz;
      if (g.h(wx, wz) > 0 && Math.abs(g.h(wx, wz) - top) <= 1 && !g.groundTaken(wx, wz)) sub.ways.push([wx, wz]);
    }
    g.district = d.id;
  }
  // Pines on the high ground.
  let pines = 0;
  for (let z = 0; z < 48 && pines < 6; z++) {
    for (let x = 0; x < 48 && pines < 6; x++) {
      if (g.h(x, z) < 4 || !g.free(x, z) || g.groundTaken(x, z)) continue;
      if (!g.chance(0.18, 'pine', x, z)) continue;
      if (g.put('tree', x, g.h(x, z), z, 0)) {
        g.mark(x, z, CLAIM.built);
        pines++;
      }
    }
  }
  return made > 0;
}

/** A house at the foot of a cliff: its back against terrain two or more levels higher. */
export function buildCliffHouse(town: Town): boolean {
  const { g, site } = town;
  for (const w of [2, 1]) {
    const found = search(g, `cliff-house${w}`, (f) => {
      if (!fits(g, f, 0, 0, w - 1, 0, 0) || !fits(g, f, 0, 0, w - 1, 1)) return null;
      const h = rectFlat(g, f, 0, 0, w - 1, 0);
      if (h < 0) return null;
      if (g.h(f.x(0, -1), f.z(0, -1)) < h + 2) return null;
      // Not on the waterfront (it would be a boathouse).
      for (let u = 0; u < w; u++) if (site.waterDist[columnIndex(f.x(u, 0), f.z(u, 0))]! < 2) return null;
      const front = g.h(f.x(0, 1), f.z(0, 1));
      if (front === 0 || Math.abs(front - h) > 1) return null;
      return { score: fromSquare(town, f.ox, f.oz) * 0.2, data: h };
    });
    if (!found) continue;
    const f = found.frame;
    const C = new Local(g, f);
    const d = startDistrict(town, 'cliff-house', f.ox, f.oz);
    C.claim(0, 0, w - 1, 0, CLAIM.built);
    C.claim(-1, 0, w, 1, CLAIM.keep);
    C.house(0, 0, w - 1, 0, 2, 'cliff');
    const [wx, wz] = [f.x(0, 2), f.z(0, 2)];
    if (g.h(wx, wz) > 0 && Math.abs(g.h(wx, wz) - g.h(f.x(0, 1), f.z(0, 1))) <= 1 && pave(g, wx, wz)) C.way(d, 0, 2);
    return true;
  }
  return false;
}

/**
 * The folly, the vertical quarter:
 *   two placed pillars, an arch run across them (a viaduct, its middle a valid span),
 *   a tower on the middle arch with a windmill on its top, a room hung off
 *   the tower on brackets, and three rooms on generated supports beside the run.
 */
export function buildFolly(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'folly', (f) => {
    if (!fits(g, f, -1, -1, 5, 3)) return null;
    const h = rectFlat(g, f, -1, 0, 5, 3);
    if (h < 0) return null;
    const [lo] = rectRange(g, f, -1, -1, 5, 3);
    if (lo === 0) return null;
    // No garden within reach of the windmill (it would turn it to wheat).
    const d = fromSquare(town, f.x(2, 1), f.z(2, 1));
    if (d < 8) return null;
    return { score: Math.abs(d - 12), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const h = found.data;
  const F = new Local(g, f);
  const d = startDistrict(town, 'folly', f.x(2, 1), f.z(2, 1));
  F.claim(-1, -1, 5, 2, CLAIM.built);
  F.claim(-2, -2, 6, 4, CLAIM.open);
  // The lane beneath.
  for (let u = -1; u <= 5; u++) pave(g, f.x(u, 3), f.z(u, 3));
  for (let u = 1; u <= 3; u++) pave(g, f.x(u, 1), f.z(u, 1));
  F.stack('pillar', 0, 1, 2, 0);
  F.stack('pillar', 4, 1, 2, 0);
  for (let u = 0; u <= 4; u++) F.put('arch', u, h + 2, 1, 0);
  const tower = F.color('tower', [[2, h + 3, 1]], 'folly-tower');
  for (let y = h + 3; y <= h + 5; y++) F.put('tower', 2, y, 1, tower);
  F.put('windmill', 2, h + 6, 1, 0);
  F.put('house', 2, h + 4, 0, F.color('house', [[2, h + 4, 0]], 'folly-room'));
  const rooms = F.color('house', [[1, h + 2, 2], [2, h + 2, 2], [3, h + 2, 2]], 'folly-rooms');
  for (let u = 1; u <= 3; u++) F.put('house', u, h + 2, 2, rooms);
  F.way(d, -1, 3);
  F.way(d, 5, 3);
  return true;
}

