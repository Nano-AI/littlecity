// Castles, for L36 (garrison) and L37 (rider). Not a rule file. Pure: the
// rules and the garrison system (src/life/people/garrison.system.ts) read the
// same answer from the same plan.
//
// A castle is a group of touching castle structures (a keep, curtain walls,
// gatehouses, castle turrets) that holds a keep with battlements, or curtain
// walls of 8+ cells with a gatehouse or a turret. (A podium or a theatre is
// never a keep, R-M08 and R-M09; FX-11.) Its gate is where the troop halts each lap
// and the rider sets out: a gatehouse's arch, else a gate in a curtain wall,
// else the keep's door.

import { columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import type { NavGraph, ShapePlan, StructureId } from '@/resolve/plan';

export interface Castle {
  /** The structures, lowest id first; `id` is the first (the castle's name in the plan). */
  id: StructureId;
  structures: StructureId[];
  keep: StructureId | null;
  /** Columns (columnIndex) the castle stands on. */
  columns: Set<number>;
  wallCells: number;
  /** Where the troop halts and the rider sets out: a graph node, and the way out (unit x, z). */
  gate: { node: number; dx: number; dz: number } | null;
  /** 4 for a small castle, 6 for a keep with walls (L36). */
  troop: number;
}

const CASTLE_ROLES = new Set(['keep', 'gatehouse', 'castle-turret', 'curtain-wall']);

export function findCastles(plan: ShapePlan, nav: NavGraph | null): Castle[] {
  const members = [...plan.structures.values()].filter((s) => CASTLE_ROLES.has(plan.roles.get(s.id)?.role ?? '') && s.cells.length > 0).sort((a, b) => a.id - b.id);
  const byColumn = new Map<number, StructureId[]>();
  for (const s of members) {
    for (const c of s.cells) {
      const k = columnIndex(keyX(c), keyZ(c));
      const list = byColumn.get(k) ?? [];
      if (!list.includes(s.id)) list.push(s.id);
      byColumn.set(k, list);
    }
  }
  // Group touching members (side or corner).
  const group = new Map<StructureId, StructureId>();
  const find = (a: StructureId): StructureId => {
    let r = a;
    while (group.get(r) !== r) r = group.get(r)!;
    group.set(a, r);
    return r;
  };
  for (const s of members) group.set(s.id, s.id);
  for (const s of members) {
    for (const c of s.cells) {
      const x = keyX(c), z = keyZ(c);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (!inColumnBounds(x + dx, z + dz)) continue;
          for (const o of byColumn.get(columnIndex(x + dx, z + dz)) ?? []) {
            const ra = find(s.id), rb = find(o);
            if (ra !== rb) group.set(Math.max(ra, rb), Math.min(ra, rb));
          }
        }
      }
    }
  }
  // A keep standing inside its curtain walls belongs to them though it touches none: groups whose
  // footprints' bounds overlap are one castle.
  const box = new Map<StructureId, [number, number, number, number]>();
  const boxOf = (): void => {
    box.clear();
    for (const s of members) {
      const r = find(s.id);
      const b = box.get(r) ?? [Infinity, -Infinity, Infinity, -Infinity];
      for (const c of s.cells) {
        b[0] = Math.min(b[0], keyX(c));
        b[1] = Math.max(b[1], keyX(c));
        b[2] = Math.min(b[2], keyZ(c));
        b[3] = Math.max(b[3], keyZ(c));
      }
      box.set(r, b);
    }
  };
  for (let merged = true; merged; ) {
    merged = false;
    boxOf();
    const roots = [...box.keys()].sort((a, b) => a - b);
    for (let i = 0; i < roots.length && !merged; i++) {
      for (let j = i + 1; j < roots.length && !merged; j++) {
        const a = box.get(roots[i]!)!, b = box.get(roots[j]!)!;
        if (a[0] <= b[1] && b[0] <= a[1] && a[2] <= b[3] && b[2] <= a[3]) {
          group.set(roots[j]!, roots[i]!);
          merged = true;
        }
      }
    }
  }
  const groups = new Map<StructureId, StructureId[]>();
  for (const s of members) {
    const r = find(s.id);
    groups.set(r, [...(groups.get(r) ?? []), s.id]);
  }
  const out: Castle[] = [];
  for (const [id, ids] of [...groups].sort((a, b) => a[0] - b[0])) {
    const role = (s: StructureId): string => plan.roles.get(s)?.role ?? '';
    // A real castle (FX-11): a keep that is embattled, or curtain walls of 8+ cells with a gatehouse or a turret.
    const keep = ids.find((s) => role(s) === 'keep' && (plan.featuresByStructure.get(s) ?? []).some((f) => f.type === 'battlement')) ?? null;
    const wallCells = ids.filter((s) => role(s) === 'curtain-wall').reduce((n, s) => n + plan.structures.get(s)!.cells.length, 0);
    const guarded = ids.some((s) => role(s) === 'gatehouse' || role(s) === 'castle-turret');
    if (keep === null && !(wallCells >= 8 && guarded)) continue;
    const columns = new Set<number>();
    for (const s of ids) for (const c of plan.structures.get(s)!.cells) columns.add(columnIndex(keyX(c), keyZ(c)));
    const castle: Castle = { id, structures: ids, keep, columns, wallCells, gate: null, troop: keep !== null && wallCells >= 8 ? 6 : 4 };
    castle.gate = nav ? gateOf(plan, nav, castle) : null;
    out.push(castle);
  }
  return out;
}

