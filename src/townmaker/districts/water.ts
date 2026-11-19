// Crossing the water: a boardwalk of docks over an inlet with beach at both
// ends, a stone bridge (arches at sea level) over a narrow channel, and a
// short jetty. Each looks for a straight run of open water between two
// pieces of land and lays a path over it so the street network crosses.

import { columnIndex, key } from '@/core/grid';
import { CLAIM, type Grower } from '../grower';
import { search } from '../frame';
import { fits, fromSquare, startDistrict, type Town, Local } from '../town';
import { pave } from '../route';

function openWater(g: Grower, x: number, z: number): boolean {
  // Water kept clear (beside the willow) counts as taken.
  return g.inMap(x, z) && g.h(x, z) === 0 && !g.world.blocks.has(key(x, 0, z)) && !g.claimed(x, z, CLAIM.keep);
}
function seaBlockBeside(g: Grower, x: number, z: number): boolean {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (g.inMap(x + dx, z + dz) && g.world.blocks.has(key(x + dx, 0, z + dz))) return true;
  }
  return false;
}

/**
 * A crossing: land at u = 0 and u = n + 1 (height 1, free), open water at
 * u = 1 … n, and land beyond each end for the street to go on.
 */
function findCrossing(town: Town, name: string, min: number, max: number) {
  const { g } = town;
  let best = null;
  for (let n = min; n <= max && !best; n++) {
    best = search(g, `${name}${n}`, (f) => {
      for (const u of [0, n + 1]) {
        const x = f.x(u, 0), z = f.z(u, 0);
        if (g.h(x, z) !== 1 || !g.free(x, z) || g.groundTaken(x, z)) return null;
      }
      for (let u = 1; u <= n; u++) {
        const x = f.x(u, 0), z = f.z(u, 0);
        if (!openWater(g, x, z) || seaBlockBeside(g, x, z)) return null;
      }
      // Room to step off at each end.
      for (const u of [-1, n + 2]) {
        const h = g.h(f.x(u, 0), f.z(u, 0));
        if (h === 0 || h > 2 || g.claimed(f.x(u, 0), f.z(u, 0), CLAIM.built | CLAIM.keep)) return null;
      }
      return { score: fromSquare(town, f.ox, f.oz) * 0.3, data: n };
    }, { turns: [0, 1] });
  }
  return best;
}

export function buildBoardwalk(town: Town): boolean {
  const { g } = town;
  const found = findCrossing(town, 'boardwalk', 2, 6);
  if (!found) return false;
  const f = found.frame;
  const n = found.data;
  const B = new Local(g, f);
  const d = startDistrict(town, 'boardwalk', f.x(n / 2, 0), f.z(n / 2, 0));
  for (const u of [-1, 0, n + 1, n + 2]) pave(g, f.x(u, 0), f.z(u, 0));
  for (let u = 1; u <= n; u++) B.put('auto', u, 0, 0, 'auto');
  for (let u = 1; u <= n; u++) B.floor('path', u, 0, 1);
  B.claim(0, 0, n + 1, 0, CLAIM.built);
  B.way(d, -1, 0);
  B.way(d, n + 2, 0);
  return true;
}

export function buildBridge(town: Town): boolean {
  const { g } = town;
  const found = findCrossing(town, 'bridge', 1, 4);
  if (!found) return false;
  const f = found.frame;
  const n = found.data;
  const B = new Local(g, f);
  const d = startDistrict(town, 'bridge', f.x(n / 2, 0), f.z(n / 2, 0));
  for (const u of [-1, 0, n + 1, n + 2]) pave(g, f.x(u, 0), f.z(u, 0));
  for (let u = 1; u <= n; u++) B.put('arch', u, 0, 0, 0);
  for (let u = 1; u <= n; u++) B.floor('path', u, 0, 1);
  B.claim(0, 0, n + 1, 0, CLAIM.built);
  B.way(d, -1, 0);
  B.way(d, n + 2, 0);
  return true;
}

/** Two Auto blocks out from the shore: a jetty. */
export function buildJetty(town: Town): boolean {
  const { g, site } = town;
  const found = search(g, 'jetty', (f) => {
    const h = g.h(f.ox, f.oz);
    if (h !== 1 || !g.free(f.ox, f.oz)) return null;
    for (let v = 1; v <= 3; v++) {
      if (!openWater(g, f.x(0, v), f.z(0, v)) || seaBlockBeside(g, f.x(0, v), f.z(0, v))) return null;
    }
    const back = g.h(f.x(0, -1), f.z(0, -1));
    if (back === 0 || back > 2 || g.claimed(f.x(0, -1), f.z(0, -1), CLAIM.built | CLAIM.keep)) return null;
    const d = fromSquare(town, f.ox, f.oz);
    return { score: Math.abs(d - 14) * 0.5 + site.exposure[columnIndex(f.ox, f.oz)]! * 0.1, data: null };
  });
  if (!found) return false;
  const f = found.frame;
  const J = new Local(g, f);
  const d = startDistrict(town, 'jetty', f.ox, f.oz);
  pave(g, f.ox, f.oz);
  pave(g, f.x(0, -1), f.z(0, -1));
  J.put('auto', 0, 0, 1, 'auto');
  J.put('auto', 0, 0, 2, 'auto');
  J.claim(0, 0, 0, 2, CLAIM.built);
  J.way(d, 0, -1);
  return true;
}

/**
 * A viaduct across a dip: two terraces of one height with lower ground (a
 * step down or a valley) between them, two to six columns wide. Arches at
 * the terraces' top level fill the gap (standing on the dip floor where it is
 * one level down, spanning it where it is deeper), a path runs across their
 * deck from terrace to terrace, and the lane below passes under the arches.
 */
export function buildViaduct(town: Town): boolean {
  const { g } = town;
  let found = null;
  for (let n = 4; n >= 2 && !found; n = n === 4 ? 3 : n === 3 ? 5 : n === 5 ? 2 : 0) {
    const len = n;
    found = search(g, `viaduct${len}`, (f) => {
      const top = g.h(f.ox, f.oz);
      if (top < 2 || g.h(f.x(len + 1, 0), f.z(len + 1, 0)) !== top) return null;
      for (const u of [-1, len + 2]) if (Math.abs(g.h(f.x(u, 0), f.z(u, 0)) - top) > 1 || g.h(f.x(u, 0), f.z(u, 0)) === 0) return null;
      for (let u = 1; u <= len; u++) {
        const h = g.h(f.x(u, 0), f.z(u, 0));
        if (h === 0 || h >= top) return null;
      }
      if (!fits(g, f, 0, 0, len + 1, 0, 0)) return null;
      const d = fromSquare(town, f.x(len / 2, 0), f.z(len / 2, 0));
      return { score: Math.abs(d - 11) * 0.5 - len, data: { len, top } };
    }, { turns: [0, 1] });
  }
  if (!found) return false;
  const f = found.frame;
  const { len, top } = found.data;
  const V = new Local(g, f);
  const d = startDistrict(town, 'viaduct', f.x(len / 2, 0), f.z(len / 2, 0));
  V.claim(1, 0, len, 0, CLAIM.built);
  pave(g, f.ox, f.oz);
  pave(g, f.x(len + 1, 0), f.z(len + 1, 0));
  for (let u = 1; u <= len; u++) V.put('arch', u, top - 1, 0, 0);
  for (let u = 1; u <= len; u++) V.floor('path', u, 0, top);
  V.way(d, 0, 0);
  V.way(d, len + 1, 0);
  return true;
}
