// Berths for the big ships (catalogue L38–L40, "Big ships").
//
// A BERTH is a straight run of quay: dock cells at sea level, or quay-wall
// marble (R-M05) at level 0 or 1, all with open water on the same side, and
// that water open at least SHIPS.berthWater (3) columns out for the run's
// whole length plus one column past each end. Open water here means no land
// and nothing built in the column at any height (a bridge over the water
// would catch a mast).
//
// The HARBOUR is which berth each kind of ship would use, with the way it
// lies there (bow one way or the other along the quay), checked by sailing
// it: a whole hull must be able to come in from an edge of the map, line up
// and come alongside, and leave by going on ahead and round to an edge
// (ship-routes.ts). A berth no ship can reach is no berth.
//
// The water a chosen berth needs is RESERVED: the small boats keep out of it
// (L17 puts no rowboat on a mooring there; L18's fishing boat lies elsewhere).
//
// Dressing stage only (it reads the quay walls' roles from the finished
// shape). Pure; computed once per resolve.

import { columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineFact, type Facts } from '@/resolve/facts/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { townFacts } from '@/resolve/facts/town.fact';
import { SHIPS } from '@/style/ships';
import { hullClear as hullClearAt, mooringAt, obstacleColumns, planArrival, planDeparture, seaField, type HullSize, type Mooring, type SeaField } from './ship-routes';

export type BigShip = 'galleon' | 'cog' | 'galley';

export interface Berth {
  /** Stable name: first quay column, the way the run goes, the water side. */
  key: string;
  /** The first quay column of the run (west- or north-most). */
  x: number;
  z: number;
  /** The way the run goes (E or S) and the side the water is on. */
  along: Dir4;
  out: Dir4;
  cells: number;
  /** The quay's face, in world units: from (ax, az), `len` along (dx, dz); the water toward (ox, oz). */
  face: { ax: number; az: number; dx: number; dz: number; len: number; ox: number; oz: number };
  /** The level people stand on along it (a dock's deck is level 1). */
  level: number;
  /** Columns of water it needs (column indices). */
  water: number[];
}

export interface ShipPlan {
  berth: Berth;
  /** Bow along the run (+1) or against it (−1). */
  dir: 1 | -1;
  mooring: Mooring;
}

export interface Harbour {
  berths: readonly Berth[];
  galleon: ShipPlan | null;
  cog: ShipPlan | null;
  galley: ShipPlan | null;
  /** Columns of water reserved for the ships that call. */
  reserved: ReadonlySet<number>;
}

/** The hull each ship keeps clear with (its drawn hull plus a little; see rig.ts). */
export function hullSize(ship: BigShip | 'barge'): HullSize {
  switch (ship) {
    case 'galleon':
      return { stern: -2.85, bow: 3.55, halfBeam: SHIPS.galleonBeam / 2 };
    case 'cog':
      return { stern: -1.8, bow: 2.1, halfBeam: SHIPS.cogBeam / 2 };
    case 'galley':
      return { stern: -3.15, bow: 3.3, halfBeam: SHIPS.galleyBeam / 2 + 0.17 };
    default:
      return { stern: -1.65, bow: 1.62, halfBeam: SHIPS.bargeBeam / 2 };
  }
}

/** How many cells of berth a ship needs, and how big a port. */
export function needs(ship: BigShip): { berth: number; port: number } {
  if (ship === 'galleon') return { berth: SHIPS.galleonBerth, port: SHIPS.galleonPort };
  if (ship === 'cog') return { berth: SHIPS.cogBerth, port: SHIPS.cogPort };
  return { berth: SHIPS.galleyBerth, port: 0 };
}

