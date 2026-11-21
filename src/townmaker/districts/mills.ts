// Windmills in every town (Derek, 2026-11-21: "I really like the look of
// windmills and I want to see more of them"). Several forms, so one always
// fits and they do not look stamped; each tried where it suits the kind:
//
//   'hill'    a lone mill on a rise or a headland, a path up to it (the
//             classic silhouette)
//   'shore'   a mill on the shore near the docks (a harbour's mill by the
//             warehouses)
//   'small'   the small mill corner: the mill, one cottage against it (a
//             mill house, R-H03), a little wheat patch (R-G01: a garden
//             within two of a windmill is wheat, on purpose)
//   'field'   a mill at a field's edge with its wheat strip (a row of
//             these along the fields in farming and garden towns)
//   'market'  a mill just off the market, a street's length from the
//             square, so the bread chain (L51: grain, the mill, the baker)
//             runs short
//   'town'    a tall town mill on a tower stack rising above the roofs of a
//             dense quarter, where there is no ground (R-W01 'raised', a
//             gallery, J25)
//
// Every mill keeps clear air round it (no building within two, its ring
// kept free of later gardens, which it would turn to wheat), stands six or
// more from any other mill, and gets a path to the streets (the bread chain,
// L51, sends its errand to the mill nearest the bakery that a walker can
// reach). Heights vary (two to four), and so does the cap's facing.

import { columnIndex, key, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import { CLAIM, type Grower } from '../grower';
import { search, type Frame } from '../frame';
import { fromSquare, rectFlat, rectFree, startDistrict, type Town, Local } from '../town';
import { joinedStreets, pave } from '../route';
import { D4 } from '../site';

export type MillForm = 'hill' | 'shore' | 'small' | 'field' | 'market' | 'town';

/** Columns holding a windmill (one each), for spacing and counting. */
function mills(g: Grower): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<number>();
  for (const [c, b] of g.world.blocks) {
    if (b.kind !== 'windmill' || seen.has(c & 4095)) continue;
    seen.add(c & 4095);
    out.push([c & 63, (c >> 6) & 63]);
  }
  return out;
}

/** Nothing built and no claim kept within `r` of the column (Chebyshev). */
function clearAround(g: Grower, x: number, z: number, r: number): boolean {
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, nz = z + dz;
      if (!g.inMap(nx, nz)) return false;
      if (g.claimed(nx, nz, CLAIM.built | CLAIM.keep | CLAIM.clear)) return false;
      if (g.groundTaken(nx, nz)) return false;
    }
  }
  return true;
}

/** No building within two of the column rises to the sails (the mill's top at level `top`). */
function airClear(g: Grower, x: number, z: number, top: number): boolean {
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if ((dx || dz) && g.top(x + dx, z + dz) >= top) return false;
  return true;
}

/**
 * No garden within two of the column that is not wheat already (R-G01 would
 * turn a park, a kitchen garden or a walled garden into wheat).
 */
function spareGardens(town: Town, x: number, z: number): boolean {
  const { g } = town;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, nz = z + dz;
      if (!g.inMap(nx, nz) || g.world.floors.get(key(nx, g.h(nx, nz), nz)) !== 'garden') continue;
      const owner = town.districts.find((d) => d.id === g.owner[columnIndex(nx, nz)]);
      if (!owner || !/^(wheat|windmill|mill)/.test(owner.name)) return false;
    }
  }
  return true;
}

/**
 * Steps on foot from every column to the nearest street joined to the
 * square (land, one level at a step, round buildings and kept ground): a
 * mill near a street that joins nothing (across a river, on an islet) would
 * be left unjoined.
 */
function streetSteps(town: Town): Int32Array {
  const { g } = town;
  const dist = new Int32Array(48 * 48).fill(1 << 20);
  const sq = town.districts.find((d) => d.name === 'square') ?? town.districts.find((d) => g.streetOf.includes(d.id));
  if (!sq) return dist;
  const roots: CellKey[] = [];
  for (let i = 0; i < g.streetOf.length; i++) if (g.streetOf[i] === sq.id) roots.push(key(i % 48, g.h(i % 48, Math.floor(i / 48)), Math.floor(i / 48)));
  const queue: number[] = [];
  for (const c of joinedStreets(g, roots)) {
    const i = columnIndex(keyX(c), keyZ(c));
    if (dist[i] === 0 || keyY(c) !== g.h(keyX(c), keyZ(c))) continue;
    dist[i] = 0;
    queue.push(i);
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!, x = i % 48, z = Math.floor(i / 48);
    for (const [dx, dz] of D4) {
      const nx = x + dx, nz = z + dz;
      if (!g.inMap(nx, nz) || g.h(nx, nz) === 0 || Math.abs(g.h(nx, nz) - g.h(x, z)) > 1) continue;
      const j = columnIndex(nx, nz);
      if (dist[j]! <= dist[i]! + 1 || g.groundTaken(nx, nz) || (g.claim[j]! & (CLAIM.built | CLAIM.keep)) !== 0) continue;
      const fl = g.world.floors.get(key(nx, g.h(nx, nz), nz));
      if (fl !== undefined && fl !== 'path' && fl !== 'plaza') continue;
      dist[j] = dist[i]! + 1;
      queue.push(j);
    }
  }
  return dist;
}

