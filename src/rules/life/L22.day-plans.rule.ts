// L22 · tier 1 · Day plans. By day a resident picks a destination by seeded
// weights among what the town actually has, walks there, lingers 5–20
// seconds in a matching pose, and picks again.
//
// This rule finds the destinations ("haunts") and marks each with a socket
// on the walking-graph cell a person stands in; the crowd (src/life/people)
// does the picking and the walking. Every haunt is a cell of the graph, so
// anything listed here can be routed to.
//
//   haunt-square     plaza cells, spread out (about one in three, up to 14 a square)
//   haunt-shop       in front of a shop's or an inn's door, and at a stall's counter
//   haunt-cafe       a seat at a table  ┐ any 'seat' socket: Dressing's benches and café
//   haunt-bench      any other seat     ┘ tables, the grand steps. `name` = that socket's id
//   haunt-pier       a pier end or fishing spot, facing the sea
//   haunt-garden     garden cells, up to 4 a garden
//   haunt-fountain   beside a fountain, facing it
//   haunt-viewpoint  the highest cells with a drop in front of them, and the middle of every bridge
//   haunt-visit      another house's front door
//
// `dir` is the way the person faces; `structure` the building it belongs to.

import { above, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import type { SocketType } from '@/core/vocab';
import { defineRule, type Candidate, type RuleContext } from '@/resolve/engine/api';
import { gardens } from '@/resolve/facts/gardens.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { waterfront } from '@/resolve/facts/waterfront.fact';
import type { NavGraph, Socket, StructureId } from '@/resolve/plan';
import { frontDoor, homes, navOf } from './people.lib';

export interface HauntData {
  type: SocketType;
  dir?: Dir4;
  structure?: StructureId;
  /** haunt-cafe, haunt-bench: the seat socket to sit on. */
  seat?: string;
}

const SQUARE_MAX = 14;
const GARDEN_MAX = 4;
const VIEWPOINTS = 4;
const DOCK_SPOTS = 3;
/** A viewpoint is at least this many levels above the lowest land, with a drop of at least 2 in front. */
const VIEW_LEVEL = 3;

/** The cell of the graph a socket's cell stands for: itself, or the cell on top of it. */
function standAt(nav: NavGraph, cell: CellKey): CellKey {
  if (nav.nodeAt.has(cell)) return cell;
  const up = above(cell);
  return up !== NO_CELL && nav.nodeAt.has(up) ? up : NO_CELL;
}

/** The viewpoints of a town: its highest plain cells that look out over a drop, best first. */
export function viewpoints(ctx: RuleContext, nav: NavGraph): { cell: CellKey; dir: Dir4 }[] {
  const found: { cell: CellKey; dir: Dir4; score: number }[] = [];
  const { kinds, terrain } = ctx.facts;
  const air = (c: CellKey): boolean => !kinds.has(c) && keyY(c) >= terrain.height[columnIndex(keyX(c), keyZ(c))]!;
  for (const n of nav.nodes) {
    const y = keyY(n.cell);
    if (y < VIEW_LEVEL || n.rot !== undefined || n.passage !== undefined) continue;
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const out = neighbor(n.cell, d);
      // A drop of two levels or more: open air beside it at this level and the one below, and nothing to
      // stand on there.
      if (out === NO_CELL || !air(out) || !air(out - (1 << 12)) || nav.nodeAt.has(out - (1 << 12))) continue;
      // Higher is better; looking out over the sea is better still.
      const far = neighbor(out, d);
      const sea = terrain.height[columnIndex(keyX(out), keyZ(out))] === 0 || (far !== NO_CELL && terrain.height[columnIndex(keyX(far), keyZ(far))] === 0);
      found.push({ cell: n.cell, dir: d, score: y * 100 + (sea ? 60 : 0) + (hash(ctx.seed, 'view', n.cell) % 50) });
      break;
    }
  }
  // The best few, no two of them neighbours.
  const picked: { cell: CellKey; dir: Dir4 }[] = [];
  for (const v of found.sort((a, b) => b.score - a.score || a.cell - b.cell)) {
    if (picked.length >= VIEWPOINTS) break;
    if (picked.some((p) => Math.abs(keyX(p.cell) - keyX(v.cell)) + Math.abs(keyZ(p.cell) - keyZ(v.cell)) < 3)) continue;
    picked.push({ cell: v.cell, dir: v.dir });
  }
  return picked;
}

