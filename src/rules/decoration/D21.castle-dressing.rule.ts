// D21 · tier 2 · Castle dressing.
//
//   banners   on a curtain wall (R-E02), on every third cell of a straight
//             stretch (a fixed lattice of the map, so lengthening the wall
//             moves none), hung on its south or east face; on a keep (R-M03),
//             one on the middle cell of each long side of its top storey but
//             one, below the battlements. All in the town's colour.
//   torches   in iron brackets either side of a gatehouse's arch (R-M02), on
//             the faces of the towers that flank it, both ways through.
//   a cannon  on a quay wall (R-M05), DEPTH.cannon of them: on its top, at
//             the edge over the water, pointing out to sea.
//
// Stability: a banner depends on its own cell and the two beside it; a
// torch on the gatehouse; a cannon on its quay's first cell's roll.
//
// Reads: fence/wall runs and their roles, keeps, gatehouses (portcullis
// features), quay walls, clearways. Claims: the wall face of each banner or
// torch; the floor slot of a cannon.

import { above, DIR4, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { DIRS, openWater } from '@/resolve/facts/lib';
import { structureInfo } from '@/resolve/facts/structure.fact';
import type { Slot, StructureId } from '@/resolve/plan';
import { DEPTH } from '@/style/depth';
import { WALL } from '@/style/edges';
import { clearways, edgePos } from './clearways.fact';
import { lucky, townColor } from './lib';

const RULE = 'D21.castle-dressing';

type Item =
  | { what: 'banner' | 'torch'; wall: CellKey; dir: Dir4; back: number }
  | { what: 'cannon'; cell: CellKey; dir: Dir4 };

export default defineRule<Item>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 790,
  about: 'Reads: curtain-wall runs, keeps, gatehouse portcullis features, quay walls, clearways. Claims: the wall face of each banner or torch; the floor slot of a cannon.',
  find({ facts, plan, seed }) {
    const out: Candidate<Item>[] = [];
    const all = facades(facts);
    const info = structureInfo(facts);
    for (const s of facts.structures.values()) {
      const role = plan.roles.get(s.id)?.role as string | undefined;
      // Curtain walls: cell pieces in a straight run, every third cell of the map.
      if (s.kind === 'wall' && role === 'curtain-wall') {
        const mine = new Set(s.cells);
        for (const c of s.cells) {
          const alongX = mine.has(neighbor(c, 1)) && mine.has(neighbor(c, 3));
          const alongZ = mine.has(neighbor(c, 0)) && mine.has(neighbor(c, 2));
          if (alongX === alongZ) continue;
          if ((alongX ? keyX(c) : keyZ(c)) % 3 !== 1) continue;
          const d: Dir4 = alongX ? 2 : 1;
          const n = neighbor(c, d);
          if (n === NO_CELL || facts.kinds.has(n)) continue;
          out.push({ anchor: c, structure: s.id, key: `banner${d}`, data: { what: 'banner', wall: c, dir: d, back: 0.5 - WALL.curtainThick / 2 } });
        }
      }
      // A keep: the middle cell of each side of the storey under its top, where it is a plain wall.
      if (s.kind === 'marble' && role === 'keep') {
        const top = info.get(s.id)?.maxY ?? 0;
        const sides = new Map<Dir4, CellKey[]>();
        for (const f of all.byStructure.get(s.id) ?? []) {
          if (keyY(f.cell) !== top - 1 || f.touching || f.faces === 'structure') continue;
          const list = sides.get(f.dir) ?? [];
          list.push(f.cell);
          sides.set(f.dir, list);
        }
        const busy = new Set<number>();
        for (const f of plan.featuresByStructure.get(s.id) ?? []) if (f.cell !== undefined && f.dir !== undefined && (f.type === 'arrow-slit' || f.type === 'window' || f.type === 'door')) busy.add(f.cell * 4 + f.dir);
        for (const [d, cells] of sides) {
          if (cells.length < 2) continue;
          cells.sort((a, b) => a - b);
          const mid = cells[Math.floor((cells.length - 1) / 2)]!;
          const pick = busy.has(mid * 4 + d) ? cells.find((c) => !busy.has(c * 4 + d)) : mid;
          if (pick !== undefined) out.push({ anchor: pick, structure: s.id, key: `banner${d}`, data: { what: 'banner', wall: pick, dir: d, back: 0.02 } });
        }
      }
      // A quay wall: one cannon on its top, over the water.
      if (s.kind === 'marble' && role === 'quay-wall' && lucky(seed, RULE, s.cells[0]!, 'cannon', DEPTH.cannon)) {
        const clear = clearways(facts);
        const spots: { cell: CellKey; dir: Dir4 }[] = [];
        for (const c of s.cells) {
          const up = above(c);
          if (up === NO_CELL || facts.structureAt.get(up) === s.id) continue;
          for (const d of DIRS) {
            const [dx, dz] = DIR4[d]!;
            if (openWater(facts, keyX(c) + dx, keyZ(c) + dz) && clear.free(up, edgePos(d))) spots.push({ cell: up, dir: d });
          }
        }
        spots.sort((a, b) => hash(seed, RULE, a.cell, a.dir) - hash(seed, RULE, b.cell, b.dir) || a.cell - b.cell);
        if (spots[0]) out.push({ anchor: spots[0].cell, structure: s.id, key: 'cannon', data: { what: 'cannon', ...spots[0] } });
      }
    }
    // Gatehouses: torches either side of the arch, on the flanking towers, both ways through.
    for (const f of plan.features) {
      if (f.type !== 'portcullis' || f.cell === undefined) continue;
      const arch = f.cell;
      for (const axis of [0, 1] as const) {
        const a = neighbor(arch, axis === 0 ? 3 : 0), b = neighbor(arch, axis === 0 ? 1 : 2);
        if (facts.kinds.get(a) !== 'marble' && facts.kinds.get(b) !== 'marble') continue;
        // The way through runs across this axis.
        const through: Dir4[] = axis === 0 ? [0, 2] : [3, 1];
        for (const p of through) {
          for (const side of [a, b]) {
            if (facts.kinds.get(side) !== 'marble') continue;
            const n = neighbor(side, p);
            if (n === NO_CELL || facts.kinds.has(n)) continue;
            out.push({ anchor: side, structure: facts.structureAt.get(side) as StructureId, key: `torch${p}`, data: { what: 'torch', wall: side, dir: p, back: 0.01 } });
          }
        }
        break;
      }
    }
    return out;
  },
  claims: (c): Slot[] => (c.data.what === 'cannon' ? [slot.floor(c.data.cell, edgePos(c.data.dir))] : [slot.custom('wall-face', c.data.wall, c.data.dir)]),
  apply(c, out, ctx) {
    const d = c.data;
    const look = hash(ctx.seed, RULE, c.anchor, String(c.key)) % 1000;
    if (d.what === 'cannon') {
      out.prop({ type: 'cannon', at: { cell: d.cell, pos: edgePos(d.dir), face: d.dir }, params: { look } });
      return;
    }
    const mount = out.socket({ type: 'wall-mount', cell: d.wall, dir: d.dir, structure: c.structure });
    if (d.what === 'banner') out.prop({ type: 'wall-banner', at: { socket: mount }, params: { color: townColor(ctx.seed), look, back: d.back } });
    else {
      const torch = out.prop({ type: 'torch', at: { socket: mount }, params: { back: d.back } });
      out.socket({ type: 'lamp-head', owner: torch, cell: d.wall, dir: d.dir, structure: c.structure });
    }
  },
});
