// L63 · tier 2 · A beach day. A BEACH is sand at the water's edge that the
// town can walk to: walking-graph cells on sand with open water on a side,
// in the part of the graph where most of the town's front doors are, gathered
// into one beach when they lie within two cells of each other (a strip broken
// by a rock or a jetty's foot is still one beach). One of BEACH_MIN (4)
// cells or more, within BEACH.reach steps of a front door, in a town of
// BEACH_TOWN (8) houses or more, is a beach worth the name. The two biggest (counting up to a dozen cells; then the nearest
// the town) each get up to BEACH.pitches posts `beach|pitch|<n>` on the
// stretch of it nearest the town's front doors, side by side, facing the
// water (where a family puts up its parasol), and one `beach|back|<n>`: the
// walkable cell off that stretch nearest the town's heart, facing the beach.
// src/life/town/chains/beach.ts holds the beach days.

import { DIR4, key, keyX, keyY, keyZ, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate, type RuleContext } from '@/resolve/engine/api';
import { waterfront } from '@/resolve/facts/waterfront.fact';
import { openWater } from '@/resolve/facts/lib';
import { BEACH } from '@/style/scenes';
import { frontDoor, homes, navOf, steps } from './people.lib';
import { heartOf } from './town.lib';

/** Sand cells a beach needs, at least. */
export const BEACH_MIN = 4;
/** House structures a town needs for beach days (a hamlet keeps to its own chores). */
export const BEACH_TOWN = 8;
/** Beaches that get posts, at most. */
export const BEACHES = 2;

type Data = { role: 'pitch' | 'back'; beach: number; dir: Dir4 };

export interface Beach {
  /** Its sand cells. */
  cells: CellKey[];
  /** For each, the side that faces the water. */
  sea: Map<CellKey, Dir4>;
  /** Where the families go: up to BEACH.pitches cells of it nearest the town's front doors, side by side, in order along the shore. */
  pitches: CellKey[];
  /** Grid steps from its nearest pitch to the nearest front door. */
  near: number;
}

