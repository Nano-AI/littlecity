// L23 · tier 2 · Jobs, with L08's lamplighter. One worker per role
// structure: baker at the shop door at dawn; shopkeeper sweeping; miller
// carrying sacks between windmill and mill house; keeper climbing the
// lighthouse at dusk; fisher on the pier end; gardener watering; stall vendor
// behind the stall; guard pacing a keep (where no garrison does, L36); bell ringer at dusk. And one
// lamplighter for the town, who walks to each lamp at dusk in route order.
//
// A job is a place, not a new person: this rule marks the places with
// `workplace` sockets and the crowd (src/life/people) gives each job to one
// resident, the one who lives there or nearest. A socket's `name` is
// `<job>|<order>|<ref>`: the job, the station's place in the round (a miller
// has two stations, a guard two, the lamplighter one per lamp), and for a
// lamp the lamp prop's id, which the `lampReached` event carries. `structure`
// is the workplace. Stations are cells of the walking graph; a workplace
// nobody can walk to gets no worker.
//
// The lamplighter is here rather than in an L08 file because the lamps'
// lighting is the Animation owner's (L08): this rule only says where the
// lamps are, in the order they are walked.

import { above, keyX, keyZ, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, type Candidate, type RuleContext } from '@/resolve/engine/api';
import { gardens } from '@/resolve/facts/gardens.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import { streets } from '@/resolve/facts/streets.fact';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { usableDoors } from '@/resolve/nav';
import type { NavGraph, StructureId } from '@/resolve/plan';
import { PEOPLE } from '@/style/people';
import { findCastles } from './castle.lib';
import { navOf, steps } from './people.lib';

export type Job = 'baker' | 'shopkeeper' | 'miller' | 'keeper' | 'fisher' | 'gardener' | 'vendor' | 'guard' | 'bell-ringer' | 'lamplighter';

interface Data {
  job: Job;
  order: number;
  ref: string;
  dir?: Dir4;
  structure?: StructureId;
}

/**
 * The lamplighter's round: (cell to stand in, lamp id), in the order one person would walk them.
 *
 * On the round: lamp POSTS, wherever a rule stood them (streets D01, squares D02, bridge parapets D20,
 * pier ends), if a cell of the walking graph is at or beside them. Not on it: hanging lanterns (under
 * arches, on brackets by doors) and an inn's door lantern, which are their households' to light and
 * come on by themselves. The round is PEOPLE.lampRound lamps at most, the ones nearest the town's
 * biggest square (or its longest street, or failing both the lowest lamp), so that it can be walked
 * in one dusk; every other lamp lights on its own timer.
 */
export function lampRound(ctx: RuleContext, nav: NavGraph): { cell: CellKey; lamp: string }[] {
  const stops: { cell: CellKey; lamp: string }[] = [];
  const socketCell = new Map<string, CellKey>();
  for (const s of ctx.plan.sockets) socketCell.set(s.id, s.cell);
  for (const s of ctx.dressing?.sockets ?? []) socketCell.set(s.id, s.cell);
  for (const p of ctx.dressing?.props ?? []) {
    if (p.type !== 'lamp') continue;
    const at = 'cell' in p.at ? p.at.cell : 'socket' in p.at ? socketCell.get(p.at.socket) : undefined;
    if (at === undefined) continue;
    // The lamp's own cell, the one on top of it, or one beside it.
    const near = [at, above(at), ...([0, 1, 2, 3] as Dir4[]).map((d) => neighbor(at, d))];
    const cell = near.find((c) => c !== NO_CELL && nav.nodeAt.has(c));
    if (cell !== undefined) stops.push({ cell, lamp: p.id });
  }
  if (stops.length === 0) return stops;
  // Where the round is: about the middle of the biggest square, else of the longest street.
  const square = [...plazas(ctx.facts).list].sort((a, b) => b.area - a.area || a.id - b.id)[0];
  const street = [...streets(ctx.facts).list].sort((a, b) => b.length - a.length || a.id - b.id)[0];
  const heart = square ? square.cells[square.cells.length >> 1]! : street ? street.cells[street.cells.length >> 1]! : stops.reduce((a, b) => (b.cell < a.cell ? b : a)).cell;
  stops.sort((a, b) => steps(a.cell, heart) - steps(b.cell, heart) || a.cell - b.cell || (a.lamp < b.lamp ? -1 : 1));
  // Only lamps that can be walked between: those in the same part of the graph as the nearest one.
  const part = nav.part[nav.nodeAt.get(stops[0]!.cell)!];
  for (let i = stops.length - 1; i >= 0; i--) if (nav.part[nav.nodeAt.get(stops[i]!.cell)!] !== part) stops.splice(i, 1);
  stops.length = Math.min(stops.length, Math.max(1, Math.round(PEOPLE.lampRound)));
  // Route order: start at the end farthest from the heart, always on to the nearest lamp not yet lit.
  stops.reverse();
  const round = [stops.shift()!];
  while (stops.length > 0) {
    const from = round[round.length - 1]!.cell;
    let best = 0;
    for (let i = 1; i < stops.length; i++) if (steps(from, stops[i]!.cell) < steps(from, stops[best]!.cell)) best = i;
    round.push(stops.splice(best, 1)[0]!);
  }
  return round;
}

