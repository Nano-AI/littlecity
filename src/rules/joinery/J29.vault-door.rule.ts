// J29 · tier 2 · Vault door (FX-09). A plain marble mass (a terrace, R-M07,
// or a podium, R-M08) two or more storeys tall, standing on 9 or more
// columns with a 2 × 2 among them (a wall one cell thick or a small block is
// not a building) and with no door, gets one: a stone-framed door into the vaults under it, in the middle of its
// longest ground-storey wall run of 3+ cells that stands on level ground
// with open ground (or a floor) at its foot and marble above it. A run
// facing a path or a plaza wins over one facing grass. So a big slab is a
// storehouse, not a blank box, and its walls stay free for the booths and
// niches of the urban fill on every other run.
//
// Not: a keep or gatehouse (arrow slits and their own doors), grand steps,
// a quay wall (on the water), a temple, a plinth; a run with steps cut into
// it; a wall against a bank or another block.

import { above, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { holdsSquare } from '../roles/R-M08.podium.rule';
import { columnCount } from '../roles/R-M04.steps';

const PLAIN = new Set(['terrace', 'podium']);

interface Door {
  cell: CellKey;
  dir: Dir4;
}

function doorOf(s: Structure, plan: ShapePlan): Door | null {
  const mine = new Set(s.cells);
  const height = (c: CellKey): number => plan.terrain.height[columnIndex(keyX(c), keyZ(c))]!;
  const carved = new Set<CellKey>();
  for (const f of plan.featuresByStructure.get(s.id) ?? []) if (f.type === 'broad-steps' && f.cell !== undefined) carved.add(f.cell);
  const ok = (c: CellKey, d: Dir4): boolean => {
    if (!mine.has(c) || carved.has(c) || height(c) !== keyY(c) || !mine.has(above(c))) return false;
    const n = neighbor(c, d);
    if (n === NO_CELL || mine.has(n) || plan.kinds.has(n) || height(n) !== keyY(c)) return false;
    const floor = plan.world.floors.get(n);
    return floor === undefined || floor === 'path' || floor === 'plaza';
  };
  let best: { door: Door; score: number } | null = null;
  const seen = new Set<string>();
  for (const c of s.cells) {
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      if (!ok(c, d) || seen.has(`${c}:${d}`)) continue;
      // The run along this wall: walk to its start, then along it.
      const back = turn(d, 3), on = turn(d, 1);
      let start = c;
      for (let p = neighbor(start, back); p !== NO_CELL && ok(p, d); p = neighbor(p, back)) start = p;
      const run: CellKey[] = [];
      for (let p = start; p !== NO_CELL && ok(p, d); p = neighbor(p, on)) {
        run.push(p);
        seen.add(`${p}:${d}`);
      }
      if (run.length < 3) continue;
      const mid = run[Math.floor((run.length - 1) / 2)]!;
      // Nearer a path or plaza in front of it is better (looking up to 5 out from any cell of the run).
      let near = 6;
      for (const p of run) {
        let q = p;
        for (let k = 1; k <= 5 && k < near; k++) {
          q = neighbor(q, d);
          if (q === NO_CELL) break;
          if (plan.world.floors.has(q)) near = k;
        }
      }
      const score = (6 - near) * 100 + run.length * 2 - d * 0.1; // ties: the lower side number
      if (!best || score > best.score) best = { door: { cell: mid, dir: d }, score };
    }
  }
  return best?.door ?? null;
}

export default defineRule<Door>({
  id: 'J29.vault-door',
  part: 'joinery',
  tier: 2,
  priority: 710,
  about: 'Reads: marble structures with role terrace or podium, 2+ storeys, 9+ columns with a 2 × 2, no door; the ground and floors at their foot. Emits: one door (socket door) in the middle of the best ground-storey wall run.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind !== 'marble' || !PLAIN.has(plan.roles.get(s.id)?.role ?? '')) continue;
      if (keyY(s.cells[s.cells.length - 1]!) - keyY(s.cells[0]!) < 1) continue; // cells ascend by level
      if (!holdsSquare(s) || columnCount(s) < 9 || (plan.featuresByStructure.get(s.id) ?? []).some((f) => f.type === 'door')) continue;
      const door = doorOf(s, plan);
      if (door) out.push({ anchor: door.cell, structure: s.id, data: door });
    }
    return out;
  },
  apply(c, out) {
    const { cell, dir } = c.data;
    const door = out.feature({ type: 'door', variant: 'plain', structure: c.structure!, cell, dir });
    out.socket({ type: 'door', owner: door, cell, dir, structure: c.structure });
  },
});