/** Quay columns: a dock at sea level, or a quay wall's low cell. Value: the level people stand on (+1), 0 if none. */
function quayColumns(f: Facts): Uint8Array {
  const q = new Uint8Array(SIZE_X * SIZE_Z);
  for (const [c, k] of f.kinds) {
    if (k === 'dock' && keyY(c) === 0) q[columnIndex(keyX(c), keyZ(c))] = 2;
  }
  if (f.shapeReady) {
    for (const [id, r] of f.shape.roles) {
      if (r.role !== 'quay-wall') continue;
      const s = f.structures.get(id);
      if (!s) continue;
      for (const c of s.cells) {
        if (keyY(c) > 1 || f.kinds.has(key(keyX(c), keyY(c) + 1, keyZ(c)))) continue;
        const i = columnIndex(keyX(c), keyZ(c));
        q[i] = Math.max(q[i]!, keyY(c) + 2);
      }
    }
  }
  return q;
}

/** Every berth in the town, longest first. */
export function findBerths(f: Facts): Berth[] {
  const quay = quayColumns(f);
  const blocked = obstacleColumns(f.terrain, f.kinds);
  const W = Math.max(1, Math.round(SHIPS.berthWater));
  const clear = (x: number, z: number): boolean => inColumnBounds(x, z) && blocked[columnIndex(x, z)] === 0;
  const out: Berth[] = [];
  for (const side of [0, 1, 2, 3] as Dir4[]) {
    const [ox, oz] = DIR4[side]!;
    const along: Dir4 = side === 0 || side === 2 ? 1 : 2;
    const [ax, az] = DIR4[along]!;
    const wet = (x: number, z: number): boolean => {
      for (let k = 1; k <= W; k++) if (!clear(x + ox * k, z + oz * k)) return false;
      return true;
    };
    const lines = along === 1 ? SIZE_Z : SIZE_X;
    const span = along === 1 ? SIZE_X : SIZE_Z;
    for (let l = 0; l < lines; l++) {
      const at = (p: number): [number, number] => (along === 1 ? [p, l] : [l, p]);
      let p = 0;
      while (p < span) {
        const [x, z] = at(p);
        if (!(quay[columnIndex(x, z)]! > 0 && wet(x, z))) {
          p++;
          continue;
        }
        let e = p;
        while (e + 1 < span) {
          const [nx, nz] = at(e + 1);
          if (quay[columnIndex(nx, nz)]! > 0 && wet(nx, nz)) e++;
          else break;
        }
        const next = e + 1;
        // One column of open water past each end, or the berth stops a cell short there.
        let i0 = p, i1 = e;
        const [bx, bz] = at(i0 - 1), [fx, fz] = at(i1 + 1);
        if (!(inColumnBounds(bx, bz) && wet(bx, bz))) i0++;
        if (!(inColumnBounds(fx, fz) && wet(fx, fz))) i1--;
        if (i1 - i0 + 1 >= 3) {
          const [x0, z0] = at(i0);
          const water: number[] = [];
          for (let q = i0 - 1; q <= i1 + 1; q++) {
            const [qx, qz] = at(q);
            for (let k = 1; k <= W; k++) if (inColumnBounds(qx + ox * k, qz + oz * k)) water.push(columnIndex(qx + ox * k, qz + oz * k));
          }
          const len = i1 - i0 + 1;
          const fx0 = along === 1 ? x0 : side === 1 ? x0 + 1 : x0;
          const fz0 = along === 2 ? z0 : side === 2 ? z0 + 1 : z0;
          let level = 0;
          for (let q = i0; q <= i1; q++) {
            const [qx, qz] = at(q);
            level = Math.max(level, quay[columnIndex(qx, qz)]! - 1);
          }
          out.push({
            key: `${x0},${z0},${along},${side}`,
            x: x0,
            z: z0,
            along,
            out: side,
            cells: len,
            face: { ax: fx0, az: fz0, dx: ax, dz: az, len, ox, oz },
            level,
            water: [...new Set(water)].sort((a, b) => a - b),
          });
        }
        p = next;
      }
    }
  }
  out.sort((a, b) => b.cells - a.cells || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out;
}

/**
 * The obstacles a ship sails round at a berth: the town, and the water off every mooring the small boats
 * may use (L17), except the berth's own (they keep out of it).
 */
export function planningField(f: Facts, berth: Berth | null, extra: Iterable<number> = []): SeaField {
  const blocked = obstacleColumns(f.terrain, f.kinds);
  const own = new Set(berth?.water ?? []);
  if (f.shapeReady) {
    for (const s of socketsOfType(f, 'mooring')) {
      if (s.dir === undefined) continue;
      const [dx, dz] = DIR4[s.dir]!;
      const x = keyX(s.cell) + dx, z = keyZ(s.cell) + dz;
      if (!inColumnBounds(x, z)) continue;
      const i = columnIndex(x, z);
      if (!own.has(i)) blocked[i] = 1;
    }
  }
  for (const i of extra) blocked[i] = 1;
  return seaField(blocked);
}

/** Margin a ship keeps from everything out at sea. */
export const SEA_MARGIN = 0.22;

/** Can this ship use this berth? The plan if so: which way it lies, checked by sailing in and out. */
export function planBerth(f: Facts, ship: BigShip, berth: Berth, field: SeaField = planningField(f, berth)): ShipPlan | null {
  const h = hullSize(ship);
  const first: 1 | -1 = hash(f.seed, 'berth-dir', ship, berth.key) % 2 === 0 ? 1 : -1;
  for (const dir of [first, -first as 1 | -1]) {
    const m = mooringAt(h, berth.face, dir, SHIPS.alongside, SHIPS.warpGap);
    if (!mooredClear(field, h, m)) continue;
    const arrive = planArrival(field, h, m, SHIPS.edgeIn, SEA_MARGIN);
    if (!arrive) continue;
    const leave = planDeparture(field, h, m, SHIPS.edgeIn, SEA_MARGIN);
    if (!leave) continue;
    return { berth, dir, mooring: m };
  }
  return null;
}

/** A hull lying at its mooring (and at its warp point) touches nothing. */
export function mooredClear(field: SeaField, h: HullSize, m: Mooring): boolean {
  // Alongside, it lies close to the quay: a margin of half the gap it keeps.
  return hullClearAt(field, h, m.x, m.z, m.yaw, SHIPS.alongside * 0.5) && hullClearAt(field, h, m.wx, m.wz, m.yaw, 0.1);
}

function choose(f: Facts, ship: BigShip, berths: readonly Berth[], taken: Set<string>): ShipPlan | null {
  const need = needs(ship).berth;
  for (const b of berths) {
    if (b.cells < need) continue;
    // Two kinds of ship may share a berth (they call at different times), but a free one is better.
    if (taken.has(b.key)) continue;
    const plan = planBerth(f, ship, b);
    if (plan) return plan;
  }
  for (const b of berths) {
    if (b.cells < need || !taken.has(b.key)) continue;
    const plan = planBerth(f, ship, b);
    if (plan) return plan;
  }
  return null;
}

export const harbour = defineFact<Harbour>('harbour', (f) => {
  const town = townFacts(f);
  const docks = town.cellsByKind.get('dock') ?? 0;
  const lighthouses = town.structuresByKind.get('lighthouse') ?? 0;
  const none: Harbour = { berths: [], galleon: null, cog: null, galley: null, reserved: new Set() };
  // No ship calls at a port of fewer docks than the smallest needs (a quay wall alone makes no port).
  if (docks < Math.min(SHIPS.cogPort, SHIPS.galleonPort) && lighthouses === 0) return none;
  const berths = findBerths(f);
  if (!berths.length) return { ...none, berths };
  const taken = new Set<string>();
  const galleon = docks >= SHIPS.galleonPort ? choose(f, 'galleon', berths, taken) : null;
  if (galleon) taken.add(galleon.berth.key);
  const cog = docks >= SHIPS.cogPort ? choose(f, 'cog', berths, taken) : null;
  if (cog) taken.add(cog.berth.key);
  const galley = lighthouses > 0 ? choose(f, 'galley', berths, taken) : null;
  const reserved = new Set<number>();
  for (const p of [galleon, cog, galley]) if (p) for (const i of p.berth.water) reserved.add(i);
  return { berths, galleon, cog, galley, reserved };
});