/** The middle of a castle's footprint. */
export function castleCentre(c: Castle): { x: number; z: number } {
  let x = 0, z = 0;
  for (const k of c.columns) {
    x += (k % SIZE_X) + 0.5;
    z += Math.floor(k / SIZE_X) + 0.5;
  }
  return { x: x / c.columns.size, z: z / c.columns.size };
}

function gateOf(plan: ShapePlan, nav: NavGraph, c: Castle): Castle['gate'] {
  const centre = castleCentre(c);
  const outward = (cell: CellKey): { dx: number; dz: number } => {
    // The side of the cell that faces away from the castle's middle most.
    let best = { dx: 0, dz: 1 }, score = -Infinity;
    for (const [dx, dz] of DIR4) {
      const s = (keyX(cell) + 0.5 - centre.x) * dx + (keyZ(cell) + 0.5 - centre.z) * dz;
      if (s > score) {
        score = s;
        best = { dx, dz };
      }
    }
    return best;
  };
  // A gatehouse's arch, or a gate in a curtain wall: a passage node by or in the castle.
  const passages: number[] = [];
  for (let i = 0; i < nav.nodes.length; i++) {
    const n = nav.nodes[i]!;
    if (n.passage === undefined) continue;
    const x = keyX(n.cell), z = keyZ(n.cell);
    let near = c.columns.has(columnIndex(x, z));
    // In the wall line: within two cells of the castle (a gatehouse of plain marble still stands between its walls).
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (inColumnBounds(x + dx, z + dz) && c.columns.has(columnIndex(x + dx, z + dz))) near = true;
    if (near) passages.push(i);
  }
  if (passages.length > 0) {
    // The one nearest the keep, or the first.
    passages.sort((a, b) => nav.nodes[a]!.cell - nav.nodes[b]!.cell);
    const node = passages[0]!;
    const [dx, dz] = DIR4[nav.nodes[node]!.passage!]!;
    const o = outward(nav.nodes[node]!.cell);
    const sign = dx * o.dx + dz * o.dz >= 0 ? 1 : -1;
    // The node just outside the passage, if there is one: that is where a troop halts and a horse waits.
    const n = nav.nodes[node]!.cell;
    const outside = nav.nodeAt.get(cellBeside(n, dx * sign, dz * sign));
    return { node: outside ?? node, dx: dx * sign, dz: dz * sign };
  }
  for (const s of c.structures) {
    const door = (nav.doorsOf.get(s) ?? []).map((i) => nav.doors[i]!).find((d) => d.node >= 0 && d.dir !== undefined);
    if (door) {
      const [dx, dz] = DIR4[door.dir!]!;
      return { node: door.node, dx, dz };
    }
  }
  // No gate and no door (a keep on its own): the troop halts at the foot of the side that faces the nearest
  // street, or else the most open side.
  const streets: number[] = [];
  for (let i = 0; i < nav.nodes.length; i++) if (nav.nodes[i]!.surface === 'path' || nav.nodes[i]!.surface === 'plaza') streets.push(i);
  let best: Castle['gate'] = null;
  let bestScore = -Infinity;
  for (let i = 0; i < nav.nodes.length; i++) {
    const n = nav.nodes[i]!;
    if (n.rot !== undefined || n.passage !== undefined) continue;
    const x = keyX(n.cell), z = keyZ(n.cell);
    if (c.columns.has(columnIndex(x, z))) continue;
    for (const [dx, dz] of DIR4) {
      // Right at the foot of the castle: the castle is one step behind it.
      if (!inColumnBounds(x - dx, z - dz) || !c.columns.has(columnIndex(x - dx, z - dz))) continue;
      let street = Infinity;
      for (const s of streets) {
        if (nav.part[s] !== nav.part[i]) continue;
        street = Math.min(street, Math.abs(keyX(nav.nodes[s]!.cell) - x) + Math.abs(keyZ(nav.nodes[s]!.cell) - z));
      }
      let open = 0;
      for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) if (inColumnBounds(x + ox, z + oz) && nav.nodeAt.has(key(x + ox, keyY(n.cell), z + oz))) open++;
      const score = (Number.isFinite(street) ? 100 - street : 0) * 30 + open;
      if (score > bestScore) {
        bestScore = score;
        best = { node: i, dx, dz };
      }
    }
  }
  return best;
}

function cellBeside(cell: CellKey, dx: number, dz: number): CellKey {
  const x = keyX(cell) + dx, z = keyZ(cell) + dz;
  if (x < 0 || z < 0 || x >= SIZE_X || z >= SIZE_Z) return -1;
  return key(x, keyY(cell), z);
}

/** Seeded per castle. */
export const castleSeed = (seed: number, c: Castle): number => hash(seed, 'castle', c.id);
