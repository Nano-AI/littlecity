// R-M08 · Podium. A marble mass, 2 or more tall with a 2 × 2 in its
// footprint, that is plainly the base of something rather than a fortress:
//
//   it carries a temple (pillars standing on it hold up an R-M01 temple), or
//   a flight of grand steps is cut into it (R-M04's shape) that climbs to its
//   top level (steps up to the foot of a tower are a keep's) though it is
//   not mostly stair, or a quarter or more of its open top holds a floor, a
//   plinth, pillars, a fountain, a stall or a tree;
//
// and nothing of a castle touches it: no wall piece or wall edge, no
// gateway arch, no castle turret, no gatehouse. (With any of those it is a
// keep with a stair, R-M03.) A mass that is mostly stair stays R-M04's.
//
// A podium is drawn as marble, never coursed castle stone: a moulded base,
// a cornice, and a stone balustrade round the edges of its top that drop 2
// or more (a 'railing' feature per edge, which J19 then leaves alone). No
// battlements, so no garrison (L36) and no rider (L37).
//
// Why this exists (FX-01): the old keep test excused only "a mass that is
// mostly a flight of steps"; once a great stair merges with the platform it
// climbs to (same colour, one structure) the stair is a small part of the
// mass and the temple precinct grew battlements and soldiers.

import { above, columnIndex, edgeOf, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type RuleContext, type RuleOut } from '@/resolve/engine/api';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { joinRailEnds, dropSides } from '../joinery/J19.edge-railing.rule';
import { railVariantAt, standable } from '../joinery/edges-lib';
import { columnCount, grandSteps } from './R-M04.steps';

/** Kinds that, standing on a top, put it to use. */
const USES = new Set(['pillar', 'marble', 'fountain', 'stall', 'tree']);
const CASTLE = new Set(['gateway', 'castle-turret', 'gatehouse', 'keep']);

/** A 2 × 2 somewhere in the footprint. */
export function holdsSquare(s: Structure): boolean {
  const columns = new Set(s.cells.map((c) => columnIndex(keyX(c), keyZ(c))));
  return s.cells.some((c) => {
    const x = keyX(c), z = keyZ(c);
    return columns.has(columnIndex(x + 1, z)) && columns.has(columnIndex(x, z + 1)) && columns.has(columnIndex(x + 1, z + 1));
  });
}

/** Something of a castle beside the mass: a wall piece or edge, a gateway arch, a castle turret, a gatehouse. */
export function castleBeside(s: Structure, plan: ShapePlan): boolean {
  const mine = new Set(s.cells);
  for (const cell of s.cells) {
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const e = edgeOf(cell, d);
      if (e !== NO_CELL && plan.world.edges.get(e) === 'wall') return true;
      const n = neighbor(cell, d);
      if (n === NO_CELL || mine.has(n)) continue;
      const kind = plan.kinds.get(n);
      if (kind === 'wall') return true;
      if (kind === undefined) continue;
      const other = plan.structureAt.get(n);
      const role = other === undefined ? undefined : plan.roles.get(other)?.role;
      if (role !== undefined && CASTLE.has(role)) return true;
    }
  }
  return false;
}

/** A temple stands on this mass: one of its pillars stands on a cell of it. */
function carriesTemple(s: Structure, plan: ShapePlan): boolean {
  const mine = new Set(s.cells);
  for (const cell of s.cells) {
    const up = above(cell);
    if (up === NO_CELL || mine.has(up) || plan.kinds.get(up) !== 'pillar') continue;
    // Up the shaft to what it carries.
    let top = up;
    while (plan.kinds.get(above(top)) === 'pillar') top = above(top);
    const held = plan.structureAt.get(above(top));
    if (held !== undefined && plan.roles.get(held)?.role === 'temple') return true;
  }
  return false;
}

/** The share of the open top cells that something stands or lies on. */
function topInUse(s: Structure, plan: ShapePlan): number {
  const mine = new Set(s.cells);
  let tops = 0, used = 0;
  for (const cell of s.cells) {
    const up = above(cell);
    if (up === NO_CELL || mine.has(up)) continue;
    tops++;
    const kind = plan.kinds.get(up);
    if (plan.world.floors.has(up) || (kind !== undefined && USES.has(kind))) used++;
  }
  return tops === 0 ? 0 : used / tops;
}

export function isPodium(s: Structure, plan: ShapePlan): boolean {
  if (s.kind !== 'marble' || s.cells.length < 4) return false;
  if (keyY(s.cells[s.cells.length - 1]!) - keyY(s.cells[0]!) + 1 < 2) return false; // cells ascend by level
  if (!holdsSquare(s)) return false;
  const flight = grandSteps(s, plan);
  if (flight.length * 2 >= columnCount(s)) return false; // mostly stair: R-M04's grand steps
  if (castleBeside(s, plan)) return false;
  // A stair counts if it climbs to the top of the mass: up to a platform, not to the foot of a tower
  // (a keep with a forebuilding and steps up to it stays a keep).
  const top = keyY(s.cells[s.cells.length - 1]!);
  const toTheTop = flight.some((st) => keyY(st.cell) >= top); // its top step is level with the top
  return toTheTop || carriesTemple(s, plan) || topInUse(s, plan) >= 0.25;
}

interface Rail {
  cell: CellKey;
  dir: Dir4;
  from: number;
  to: number;
}

/** A balustrade on every edge of the top that drops 2 or more, where a person could stand. */
function balustrades(ctx: RuleContext, s: Structure): Rail[] {
  const mine = new Set(s.cells);
  const rails: Rail[] = [];
  for (const cell of s.cells) {
    const up = above(cell);
    if (up === NO_CELL || mine.has(up) || !standable(ctx.facts, up)) continue;
    for (const dir of dropSides(ctx.facts, up)) rails.push({ cell: up, dir, from: 1, to: 1 });
  }
  joinRailEnds(rails);
  return rails;
}

export default defineRule({
  id: 'R-M08.podium',
  part: 'roles',
  tier: 2,
  priority: 5975,
  about:
    'Reads: marble structures with no role, 2+ tall with a 2 × 2, carrying a temple, cut into grand steps (not mostly stair) or with a quarter of the top in use; nothing of a castle beside. ' +
    'Emits: role podium; a stone balustrade (railing) on each edge of its top that drops 2+.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind === 'marble' && !plan.roles.has(s.id) && isPodium(s, plan)) out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, ctx) {
    const s = ctx.plan.structures.get(c.structure!)!;
    out.role(s.id, 'podium');
    podiumRails(ctx, s, out);
  },
});

/** A stone balustrade on every edge of a marble top that drops 2 or more (R-M08, R-M09). */
export function podiumRails(ctx: RuleContext, s: Structure, out: RuleOut): void {
  for (const r of balustrades(ctx, s)) {
    out.feature({ type: 'railing', structure: s.id, cell: r.cell, dir: r.dir, variant: railVariantAt(ctx.facts, r.cell), params: { from: r.from, to: r.to } });
  }
}
