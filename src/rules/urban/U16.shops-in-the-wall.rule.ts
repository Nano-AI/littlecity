// U16 · tier 2 · Shops in the wall (discovery round 1, UF-03).
//
// The owner's "weird area": the long blank side of a big marble platform or
// podium beside a street, a square or a strip of grass. Real towns hollow
// such walls into booths, workshops and fountain niches (Roman tabernae under
// a temple podium, the vaults under a city wall).
//
// Trigger: a run of 3 or more ground-storey cells of one marble structure's
// wall, all facing the same way, in a straight line, where
//   the wall is at least 2 storeys tall there (the cell above is the same
//   structure),
//   the wall is blank (no door, window, arrow slit or other feature on it),
//   the ground cell right outside is standable ground at the wall's foot,
//   and the wall looks out on a street, a plaza or open ground within 2.
// Must not: a castle's keep or gatehouse (they stay blank and arrow-slit),
// a quay wall (it faces water), a temple or a plinth.
//
// Along the run, one thing every second cell (a lattice fixed to the map):
//   facing a street or a plaza: an arched booth with its goods (wine, bread,
//   pots, a cobbler, fruit), or, once in a run of 4 or more, a wall fountain;
//   the grass strip in front of the wall is paved (a derived apron);
//   facing open ground: a storeroom door, a bench in a niche, or ivy
//   climbing two storeys.
// Sockets for the life builder: a booth's 'activity'/'vend' and 'browse', a
// fountain's 'activity'/'fetch-water', a niche bench's two seats.
//
// The marble generator cannot leave a recess, so each of these is a prop
// standing against the wall that draws its own arch (see wall.part.ts).
//
// Stability: every choice is seeded by its own wall cell; the lattice is
// fixed to the map, so a longer wall never moves the booths already there.
//
// Reads: facades, roles, features, wildGrass, clearways. Claims: the edge
// slot of each piece; paving claims its cell's 'paving' slot.

import { above, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { facades, type Facade } from '@/resolve/facts/facades.fact';
import { wildGrass } from '@/resolve/facts/grass.fact';
import { DIRS } from '@/resolve/facts/lib';
import type { Slot } from '@/resolve/plan';
import { clearways, edgePos } from '../decoration/clearways.fact';
import { onGround } from '../decoration/lib';
import { claimsOf, emit, placer, type Placed } from './plots';

const RULE = 'U16.shops-in-the-wall';
/** Roles whose walls stay as they are. */
const KEEP_BLANK = new Set(['keep', 'gatehouse', 'quay-wall', 'temple', 'plinth']);
const GOODS = ['wine', 'bread', 'pots', 'cobbler', 'fruit'] as const;
const RUN_MIN = 3;

export default defineRule<{ items: Placed[]; paved: CellKey[] }>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 840,
  about: 'Reads: facades (marble, ground storey), roles, wall features, wildGrass, clearways. Claims: the edge slot of each booth, fountain, door, bench and creeper; a paving slot per paved cell.',
  find({ facts, plan, seed }) {
    const clear = clearways(facts);
    const grass = wildGrass(facts);
    const featured = new Set<string>();
    for (const ft of plan.features) if (ft.cell !== undefined && ft.dir !== undefined) featured.add(`${ft.cell}:${ft.dir}`);
    // The blank ground-storey wall cells, by structure, side and line.
    const lines = new Map<string, Facade[]>();
    for (const fc of facades(facts).list) {
      if (fc.kind !== 'marble' || fc.storey !== 1) continue;
      if (KEEP_BLANK.has(plan.roles.get(fc.structure)?.role ?? '')) continue;
      if (fc.faces !== 'street' && fc.faces !== 'plaza' && fc.faces !== 'ground') continue;
      if (fc.dist > 2 || featured.has(`${fc.cell}:${fc.dir}`)) continue;
      if (facts.structureAt.get(above(fc.cell)) !== fc.structure) continue;
      const out = neighbor(fc.cell, fc.dir);
      if (out === NO_CELL || keyY(out) !== keyY(fc.cell) || !onGround(facts, out) || facts.kinds.has(out)) continue;
      const line = fc.dir === 0 || fc.dir === 2 ? keyZ(fc.cell) : keyX(fc.cell);
      const k = `${fc.structure}:${fc.dir}:${line}:${keyY(fc.cell)}`;
      const list = lines.get(k);
      if (list) list.push(fc);
      else lines.set(k, [fc]);
    }
    const out: Candidate<{ items: Placed[]; paved: CellKey[] }>[] = [];
    for (const list of [...lines.values()].sort((a, b) => a[0]!.cell - b[0]!.cell)) {
      const along = (f: Facade): number => (f.dir === 0 || f.dir === 2 ? keyX(f.cell) : keyZ(f.cell));
      list.sort((a, b) => along(a) - along(b));
      // Split into unbroken runs.
      const runs: Facade[][] = [];
      for (const f of list) {
        const last = runs[runs.length - 1];
        if (last && along(f) === along(last[last.length - 1]!) + 1) last.push(f);
        else runs.push([f]);
      }
      for (const run of runs) {
        if (run.length < RUN_MIN) continue;
        const p = placer((c, pos) => clear.free(c, pos));
        const paved: CellKey[] = [];
        const dir = run[0]!.dir;
        const fountainAt = run.length >= 4 ? run.filter((f) => along(f) % 2 === 0).sort((a, b) => hash(seed, RULE, 'fountain', a.cell) - hash(seed, RULE, 'fountain', b.cell))[0] : undefined;
        for (const f of run) {
          const cell = neighbor(f.cell, dir);
          const front = (f.street ?? 99) <= 2 || (f.plaza ?? 99) <= 2;
          // The strip in front of a street or square is paved, booth or not.
          if (front && grass.has(cell)) paved.push(cell);
          if (along(f) % 2 !== 0) continue;
          const pos = edgePos(opposite(dir));
          const look = hash(seed, RULE, 'look', f.cell) % 1000;
          if (front) {
            if (f === fountainAt) p.put({ type: 'wall-fountain', cell, pos, face: dir, activities: ['fetch-water'] });
            else p.put({ type: 'wall-booth', variant: GOODS[hash(seed, RULE, 'goods', f.cell) % GOODS.length], cell, pos, face: dir, activities: ['vend', 'browse'], params: { inset: 0, look } });
          } else {
            const roll = hash(seed, RULE, 'ground', f.cell) % 10;
            if (roll < 4) p.put({ type: 'store-door', cell, pos, face: dir, params: { inset: 0, look } });
            else if (roll < 7) p.put({ type: 'niche-bench', cell, pos, face: dir, seats: 2, params: { inset: 0, look } });
            else p.put({ type: 'creeper', cell, pos, face: dir, params: { storeys: 2, inset: 0, look, face: dir } });
          }
        }
        // The apron: the paved cells, run on into each other.
        const set = new Set(paved);
        for (const c of paved) {
          let mask = 0;
          for (const d of DIRS) if (set.has(neighbor(c, d))) mask |= 1 << d;
          p.put({ type: 'paving', variant: 'slabs', cell: c, pos: 'nw', face: 2, claim: false, params: { mask } });
        }
        if (p.items.length) out.push({ anchor: run[0]!.cell, key: dir, data: { items: p.items, paved } });
      }
    }
    return out;
  },
  claims: (c): Slot[] => [...claimsOf(c.data.items), ...c.data.paved.map((cell) => slot.custom('paving', cell))],
  apply: (c, out) => emit(out, c.data.items),
});