/** Steps from the nearest column beside (x, z) that its door could open on to the joined streets. */
function reach(g: Grower, dist: Int32Array, x: number, z: number): number {
  let best = 1 << 20;
  for (const [dx, dz] of D4) {
    const nx = x + dx, nz = z + dz;
    if (!g.inMap(nx, nz) || g.h(nx, nz) === 0 || Math.abs(g.h(nx, nz) - g.h(x, z)) > 1) continue;
    best = Math.min(best, dist[columnIndex(nx, nz)]!);
  }
  return best;
}

/**
 * One windmill of the given form; returns false when no site suits. `n`
 * seeds its variety and names its district.
 */
export function buildWindmill(town: Town, form: MillForm, n: number, anywhere = false): boolean {
  const { g, site } = town;
  const others = mills(g);
  const toStreet = streetSteps(town);
  const spaced = (x: number, z: number): boolean => others.every(([mx, mz]) => Math.abs(mx - x) + Math.abs(mz - z) >= 7);
  const height = form === 'town' ? 2 : form === 'small' ? 2 : 2 + (g.rand('mill-height', n) < 0.5 ? 1 : 0);

  if (form === 'town') {
    // A tower of two with the mill on top, in the built-up town, on a free column with a street beside.
    let best: [number, number, number] | null = null;
    for (let z = 2; z < 46; z++) {
      for (let x = 2; x < 46; x++) {
        if (!spaced(x, z) || !g.free(x, z) || g.groundTaken(x, z) || g.h(x, z) === 0) continue;
        if (g.world.floors.has(key(x, g.h(x, z), z))) continue;
        const d = fromSquare(town, x, z);
        if (d < 5 || d > 14) continue;
        // No house, tower or garden beside (a one-storey house against a short tower is a smithy).
        let ok = true;
        for (const [dx, dz] of D4) {
          const nx = x + dx, nz = z + dz;
          if (g.block(nx, g.h(nx, nz), nz) || g.world.floors.get(key(nx, g.h(nx, nz), nz)) === 'garden') ok = false;
        }
        if (!ok || reach(g, toStreet, x, z) > 0 || !spareGardens(town, x, z) || !airClear(g, x, z, g.h(x, z) + 4)) continue;
        // In a dense quarter: count the built columns round it.
        let built = 0;
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (g.groundTaken(x + dx, z + dz)) built++;
        const score = -built + g.rand('town-mill', x, z);
        if (built >= 8 && (!best || score < best[2])) best = [x, z, score];
      }
    }
    if (!best) return false;
    const [x, z] = best;
    startDistrict(town, `windmill-town${n}`, x, z);
    const h = g.h(x, z);
    g.stack('tower', x, z, 2, g.colorFor('tower', [[x, h, z]], `mill-tower${n}`));
    g.put('windmill', x, h + 2, z, 0);
    g.put('windmill', x, h + 3, z, 0);
    g.mark(x, z, CLAIM.built);
    // Nothing against it later (a cottage against a short tower would read as a smithy).
    for (const [dx, dz] of D4) g.mark(x + dx, z + dz, CLAIM.open | CLAIM.clear);
    return true;
  }

  const r = form === 'hill' || form === 'shore' ? 1 : 2;
  const found = search(g, `windmill-${form}${n}`, (f: Frame) => {
    const x = f.ox, z = f.oz;
    const h = g.h(x, z);
    if (h === 0 || !spaced(x, z)) return null;
    const i = columnIndex(x, z);
    const water = site.waterDist[i]!;
    if (form === 'shore' ? water > 2 || water < 1 : water < 2) return null;
    if (!clearAround(g, x, z, r) || !spareGardens(town, x, z) || !airClear(g, x, z, h + height)) return null;
    // Room for the patch (and the cottage) to the local south and east.
    if (form !== 'hill' && form !== 'shore') {
      const len = form === 'field' ? 3 : 2;
      if (rectFlat(g, f, 0, 0, len, 1) !== h || !rectFree(g, f, 1, 0, len, 1)) return null;
    }
    if ((form === 'small' || form === 'market') && rectFlat(g, f, -1, 0, -1, 0) !== h) return null;
    const d = fromSquare(town, x, z);
    let score: number;
    switch (form) {
      case 'hill':
        // High, and higher than the ground round it: a rise or a headland.
        if (h < 2) return null;
        score = -h * 3 - site.exposure[i]! * 0.2 + Math.abs(d - 13) * 0.2;
        break;
      case 'shore':
        score = d * 0.3;
        break;
      case 'field': {
        // By the farmland: gardens (wheat, fields) within five.
        let near = 0;
        for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) if (g.world.floors.get(key(x + dx, g.h(x + dx, z + dz), z + dz)) === 'garden') near++;
        if (near === 0) return null;
        score = -near * 0.3 + Math.abs(d - 13) * 0.2;
        break;
      }
      case 'market':
        // A street's length from the square, a street beside it.
        if (d < 5 || d > 11 || reach(g, toStreet, x, z) > 2) return null;
        score = Math.abs(d - 7) * 0.5;
        break;
      default:
        if (d < 6) return null;
        score = Math.abs(d - 11) * 0.5;
    }
    // Near the streets joined to the square, so its path joins them (the bread chain walks to it).
    const steps = reach(g, toStreet, x, z);
    if (steps > 8 && !anywhere) return null;
    if (steps > 8) score += 20;
    score += steps * 0.25;
    return { score, data: h };
  }, { turns: form === 'hill' || form === 'shore' ? [0] : [0, 1, 2, 3] });
  if (!found) return false;
  const f = found.frame, h = found.data;
  const M = new Local(g, f);
  const d = startDistrict(town, `windmill-${form}${n}`, f.ox, f.oz);
  // Its ring kept clear: no building against its sails, no garden it would turn to wheat (streets may pass).
  M.claim(-2, -2, 2, 2, CLAIM.open | CLAIM.clear);
  M.claim(0, 0, 0, 0, CLAIM.built);
  M.stack('windmill', 0, 0, height, 0);
  if (form !== 'hill' && form !== 'shore') {
    // The wheat patch beside it, fenced on its far side.
    const len = form === 'field' ? 3 : 2;
    M.claim(1, 0, len, 1, CLAIM.built);
    for (let u = 1; u <= len; u++) for (let v = 0; v <= 1; v++) M.floor('garden', u, v, h);
    for (let u = 1; u <= len; u++) M.edge(u, h, 1, 2, 'fence');
    M.edge(len, h, 0, 1, 'fence');
    M.edge(len, h, 1, 1, 'fence');
  }
  if (form === 'small' || form === 'market') M.mark(-1, 0, CLAIM.built);
  if (form === 'small' || form === 'market') M.house(-1, 0, -1, 0, 1 + (g.rand('mill-cottage', n) < 0.5 ? 1 : 0), `mill-house${n}`);
  // A path to its door: from the column beside it nearest the streets (by walking).
  const doors = ([[0, -1], [0, 1], [-1, 0], [1, 0]] as const)
    .map(([u, v]) => [f.x(u, v), f.z(u, v)] as const)
    .filter(([x, z]) => g.h(x, z) > 0 && Math.abs(g.h(x, z) - h) <= 1 && !g.groundTaken(x, z) && !g.claimed(x, z, CLAIM.built | CLAIM.keep))
    .filter(([x, z]) => { const fl = g.world.floors.get(key(x, g.h(x, z), z)); return fl === undefined || fl === 'path' || fl === 'plaza'; })
    .sort((a, b) => toStreet[columnIndex(a[0], a[1])]! - toStreet[columnIndex(b[0], b[1])]!);
  for (const [x, z] of doors) {
    if (pave(g, x, z)) {
      d.ways.push([x, z]);
      break;
    }
  }
  return true;
}

