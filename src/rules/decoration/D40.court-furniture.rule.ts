// D40 · tier 2 · Court furniture (design section 7, "Field"). What stands on
// and round a court R-G03 found:
//
//   basketball   a hoop on a post at each end, the board facing the court
//   tennis       the net across the middle; an umpire's chair at one end of
//                the net on a court three or more wide
//   football     a goal at each end (small ones on a pitch under five wide)
//   every court  a bench just off one long side, on open ground, facing in
//                (its seats are haunts: people stop and watch); and in town
//                (a path, plaza or house within two cells) a lamp at two
//                corners so evening games can be seen
//
// Hoops, nets, goals and chairs stand at the centre slot of the court cell
// they fall in, moved off it by (dx, dz) to where the court puts them; the
// walking graph reads them as solid things in the middle of a cell (dearer
// to cross), so passers-by go round a court in use rather than through it.
//
// Reads: field regions with a field-court feature, clearways. Claims: the
// floor slot of each piece.

import { DIR4, key, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, CELL_H, type CellKey, type Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import type { CellPos } from '@/resolve/plan';
import { courtPoint, fieldCourtOf, goalOf, hoopOf, type Court } from '../roles/field.lib';
import { clearways, cornerPos, edgePos } from './clearways.fact';

const RULE = 'D40.court-furniture';

type Piece =
  | { type: 'court-hoop' | 'umpire-chair'; cell: CellKey; pos: CellPos; face: Dir4; dx: number; dz: number }
  | { type: 'court-net' | 'court-goal'; cell: CellKey; pos: CellPos; face: Dir4; dx: number; dz: number; span: number; small?: boolean }
  | { type: 'bench' | 'lamp'; cell: CellKey; pos: CellPos; face: Dir4 };

/** The way (N E S W) that points along +u (s = 1) or −u (s = −1), or along +v / −v. */
function dirOf(c: Court, du: number, dv: number): Dir4 {
  const dx = c.ux * du + c.uz * dv, dz = c.uz * du - c.ux * dv;
  if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? 1 : 3;
  return dz > 0 ? 2 : 0;
}

/** A piece standing at court point (u, v): the cell it falls in, and how far it is from that cell's middle. */
function standing(c: Court, u: number, v: number): { cell: CellKey; dx: number; dz: number } {
  const [x, z] = courtPoint(c, u, v);
  const level = Math.round((c.y - 0.015) / CELL_H);
  const cx = Math.min(c.rect.x0 + c.rect.w - 1, Math.max(c.rect.x0, Math.floor(x)));
  const cz = Math.min(c.rect.z0 + c.rect.d - 1, Math.max(c.rect.z0, Math.floor(z)));
  return { cell: key(cx, level, cz), dx: x - (cx + 0.5), dz: z - (cz + 0.5) };
}

export function courtPieces(c: Court): Piece[] {
  const out: Piece[] = [];
  if (c.role === 'basketball-court') {
    const h = hoopOf(c);
    for (const s of [-1, 1]) out.push({ type: 'court-hoop', ...standing(c, s * h.post, 0), pos: 'c', face: dirOf(c, -s, 0) });
  } else if (c.role === 'tennis-court') {
    out.push({ type: 'court-net', ...standing(c, 0, 0), pos: 'c', face: dirOf(c, 1, 0), span: (c.hw + 0.03) * 2 });
    if (c.rw >= 1.5) out.push({ type: 'umpire-chair', ...standing(c, 0, -(c.rw - 0.07)), pos: 'c', face: dirOf(c, 0, 1) });
  } else if (c.role === 'football-pitch') {
    const g = goalOf(c);
    for (const s of [-1, 1]) out.push({ type: 'court-goal', ...standing(c, s * g.u, 0), pos: 'c', face: dirOf(c, -s, 0), span: g.half * 2, small: c.hw < 1.4 });
  }
  return out;
}

export default defineRule<Piece>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 600,
  about: 'Reads: field regions with a court (R-G03), clearways, houses, paths and plazas near them. Claims: the floor slot of each piece.',
  find({ facts, plan }) {
    const clear = clearways(facts);
    const out: Candidate<Piece>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'field') continue;
      const c = fieldCourtOf(plan, s, CELL_H);
      if (!c) continue;
      const own = new Set(s.cells);
      for (const p of courtPieces(c)) out.push({ anchor: p.cell, key: p.type + p.face, data: p });
      if (c.role === 'kickabout-green' || c.role === 'running-track') continue;
      // A bench just off one long side, facing in: the side's middle cell, the first side with room.
      const r = c.rect;
      const level = keyY(s.cells[0]!);
      const along = c.along;
      const sides: Dir4[] = along === 0 ? [0, 2] : [3, 1];
      const mid = along === 0 ? r.x0 + Math.floor((r.w - 1) / 2) : r.z0 + Math.floor((r.d - 1) / 2);
      bench: for (const d of sides) {
        const [dx, dz] = DIR4[d]!;
        for (const m of [mid, mid + 1, mid - 1]) {
          const edge = along === 0 ? key(m, level, dz < 0 ? r.z0 : r.z0 + r.d - 1) : key(dx < 0 ? r.x0 : r.x0 + r.w - 1, level, m);
          if (!own.has(edge)) continue;
          const n = neighbor(edge, d);
          if (n === NO_CELL || own.has(n) || facts.world.floors.has(n)) continue;
          const pos = edgePos(opposite(d));
          if (!clear.free(n, pos) || clear.walked(n, 'c')) continue;
          out.push({ anchor: n, key: `bench:${pos}`, data: { type: 'bench', cell: n, pos, face: opposite(d) } });
          break bench;
        }
      }
      // Lamps at two corners, in town.
      if (!inTown(facts, s.cells)) continue;
      const corners: [number, number, Dir4, Dir4][] = [
        [r.x0 - 1, r.z0 - 1, 2, 1],
        [r.x0 + r.w, r.z0 + r.d, 0, 3],
      ];
      for (const [x, z, a, b] of corners) {
        const n = key(x, level, z);
        if (x < 0 || z < 0 || x > 47 || z > 47 || own.has(n)) continue;
        const pos = cornerPos(a, b);
        if (!clear.free(n, pos) || !clear.headroom(n, pos)) continue;
        out.push({ anchor: n, key: `lamp:${pos}`, data: { type: 'lamp', cell: n, pos, face: a } });
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.data.cell, c.data.pos)],
  apply(c, out, ctx) {
    const p = c.data;
    const at = { cell: p.cell, pos: p.pos, face: p.face };
    switch (p.type) {
      case 'court-hoop':
        out.prop({ type: 'court-hoop', at, params: { dx: round(p.dx), dz: round(p.dz) } });
        break;
      case 'umpire-chair':
        out.prop({ type: 'umpire-chair', at, params: { dx: round(p.dx), dz: round(p.dz) } });
        break;
      case 'court-net':
        out.prop({ type: 'court-net', at, params: { dx: round(p.dx), dz: round(p.dz), span: round(p.span) } });
        break;
      case 'court-goal':
        out.prop({ type: 'court-goal', ...(p.small ? { variant: 'small' as const } : {}), at, params: { dx: round(p.dx), dz: round(p.dz), span: round(p.span) } });
        break;
      case 'bench': {
        const bench = out.prop({ type: 'bench', variant: 'wood', at, params: { look: hash(ctx.seed, RULE, p.cell) % 1000 } });
        for (const n of [0, 1]) out.socket({ type: 'seat', owner: bench, name: `seat-${n}`, cell: p.cell, dir: p.face });
        break;
      }
      case 'lamp': {
        const lamp = out.prop({ type: 'lamp', variant: 'post', at: { cell: p.cell, pos: p.pos }, params: { look: hash(ctx.seed, RULE, p.cell) % 1000 } });
        out.socket({ type: 'lamp-head', owner: lamp, cell: p.cell });
        break;
      }
    }
  },
});

const round = (v: number): number => Math.round(v * 1000) / 1000;

/** A path, plaza or house within two cells of the field. */
function inTown(facts: { world: { floors: ReadonlyMap<CellKey, string> }; kinds: ReadonlyMap<CellKey, string> }, cells: readonly CellKey[]): boolean {
  for (const c of cells) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = keyX(c) + dx, z = keyZ(c) + dz;
        if (x < 0 || z < 0 || x > 47 || z > 47) continue;
        const f = facts.world.floors.get(key(x, keyY(c), z));
        if (f === 'path' || f === 'plaza') return true;
        if (facts.kinds.get(key(x, keyY(c), z)) === 'house') return true;
      }
    }
  }
  return false;
}