export default defineRule<Data>({
  id: 'L23.jobs',
  part: 'life',
  tier: 2,
  priority: 770,
  about:
    'Reads: roles (shop, mill-house, keep, steeple, campanile, chapel), lighthouses, windmills, stalls, gardens, fishing spots, lamp props, the walking graph. ' +
    'Emits: workplace sockets, one or more per job.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const { facts, plan, seed } = ctx;
    // A walled castle's keep has its troop (L36) instead of a lone guard; a keep standing on its own keeps its
    // guard on top, watching over the troop that marches round its foot.
    const garrisoned = new Set(findCastles(plan, nav).filter((c) => c.gate !== null && c.wallCells > 0).flatMap((c) => c.structures));
    const out: Candidate<Data>[] = [];
    const add = (cell: CellKey, data: Data): void => {
      if (cell !== NO_CELL && nav.nodeAt.has(cell)) out.push({ anchor: cell, key: `${data.job}|${data.order}|${data.ref}|${data.structure ?? ''}`, data });
    };
    const doorOf = (s: StructureId) => usableDoors(nav, s)[0];
    const atDoor = (job: Job, s: StructureId, order = 0): void => {
      const door = doorOf(s);
      if (door) add(nav.nodes[door.node]!.cell, { job, order, ref: '', structure: s, ...(door.dir !== undefined ? { dir: door.dir } : {}) });
    };
    const structures = [...facts.structures.values()].sort((a, b) => a.id - b.id);
    const windmills = structures.filter((s) => s.kind === 'windmill' && doorOf(s.id));

    for (const s of structures) {
      const role = plan.roles.get(s.id)?.role;
      if (role === 'shop') atDoor(hash(seed, 'baker', s.id) % 3 === 0 ? 'baker' : 'shopkeeper', s.id);
      else if (role === 'mill-house') {
        // Between the mill house and the nearest windmill.
        const door = doorOf(s.id);
        const mill = door && [...windmills].sort((a, b) => steps(a.cells[0]!, door.cell) - steps(b.cells[0]!, door.cell) || a.id - b.id)[0];
        if (door && mill && nav.part[doorOf(mill.id)!.node] === nav.part[door.node]) {
          atDoor('miller', s.id, 0);
          const md = doorOf(mill.id)!;
          add(nav.nodes[md.node]!.cell, { job: 'miller', order: 1, ref: String(mill.id), structure: s.id, ...(md.dir !== undefined ? { dir: md.dir } : {}) });
        }
      } else if (s.kind === 'lighthouse') atDoor('keeper', s.id);
      else if (role === 'steeple' || role === 'campanile') atDoor('bell-ringer', s.id);
      else if (role === 'keep' && !garrisoned.has(s.id)) {
        // The beat: the two cells of its top that lie farthest apart.
        const top = s.cells.map((c) => above(c)).filter((c) => c !== NO_CELL && nav.nodeAt.has(c) && nav.nodes[nav.nodeAt.get(c)!]!.rot === undefined);
        if (top.length === 0) continue;
        let a = top[0]!, b = top[0]!;
        for (const c of top) for (const d of top) if (steps(c, d) > steps(a, b)) [a, b] = [c, d];
        add(a, { job: 'guard', order: 0, ref: '', structure: s.id });
        if (b !== a) add(b, { job: 'guard', order: 1, ref: '', structure: s.id });
      } else if (s.kind === 'stall') {
        const tags = plan.tags.get(s.id);
        const front = (['front:n', 'front:e', 'front:s', 'front:w'] as const).findIndex((t) => tags?.has(t));
        if (front >= 0) add(neighbor(s.cells[0]!, opposite(front as Dir4)), { job: 'vendor', order: 0, ref: '', structure: s.id, dir: front as Dir4 });
      }
    }
    // A chapel with no steeple of its own rings from its door.
    for (const s of structures) {
      if (plan.roles.get(s.id)?.role !== 'chapel') continue;
      const near = out.some((o) => o.data.job === 'bell-ringer' && steps(o.anchor, s.cells[0]!) <= 3);
      if (!near) atDoor('bell-ringer', s.id);
    }
    for (const g of gardens(facts).list) {
      if (g.area < 4) continue;
      const cells = g.cells.filter((c) => nav.nodeAt.has(c) && !facts.kinds.has(c) && !nav.nodes[nav.nodeAt.get(c)!]!.clutter).sort((a, b) => hash(seed, 'gardener', a) - hash(seed, 'gardener', b) || a - b);
      if (cells[0] !== undefined) add(cells[0], { job: 'gardener', order: 0, ref: '', structure: g.id });
    }
    // One fisher per dock that has a fishing spot.
    const fished = new Set<StructureId>();
    for (const s of socketsOfType(facts, 'fishing-spot')) {
      if (s.structure === undefined || fished.has(s.structure) || facts.structures.get(s.structure)?.kind !== 'dock') continue;
      const cell = nav.nodeAt.has(s.cell) ? s.cell : above(s.cell);
      if (cell === NO_CELL || !nav.nodeAt.has(cell)) continue;
      fished.add(s.structure);
      add(cell, { job: 'fisher', order: 0, ref: '', structure: s.structure, ...(s.dir !== undefined ? { dir: s.dir } : {}) });
    }
    lampRound(ctx, nav).forEach((stop, order) => add(stop.cell, { job: 'lamplighter', order, ref: stop.lamp }));
    return out.sort((a, b) => a.anchor - b.anchor || keyX(a.anchor) - keyX(b.anchor) || keyZ(a.anchor) - keyZ(b.anchor));
  },
  apply(c, out) {
    const d = c.data;
    out.socket({
      type: 'workplace',
      cell: c.anchor,
      name: `${d.job}|${d.order}|${d.ref}`,
      ...(d.dir !== undefined ? { dir: d.dir } : {}),
      ...(d.structure !== undefined ? { structure: d.structure } : {}),
    });
  },
});