/** The forms each kind of town tries, best first, and how many mills it wants. */
export const MILL_PLANS: Record<string, { forms: readonly MillForm[]; want: number }> = {
  harbour: { forms: ['shore', 'hill', 'small', 'town'], want: 2 },
  marble: { forms: ['hill', 'small', 'shore'], want: 2 },
  castle: { forms: ['hill', 'small', 'town', 'hill'], want: 2 },
  market: { forms: ['market', 'small', 'town', 'hill'], want: 2 },
  river: { forms: ['small', 'hill', 'field', 'town'], want: 2 },
  farming: { forms: ['field', 'hill', 'field', 'small', 'field'], want: 3 },
  hill: { forms: ['hill', 'hill', 'small', 'hill', 'town'], want: 4 },
  gardens: { forms: ['field', 'small', 'hill', 'field', 'town'], want: 3 },
};

/**
 * The town's windmills: the kind's forms in order until it has `want` of
 * them (counting the mills already standing: a farm's, the mill corner),
 * each form trying again with the next when it finds no site, twice round;
 * then any form at all toward `want`; then one beyond a short walk of the
 * streets, so a town always gets one where the island allows.
 */
export function buildWindmills(town: Town, kind: string): number {
  const plan = MILL_PLANS[kind] ?? { forms: ['hill', 'small'], want: 2 };
  const count = (): number => mills(town.g).length;
  let n = 0;
  for (const form of [...plan.forms, ...plan.forms, 'small', 'hill', 'field', 'market', 'shore', 'town'] as const) {
    if (count() >= plan.want) break;
    buildWindmill(town, form, n++);
  }
  // A town whose streets reach little of its island (a hill town on a spine): one mill where the land allows, its path joined if it can be.
  for (const form of ['hill', 'small'] as const) {
    if (count() >= 1) break;
    buildWindmill(town, form, n++, true);
  }
  return count();
}