/** The town's beaches, biggest first (ties: nearest `heart`). Exported for the survey test. */
export function beachesOf(ctx: RuleContext): Beach[] {
  const nav = navOf(ctx);
  if (!nav || homes(ctx).length < BEACH_TOWN) return [];
  // The part of the graph most front doors open onto: the town proper.
  const doors = new Map<number, number>();
  for (const h of homes(ctx)) {
    const d = frontDoor(nav, h.id);
    if (d) doors.set(nav.part[d.node]!, (doors.get(nav.part[d.node]!) ?? 0) + 1);
  }
  const main = [...doors].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  if (main === undefined) return [];
  const doorCells = homes(ctx)
    .map((h) => frontDoor(nav, h.id))
    .filter((d): d is NonNullable<typeof d> => d !== null && nav.part[d.node] === main)
    .map((d) => nav.nodes[d.node]!.cell);
  const toDoor = (c: CellKey): number => Math.min(...doorCells.map((d) => steps(c, d)));
  const wf = waterfront(ctx.facts);
  const sand: CellKey[] = [];
  const sea = new Map<CellKey, Dir4>();
  for (const cell of wf.cells) {
    const n = nav.nodeAt.get(cell);
    if (n === undefined || nav.part[n] !== main) continue;
    const node = nav.nodes[n]!;
    if (node.surface !== 'sand' || node.clutter) continue;
    // The side with the most open water beyond it (a point of sand faces the open sea, not the cove).
    const sides = wf.sides.get(cell) ?? [];
    let best: Dir4 | null = null, most = -1;
    for (const d of sides) {
      let wet = 0;
      for (let k = 1; k <= 4; k++) if (openWater(ctx.facts, keyX(cell) + DIR4[d]![0] * k, keyZ(cell) + DIR4[d]![1] * k)) wet++;
      if (wet > most || (wet === most && best !== null && d < best)) {
        most = wet;
        best = d;
      }
    }
    if (best === null) continue;
    sand.push(cell);
    sea.set(cell, best);
  }
  // Gathered: cells within two of each other (and a level) are one beach.
  const seen = new Set<CellKey>();
  const out: Beach[] = [];
  for (const start of sand) {
    if (seen.has(start)) continue;
    seen.add(start);
    const group = [start];
    for (let i = 0; i < group.length; i++) {
      const c = group[i]!;
      for (const o of sand) {
        if (seen.has(o)) continue;
        if (Math.max(Math.abs(keyX(o) - keyX(c)), Math.abs(keyZ(o) - keyZ(c))) <= 2 && Math.abs(keyY(o) - keyY(c)) <= 1) {
          seen.add(o);
          group.push(o);
        }
      }
    }
    if (group.length < BEACH_MIN) continue;
    // The stretch the town uses: from the cell nearest a front door, growing along the sand (always to the
    // next nearest the doors that touches what is taken), so the parasols stand side by side near the town
    // even on a beach that runs right round the island.
    const dist = new Map(group.map((c) => [c, toDoor(c)]));
    const byNear = [...group].sort((a, b) => dist.get(a)! - dist.get(b)! || a - b);
    const want = Math.max(1, Math.round(BEACH.pitches));
    const taken = [byNear[0]!];
    while (taken.length < want) {
      const nextCell = byNear.find((c) => !taken.includes(c) && taken.some((t) => Math.max(Math.abs(keyX(t) - keyX(c)), Math.abs(keyZ(t) - keyZ(c))) <= 2 && Math.abs(keyY(t) - keyY(c)) <= 1));
      if (nextCell === undefined) break;
      taken.push(nextCell);
    }
    // In order along the shore: along the line the stretch runs (its longer spread).
    const xs = taken.map(keyX), zs = taken.map(keyZ);
    const alongX = Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs);
    taken.sort((a, b) => (alongX ? keyX(a) - keyX(b) || keyZ(a) - keyZ(b) : keyZ(a) - keyZ(b) || keyX(a) - keyX(b)));
    out.push({ cells: group, sea: new Map(group.map((c) => [c, sea.get(c)!])), pitches: taken, near: dist.get(byNear[0]!)! });
  }
  // A beach near the town before a bigger one far off: size counts up to a dozen cells, then nearness.
  return out
    .filter((b) => b.near <= BEACH.reach)
    .sort((a, b) => Math.min(12, b.cells.length) - Math.min(12, a.cells.length) || a.near - b.near || a.cells[0]! - b.cells[0]!);
}

export default defineRule<Data>({
  id: 'L63.beach',
  part: 'life',
  tier: 2,
  priority: 420,
  townWide: true,
  about: 'Reads: sand at the water, the walking graph, front doors. Emits: errand sockets beach|pitch along each of the two biggest beaches and beach|back behind each.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav) return [];
    const heart = heartOf(ctx);
    const out: Candidate<Data>[] = [];
    beachesOf(ctx)
      .slice(0, BEACHES)
      .forEach((beach, n) => {
        for (const cell of beach.pitches) out.push({ anchor: cell, key: `pitch${n}`, data: { role: 'pitch', beach: n, dir: beach.sea.get(cell)! } });
        // Behind the sand: a walkable cell off it, beside it, nearest the heart.
        let back: { cell: CellKey; dir: Dir4; score: number } | null = null;
        for (const c of beach.pitches) {
          for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
            for (const dy of [0, 1, -1]) {
              const o = key(keyX(c) + DIR4[d]![0], keyY(c) + dy, keyZ(c) + DIR4[d]![1]);
              const k = o === NO_CELL ? undefined : nav.nodeAt.get(o);
              if (k === undefined || nav.nodes[k]!.surface === 'sand' || nav.nodes[k]!.clutter || nav.part[k] !== nav.part[nav.nodeAt.get(c)!]) continue;
              const score = heart === null ? 0 : steps(o, heart);
              if (!back || score < back.score || (score === back.score && o < back.cell)) back = { cell: o, dir: opposite(d), score };
            }
          }
        }
        if (back) out.push({ anchor: back.cell, key: `back${n}`, data: { role: 'back', beach: n, dir: back.dir } });
      });
    return out;
  },
  apply(c, out) {
    out.socket({ id: `L63.beach@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, dir: c.data.dir, name: `beach|${c.data.role}|${c.data.beach}` });
  },
});
