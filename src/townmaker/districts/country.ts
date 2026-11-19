// The looser edge of town: the windmill with its wheat and mill house, the
// manor in its park with a dovecote, a greenhouse in a kitchen garden, a
// walled herb garden with a well, a fenced paddock, a flower bed, a flight
// of stairs up a terrace, and trees (a grove, a willow by the water, and
// single trees chosen so the round, cypress and bush mix all appear).

import { columnIndex, key } from '@/core/grid';
import { rand } from '@/core/rand';
import { CLAIM } from '../grower';
import { search } from '../frame';
import { fits, fromSquare, rectFlat, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';
import { TREE } from '@/style/ground';

/**
 *   u: 0 1 2 3 4
 *   v=0  . . w w w     M mill house, W windmill (3 tall), w wheat
 *   v=1  M W w w w
 *   v=2  . . w w w
 *   v=3  - - - - -     the farm track
 */
export function buildMill(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'mill', (f) => {
    if (!fits(g, f, 0, 0, 4, 3)) return null;
    const h = rectFlat(g, f, 0, 0, 4, 3);
    if (h < 0) return null;
    const d = fromSquare(town, f.x(2, 1), f.z(2, 1));
    if (d < 9) return null;
    return { score: Math.abs(d - 15) + (town.site.waterDist[columnIndex(f.x(2, 1), f.z(2, 1))]! < 3 ? 3 : 0), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const h = found.data;
  const M = new Local(g, f);
  const d = startDistrict(town, 'mill', f.x(1, 1), f.z(1, 1));
  M.claim(-1, -1, 5, 2, CLAIM.built);
  for (let u = -1; u <= 4; u++) pave(g, f.x(u, 3), f.z(u, 3));
  for (let v = 0; v <= 2; v++) for (let u = 2; u <= 4; u++) M.floor('garden', u, v, h);
  for (let u = 2; u <= 4; u++) M.edge(u, h, 0, 0, 'fence');
  for (let v = 0; v <= 2; v++) M.edge(4, h, v, 1, 'fence');
  M.stack('windmill', 1, 1, 3, 0);
  M.house(0, 1, 0, 1, 1, 'mill-house');
  M.way(d, -1, 3);
  M.way(d, 4, 3);
  return true;
}

/**
 *   u: 0 1 2 3 4
 *   v=0  M M M          M manor, 3 × 3, two storeys (18 cells)
 *   v=1  M M M
 *   v=2  M M M
 *   v=3  p p p          p park (garden, 9 cells), fruit trees and a birdbath in it
 *   v=4  p p p
 *   v=5  p p p   D      D dovecote (3 tall, a garden within two)
 *   v=6  - - - - -      the road
 * No street comes within one of the manor (it would read as an inn).
 */
export function buildManor(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'manor', (f) => {
    if (!fits(g, f, 0, 0, 4, 6)) return null;
    const h = rectFlat(g, f, 0, 0, 4, 6);
    if (h < 0) return null;
    for (let v = -1; v <= 2; v++) for (const u of [-1, 3]) if (g.claimed(f.x(u, v), f.z(u, v), CLAIM.street)) return null;
    for (let u = 0; u <= 2; u++) if (g.claimed(f.x(u, -1), f.z(u, -1), CLAIM.street)) return null;
    const d = fromSquare(town, f.x(2, 3), f.z(2, 3));
    if (d < 8) return null;
    return { score: Math.abs(d - 13) + (town.site.waterDist[columnIndex(f.x(2, 3), f.z(2, 3))]! < 3 ? 4 : 0), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const h = found.data;
  const P = new Local(g, f);
  const d = startDistrict(town, 'manor', f.x(1, 3), f.z(1, 3));
  P.claim(-1, -1, 3, 5, CLAIM.keep);
  P.claim(0, 0, 2, 2, CLAIM.built);
  P.claim(4, 5, 4, 5, CLAIM.built);
  for (let u = -1; u <= 4; u++) pave(g, f.x(u, 6), f.z(u, 6));
  for (let v = 3; v <= 5; v++) for (let u = 0; u <= 2; u++) P.floor('garden', u, v, h);
  P.house(0, 0, 2, 2, 2, 'manor');
  P.put('tree', 0, h, 4, 0);
  P.put('tree', 2, h, 3, 0);
  if (!town.pumps) P.put('fountain', 1, h, 4, 0);
  P.stack('tower', 4, 5, 3, P.color('tower', [[4, h, 5]], 'dovecote'));
  P.way(d, -1, 6);
  P.way(d, 4, 6);
  return true;
}

/** A greenhouse in the middle of a kitchen garden, a path to the garden's edge. */
export function buildGreenhouse(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'greenhouse', (f) => {
    if (!fits(g, f, 0, 0, 2, 3)) return null;
    const h = rectFlat(g, f, 0, 0, 2, 3);
    if (h < 0) return null;
    const d = fromSquare(town, f.x(1, 1), f.z(1, 1));
    if (d < 7) return null;
    if (town.site.waterDist[columnIndex(f.x(1, 1), f.z(1, 1))]! < 3) return null;
    return { score: Math.abs(d - 11), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const h = found.data;
  const G = new Local(g, f);
  const d = startDistrict(town, 'greenhouse', f.x(1, 1), f.z(1, 1));
  G.claim(-1, -1, 3, 2, CLAIM.keep);
  G.mark(1, 1, CLAIM.built);
  for (let v = 0; v <= 2; v++) for (let u = 0; u <= 2; u++) if (u !== 1 || v !== 1) G.floor('garden', u, v, h);
  pave(g, f.x(1, 3), f.z(1, 3));
  G.house(1, 1, 1, 1, 1, 'greenhouse');
  G.way(d, 1, 3);
  return true;
}

/**
 * A walled garden: herbs round a well, a fruit tree, a gate in the wall
 * where the path comes in.
 *   v=-1    . p .
 *   v=0     | f p |      f well, p path (through an opening in the wall)
 *   v=1     | g t |      g garden, t tree on garden
 */
export function buildWalledGarden(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'walled-garden', (f) => {
    if (!fits(g, f, -1, -1, 2, 2)) return null;
    const h = rectFlat(g, f, -1, -1, 2, 2);
    if (h < 0) return null;
    const d = fromSquare(town, f.x(1, 0), f.z(1, 0));
    if (d < 6) return null;
    if (town.site.waterDist[columnIndex(f.x(1, 0), f.z(1, 0))]! < 3) return null;
    return { score: Math.abs(d - 9), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const h = found.data;
  const W = new Local(g, f);
  const d = startDistrict(town, 'walled-garden', f.x(0, 0), f.z(0, 0));
  W.claim(-1, 0, 2, 2, CLAIM.built);
  W.claim(-1, -1, 0, -1, CLAIM.keep);
  W.claim(2, -1, 2, -1, CLAIM.keep);
  pave(g, f.x(1, -1), f.z(1, -1));
  pave(g, f.x(1, 0), f.z(1, 0));
  W.floor('garden', 0, 0, h);
  W.floor('garden', 0, 1, h);
  W.floor('garden', 1, 1, h);
  for (let u = 0; u <= 1; u++) {
    W.edge(u, h, 0, 0, 'wall');
    W.edge(u, h, 1, 2, 'wall');
  }
  for (let v = 0; v <= 1; v++) {
    W.edge(0, h, v, 3, 'wall');
    W.edge(1, h, v, 1, 'wall');
  }
  if (town.pumps) W.put('tree', 0, h, 0, 0);
  else W.put('fountain', 0, h, 0, 0);
  W.put('tree', 1, h, 1, 0);
  W.way(d, 1, -1);
  return true;
}

/** A paddock: grass inside a ring of fence pieces, a gate by the road. */
export function buildPaddock(town: Town): boolean {
  const { g } = town;
  const w = 4, dd = 3;
  const found = search(g, 'paddock', (f) => {
    if (!fits(g, f, 0, 0, w - 1, dd)) return null;
    const h = rectFlat(g, f, 0, 0, w - 1, dd);
    if (h < 0) return null;
    if (town.site.isSand(f.ox, f.oz)) return null;
    const d = fromSquare(town, f.x(1, 1), f.z(1, 1));
    if (d < 10) return null;
    return { score: Math.abs(d - 17), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const h = found.data;
  const P = new Local(g, f);
  const d = startDistrict(town, 'paddock', f.x(1, 1), f.z(1, 1));
  P.claim(-1, -1, w, dd - 1, CLAIM.built);
  for (let u = -1; u <= w; u++) pave(g, f.x(u, dd), f.z(u, dd));
  for (let u = 0; u < w; u++) {
    P.edge(u, h, 0, 0, 'fence');
    P.edge(u, h, dd - 1, 2, 'fence');
  }
  for (let v = 0; v < dd; v++) {
    P.edge(0, h, v, 3, 'fence');
    P.edge(w - 1, h, v, 1, 'fence');
  }
  P.way(d, -1, dd);
  return true;
}

/** A small flower garden by a street, touching no house. */
export function buildFlowerBed(town: Town, n: number): boolean {
  const { g } = town;
  const found = search(g, `flowers${n}`, (f) => {
    if (!fits(g, f, 0, 0, 1, 1)) return null;
    const h = rectFlat(g, f, 0, 0, 1, 1);
    if (h < 0) return null;
    if (town.site.waterDist[columnIndex(f.ox, f.oz)]! < 3) return null;
    // Beside a street (so people pass it), at no house.
    let street = false;
    for (let u = -1; u <= 2; u++) {
      for (let v = -1; v <= 2; v++) {
        const x = f.x(u, v), z = f.z(u, v);
        if (g.claimed(x, z, CLAIM.street)) street = true;
        if (g.block(x, g.h(x, z), z)) return null;
      }
    }
    if (!street) return null;
    return { score: fromSquare(town, f.ox, f.oz), data: h };
  }, { turns: [0] });
  if (!found) return false;
  const F = new Local(g, found.frame);
  startDistrict(town, `flowers${n}`, found.frame.ox, found.frame.oz);
  F.claim(-1, -1, 2, 2, CLAIM.keep);
  for (let v = 0; v <= 1; v++) for (let u = 0; u <= 1; u++) F.floor('garden', u, v, found.data);
  return true;
}

/** A flight of stairs, two wide, up a one-level terrace edge, with paths at its foot and head. */
export function buildStairs(town: Town): boolean {
  const { g } = town;
  const found = search(g, 'stairs', (f) => {
    if (!fits(g, f, 0, -1, 1, 1, 0)) return null;
    const h = rectFlat(g, f, 0, 0, 1, 1);
    if (h < 0) return null;
    if (rectFlat(g, f, 0, -1, 1, -1) !== h + 1) return null;
    const d = fromSquare(town, f.ox, f.oz);
    if (d < 5) return null;
    return { score: Math.abs(d - 10), data: h };
  });
  if (!found) return false;
  const f = found.frame;
  const S = new Local(g, f);
  const d = startDistrict(town, 'stairs', f.ox, f.oz);
  S.claim(0, 0, 1, 0, CLAIM.built);
  for (let u = 0; u <= 1; u++) {
    pave(g, f.x(u, 1), f.z(u, 1));
    pave(g, f.x(u, -1), f.z(u, -1));
  }
  for (let u = 0; u <= 1; u++) g.stairs(f.x(u, 0), f.z(u, 0), f.dir(0));
  S.way(d, 0, 1);
  S.way(d, 0, -1);
  return true;
}

/** The species roll R-P01 uses for a tree that matches no earlier case. */
function looseSpecies(seed: number, x: number, y: number, z: number): 'round' | 'cypress' | 'bush' {
  const roll = rand(seed, 'R-P01', key(x, y, z));
  return roll < TREE.mixRound ? 'round' : roll < TREE.mixRound + TREE.mixCypress ? 'cypress' : 'bush';
}

/** A willow: a tree on land that is not sand, beside open water (the rare shore that is not beach). */
export function buildWillow(town: Town): boolean {
  const { g, site } = town;
  const openWater = (x: number, z: number): boolean => g.inMap(x, z) && g.h(x, z) === 0 && !g.world.blocks.has(key(x, 0, z));
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      if (!g.free(x, z) || g.h(x, z) === 0 || site.isSand(x, z) || g.groundTaken(x, z)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => openWater(x + dx!, z + dz!))) continue;
      startDistrict(town, 'willow', x, z);
      if (g.put('tree', x, g.h(x, z), z, 0)) {
        g.mark(x, z, CLAIM.built);
        // Keep its water open: a dock beside it would make it a plain tree.
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (g.h(x + dx, z + dz) === 0) g.mark(x + dx, z + dz, CLAIM.keep);
        return true;
      }
    }
  }
  return false;
}

/** Trees: a grove, a willow by the water, and loose trees (round, cypress and bush) dotted round the town. */
export function buildTrees(town: Town): void {
  const { g, site } = town;
  startDistrict(town, 'trees', town.square?.x ?? 24, town.square?.z ?? 24);
  const plantable = (x: number, z: number): boolean => {
    if (!g.free(x, z) || g.h(x, z) === 0 || g.groundTaken(x, z)) return false;
    return !g.world.floors.has(key(x, g.h(x, z), z));
  };
  // A grove: six touching trees.
  const grove = search(g, 'grove', (f) => {
    if (!fits(g, f, 0, 0, 2, 1)) return null;
    const h = rectFlat(g, f, 0, 0, 2, 1);
    if (h < 0 || h >= TREE.pineLevel) return null;
    if (site.waterDist[columnIndex(f.ox, f.oz)]! < 3) return null;
    const d = fromSquare(town, f.ox, f.oz);
    if (d < 8) return null;
    return { score: Math.abs(d - 14), data: h };
  }, { turns: [0] });
  if (grove) {
    const G = new Local(g, grove.frame);
    for (let v = 0; v <= 1; v++) for (let u = 0; u <= 2; u++) if (u !== 2 || v !== 1) G.put('tree', u, grove.data, v, 0);
    G.claim(-1, -1, 3, 2, CLAIM.built);
  }
  // Loose trees: alone (no tree beside), away from water, plazas and the hilltop pines, until every kind of the mix stands.
  const want = { round: 4, cypress: 3, bush: 3 };
  const spots: [number, number, number][] = [];
  for (let z = 0; z < 48; z++) {
    for (let x = 0; x < 48; x++) {
      if (!plantable(x, z) || site.waterDist[columnIndex(x, z)]! < 2 || g.h(x, z) >= TREE.pineLevel) continue;
      const d = fromSquare(town, x, z);
      if (d < 5) continue;
      spots.push([x, z, g.rand('loose', x, z) * 30 + Math.abs(d - 12)]);
    }
  }
  spots.sort((a, b) => a[2] - b[2]);
  for (const [x, z] of spots) {
    if (want.round + want.cypress + want.bush <= 0) break;
    if (!plantable(x, z)) continue;
    const y = g.h(x, z);
    let nearTree = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      for (const dy of [-1, 0, 1]) if (g.block(x + dx, y + dy, z + dz)?.kind === 'tree') nearTree = true;
      for (const dy of [0, 1]) {
        const f = g.world.floors.get(key(x + dx, y + dy, z + dz));
        if (f === 'plaza') nearTree = true;
      }
    }
    if (nearTree) continue;
    const kind = looseSpecies(g.world.seed, x, y, z);
    if (want[kind] <= 0) continue;
    if (g.put('tree', x, y, z, 0)) {
      want[kind]--;
      g.mark(x, z, CLAIM.built);
    }
  }
}