/** One answer per walking graph: L22 and L25 both ask. */
const found = new WeakMap<NavGraph, Candidate<HauntData>[]>();

export function findHaunts(ctx: RuleContext): Candidate<HauntData>[] {
  const nav = navOf(ctx);
  if (!nav) return [];
  let list = found.get(nav);
  if (!list) found.set(nav, (list = computeHaunts(ctx, nav)));
  return list;
}

function computeHaunts(ctx: RuleContext, nav: NavGraph): Candidate<HauntData>[] {
  const { facts, plan, seed } = ctx;
  const out: Candidate<HauntData>[] = [];
  const add = (cell: CellKey, key: string, data: HauntData): void => {
    if (cell !== NO_CELL && nav.nodeAt.has(cell)) out.push({ anchor: cell, key, data });
  };
  /** About one cell in `every` (at least one, at most `max`), the seed's choice. */
  const spread = (cells: readonly CellKey[], what: string, max: number, every: number): CellKey[] => {
    const free = cells.filter((c) => nav.nodeAt.has(c) && !facts.kinds.has(c));
    return free
      .map((c) => ({ c, r: hash(seed, what, c) }))
      .sort((a, b) => a.r - b.r || a.c - b.c)
      .slice(0, Math.min(max, Math.ceil(free.length / every)))
      .map((e) => e.c);
  };

  for (const p of plazas(facts).list) {
    const cells = spread(p.cells, 'square', SQUARE_MAX, p.area <= 6 ? 1 : 3);
    for (const c of cells) add(c, 'square', { type: 'haunt-square', structure: p.id });
  }
  for (const g of gardens(facts).list) {
    for (const c of spread(g.cells, 'garden', GARDEN_MAX, g.area <= 4 ? 1 : 2)) add(c, 'garden', { type: 'haunt-garden', structure: g.id });
  }

  // Shops, inns and other houses: the cell outside the front door.
  for (const s of homes(ctx)) {
    const door = frontDoor(nav, s.id);
    if (!door) continue;
    const cell = nav.nodes[door.node]!.cell;
    const role = plan.roles.get(s.id)?.role;
    const dir = door.dir !== undefined ? opposite(door.dir) : undefined;
    if (role === 'shop' || role === 'inn') add(cell, `shop${s.id}`, { type: 'haunt-shop', structure: s.id, ...(dir !== undefined ? { dir } : {}) });
    add(cell, `visit${s.id}`, { type: 'haunt-visit', structure: s.id, ...(dir !== undefined ? { dir } : {}) });
  }
  // Stalls: the customer stands at the counter.
  for (const s of facts.structures.values()) {
    if (s.kind !== 'stall' && s.kind !== 'fountain') continue;
    const cell = s.cells[0]!;
    if (s.kind === 'stall') {
      const tags = plan.tags.get(s.id);
      const front = (['front:n', 'front:e', 'front:s', 'front:w'] as const).findIndex((t) => tags?.has(t));
      if (front >= 0) add(neighbor(cell, front as Dir4), `stall${s.id}`, { type: 'haunt-shop', structure: s.id, dir: opposite(front as Dir4) });
      continue;
    }
    // A fountain: up to two of its free sides, the seed's choice.
    const sides = ([0, 1, 2, 3] as Dir4[])
      .filter((d) => neighbor(cell, d) !== NO_CELL && nav.nodeAt.has(neighbor(cell, d)))
      .sort((a, b) => hash(seed, 'fountain', cell, a) - hash(seed, 'fountain', cell, b))
      .slice(0, 2);
    for (const d of sides) add(neighbor(cell, d), `fountain${s.id}.${d}`, { type: 'haunt-fountain', structure: s.id, dir: opposite(d) });
  }

  // Seats: whatever benches, café tables and steps the town has by now.
  const seats: Socket[] = [...socketsOfType(facts, 'seat'), ...(ctx.dressing?.sockets ?? []).filter((s) => s.type === 'seat')];
  const propType = new Map((ctx.dressing?.props ?? []).map((p) => [p.id, p.type as string] as const));
  for (const s of seats) {
    const owner = s.owner !== undefined ? (propType.get(s.owner) ?? '') : '';
    const cafe = /table|cafe|café/.test(owner);
    let cell = standAt(nav, s.cell);
    if (cell === NO_CELL && s.dir !== undefined) cell = standAt(nav, neighbor(s.cell, s.dir));
    add(cell, `seat:${s.id}`, { type: cafe ? 'haunt-cafe' : 'haunt-bench', seat: s.id, ...(s.dir !== undefined ? { dir: s.dir } : {}), ...(s.structure !== undefined ? { structure: s.structure } : {}) });
  }

  // The water: pier ends and fishing spots, and the outer cells of any other dock (water on two sides
  // or more), facing out.
  const wet = new Set<CellKey>();
  for (const s of [...socketsOfType(facts, 'fishing-spot'), ...socketsOfType(facts, 'pier-end')]) {
    const cell = standAt(nav, s.cell);
    if (cell === NO_CELL || wet.has(cell)) continue;
    wet.add(cell);
    add(cell, 'pier', { type: 'haunt-pier', ...(s.dir !== undefined ? { dir: s.dir } : {}), ...(s.structure !== undefined ? { structure: s.structure } : {}) });
  }
  const shore = waterfront(facts);
  const perDock = new Map<StructureId, number>();
  // Ends first (water on three sides), then the seed's order.
  const outer = shore.cells
    .filter((c) => shore.sides.get(c)!.length >= 2)
    .sort((a, b) => shore.sides.get(b)!.length - shore.sides.get(a)!.length || hash(seed, 'dock', a) - hash(seed, 'dock', b) || a - b);
  for (const cell of outer) {
    const sides = shore.sides.get(cell)!;
    const dock = facts.structureAt.get(cell - (1 << 12));
    if (dock === undefined || facts.kinds.get(cell - (1 << 12)) !== 'dock' || wet.has(cell)) continue;
    if ((perDock.get(dock) ?? 0) >= DOCK_SPOTS) continue;
    perDock.set(dock, (perDock.get(dock) ?? 0) + 1);
    wet.add(cell);
    // Out to sea: the wet side whose opposite is not wet (the end of a pier), else the seed's choice.
    const out = sides.find((d) => !sides.includes(opposite(d))) ?? sides[hash(seed, 'pier', cell) % sides.length]!;
    add(cell, 'dock', { type: 'haunt-pier', dir: out, structure: dock });
  }

  const views = viewpoints(ctx, nav);
  for (const v of views) add(v.cell, 'view', { type: 'haunt-viewpoint', dir: v.dir });
  // A bridge is for leaning on: the middle of every arch deck two levels or more above what is under
  // it, looking out over the side with the longer drop.
  const air = (c: CellKey): boolean => c !== NO_CELL && !facts.kinds.has(c) && keyY(c) >= facts.terrain.height[columnIndex(keyX(c), keyZ(c))]!;
  for (const s of [...facts.structures.values()].filter((k) => k.kind === 'arch').sort((a, b) => a.id - b.id)) {
    if (plan.tags.get(s.id)?.has('deck:covered')) continue; // a sky bridge's gallery: nobody would see them

    const decks = s.cells
      .map((c) => above(c))
      .filter((c) => c !== NO_CELL && nav.nodeAt.has(c) && nav.nodes[nav.nodeAt.get(c)!]!.passage === undefined && !views.some((v) => v.cell === c));
    const spots: { cell: CellKey; dir: Dir4 }[] = [];
    for (const c of decks) {
      const dir = ([0, 1, 2, 3] as Dir4[]).find((d) => {
        const o = neighbor(c, d);
        return air(o) && air(o - (1 << 12)) && air(o - (2 << 12)) && !nav.nodeAt.has(o - (1 << 12));
      });
      if (dir !== undefined) spots.push({ cell: c, dir });
    }
    const mid = spots[Math.floor(spots.length / 2)];
    if (mid) add(mid.cell, `bridge${s.id}`, { type: 'haunt-viewpoint', dir: mid.dir, structure: s.id });
  }
  return out;
}

export default defineRule<HauntData>({
  id: 'L22.day-plans',
  part: 'life',
  tier: 1,
  priority: 780,
  about:
    'Reads: the walking graph, plazas, gardens, roles (shop, inn), stalls, fountains, seat, fishing-spot and pier-end sockets, front doors. ' +
    'Emits: haunt-* sockets, one per place a resident may go and linger.',
  find: findHaunts,
  apply(c, out) {
    const d = c.data;
    out.socket({
      type: d.type,
      cell: c.anchor,
      ...(d.dir !== undefined ? { dir: d.dir } : {}),
      ...(d.structure !== undefined ? { structure: d.structure } : {}),
      ...(d.seat !== undefined ? { name: d.seat } : {}),
    });
  },
});
