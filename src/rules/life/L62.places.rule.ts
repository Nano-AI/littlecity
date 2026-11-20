// L62 · tier 2 · The structures builder's buildings at work. Posts for the
// chains in src/life/town/chains/places.ts:
//
//   school|door|<id>       outside the schoolhouse's door (R-H21)
//   school|yard|<id>       the walkable cell of its hopscotch court
//   smith|anvil|<chimney>  the walkable cell beside the smithy's anvil (R-H19); ref the forge chimney
//   show|stage|<id>        where the players or the band stand: the theatre's stage (the backdrop's cell
//                          and its neighbours on the paving, R-M09), or the bandstand's floor at its way
//                          in, facing out through the open bay (R-M11)
//   show|seat|<id>         where the audience sits or stands: the theatre's tiers, the cells in front of
//                          the bandstand's open bay
//   vend|door|<id>         outside a bridge shop's door (R-H20), for its shopkeeper
//
// Warehouses (R-H17) are read by L58: their loading doors take what the carters bring.

import { above, DIR4, inColumnBounds, key, keyX, keyY, keyZ, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { navOf, steps, toward } from './people.lib';
import { doorPlace } from './town.lib';

interface Data {
  name: string;
  dir?: Dir4;
  structure?: number;
}

/** At most this many seats for one show. */
export const SHOW_SEATS = 10;

export default defineRule<Data>({
  id: 'L62.places',
  part: 'life',
  tier: 2,
  priority: 380,
  townWide: true,
  about: 'Reads: schoolhouses, smithies, theatres, bandstands, bridge shops and their props, the walking graph. Emits: errand sockets school|, smith|, show| and vend|.',
  find(ctx) {
    const nav = navOf(ctx);
    if (!nav || !ctx.dressing) return [];
    const { facts, plan } = ctx;
    const out: Candidate<Data>[] = [];
    const add = (cell: CellKey, k: string, data: Data): void => {
      if (cell !== NO_CELL && nav.nodeAt.has(cell)) out.push({ anchor: cell, key: k, data });
    };
    const propCell = (type: string, variant: string, near: (c: CellKey) => boolean): CellKey | null => {
      for (const p of ctx.dressing!.props) if (p.type === type && p.variant === variant && 'cell' in p.at && near(p.at.cell)) return p.at.cell;
      return null;
    };
    /** A walkable cell at or beside a cell (the cell itself, the one above it, its neighbours). */
    const walkable = (c: CellKey): CellKey | null => {
      for (const n of [c, above(c), ...([0, 1, 2, 3] as Dir4[]).map((d) => key(keyX(c) + DIR4[d]![0], keyY(c), keyZ(c) + DIR4[d]![1]))]) if (n !== NO_CELL && nav.nodeAt.has(n)) return n;
      return null;
    };
    const all = [...facts.structures.values()].sort((a, b) => a.id - b.id);
    for (const s of all) {
      const role = plan.roles.get(s.id)?.role as string | undefined;
      if (role === 'schoolhouse') {
        const door = doorPlace(nav, s.id);
        if (!door) continue;
        add(door.cell, `school-door:${s.id}`, { name: `school|door|${s.id}`, dir: door.dir, structure: s.id });
        const yard = propCell('structure-prop', 'hopscotch', (c) => steps(c, door.cell) <= 6);
        const y = yard !== null ? walkable(yard) : null;
        if (y !== null) add(y, `school-yard:${s.id}`, { name: `school|yard|${s.id}`, structure: s.id });
      } else if (role === 'smithy') {
        const anvil = propCell('structure-prop', 'anvil', (c) => s.cells.some((x) => steps(x, c) <= 2));
        const chimney = all.find((t) => plan.roles.get(t.id)?.role === 'forge-chimney' && t.cells.some((x) => s.cells.some((y) => steps(x, y) <= 1)));
        const at = anvil !== null ? walkable(anvil) : null;
        if (at !== null) add(at, `smith:${s.id}`, { name: `smith|anvil|${chimney?.id ?? ''}`, structure: s.id, ...(anvil !== null && at !== anvil ? { dir: toward(at, anvil) } : {}) });
      } else if (role === 'bandstand') {
        // The band plays on the pavilion's floor, at its way in (R-M11 'pavilion-floor' with a side), facing
        // out; the listeners gather outside in front of the open bay, nearest first.
        const ways = (plan.featuresByStructure.get(s.id) ?? []).filter((f) => f.type === 'pavilion-floor' && f.dir !== undefined && f.cell !== undefined && nav.nodeAt.has(f.cell));
        if (ways.length === 0) continue;
        const dir = ways[0]!.dir as Dir4;
        const [dx, dz] = DIR4[dir]!;
        const fronts = ways.map((f) => key(keyX(f.cell!) + dx, keyY(f.cell!), keyZ(f.cell!) + dz)).filter((c) => nav.nodeAt.has(c));
        if (fronts.length === 0) continue;
        const fx = fronts.reduce((a, c) => a + keyX(c), 0) / fronts.length, fz = fronts.reduce((a, c) => a + keyZ(c), 0) / fronts.length;
        const floor = new Set((plan.featuresByStructure.get(s.id) ?? []).filter((f) => f.type === 'pavilion-floor').map((f) => f.cell!));
        const y = keyY(fronts[0]!);
        const seats: CellKey[] = [];
        for (let a = 0; a <= 3; a++) {
          for (let b = -3; b <= 3; b++) {
            const x = Math.round(fx) + dx * a - dz * b, z = Math.round(fz) + dz * a + dx * b;
            if (!inColumnBounds(x, z)) continue;
            const c = key(x, y, z);
            if ( floor.has(c) || !nav.nodeAt.has(c) || seats.includes(c)) continue;
            // In front of the bay, not beside the pavilion.
            if ((x - fx) * dx + (z - fz) * dz < 0) continue;
            seats.push(c);
          }
        }
        for (const c of fronts) if (!seats.includes(c)) seats.push(c);
        const near = (c: CellKey): number => Math.hypot(keyX(c) - fx, keyZ(c) - fz);
        seats.sort((a, b) => near(a) - near(b) || a - b);
        ways.forEach((f, i) => add(f.cell!, `stage:${s.id}:${i}`, { name: `show|stage|${s.id}`, dir, structure: s.id }));
        seats.slice(0, SHOW_SEATS).forEach((c, i) => add(c, `seat:${s.id}:${i}`, { name: `show|seat|${s.id}`, dir: opposite(dir), structure: s.id }));
      } else if (role === 'theatre') {
        // The stage: the backdrop's cell and its neighbours (theatre), else the walkable cells on and round the bandstand.
        const backdrop = role === 'theatre' ? propCell('structure-prop', 'backdrop', (c) => s.cells.some((x) => steps(x, c) <= 1)) : null;
        const tops = s.cells.map((c) => above(c)).filter((c) => c !== NO_CELL && nav.nodeAt.has(c) && !s.cells.includes(c));
        let stage: CellKey[];
        if (backdrop !== null) {
          const b = walkable(backdrop);
          stage = b === null ? [] : [b, ...([1, 3] as Dir4[]).map((d) => key(keyX(b) + DIR4[d]![0], keyY(b), keyZ(b) + DIR4[d]![1])).filter((c) => nav.nodeAt.has(c))];
        } else stage = [];
        // The bandstand with no floor to stand on: the band plays at its foot.
        const ring: CellKey[] = [];
        for (const c of s.cells) for (const d of [0, 1, 2, 3] as Dir4[]) for (const y of [0, -1, -2, -3]) {
          const n = key(keyX(c) + DIR4[d]![0], keyY(c) + y, keyZ(c) + DIR4[d]![1]);
          if (nav.nodeAt.has(n) && !s.cells.includes(n) && !ring.includes(n)) ring.push(n);
        }
        // A bandstand's band plays at its foot (its roof is no place to stand), on the side nearest the houses' doors.
        if (stage.length === 0) stage = ring.slice(0, 2);
        if (stage.length === 0) continue;
        const centre = stage[0]!;
        const seats = (role === 'theatre' ? tops : ring).filter((c) => !stage.includes(c)).sort((a, b) => steps(a, centre) - steps(b, centre) || a - b).slice(0, SHOW_SEATS);
        if (seats.length === 0) continue;
        stage.forEach((c, i) => add(c, `stage:${s.id}:${i}`, { name: `show|stage|${s.id}`, dir: toward(c, seats[0]!), structure: s.id }));
        seats.forEach((c, i) => add(c, `seat:${s.id}:${i}`, { name: `show|seat|${s.id}`, dir: toward(c, centre), structure: s.id }));
      } else if (role === 'bridge-shop') {
        const door = doorPlace(nav, s.id);
        if (door) add(door.cell, `vend:${s.id}`, { name: `vend|door|${s.id}`, dir: door.dir, structure: s.id });
      }
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    out.socket({ id: `L62.places@${c.anchor}:${String(c.key)}`, type: 'errand', cell: c.anchor, name: d.name, ...(d.dir !== undefined ? { dir: d.dir } : {}), ...(d.structure !== undefined ? { structure: d.structure } : {}) });
  },
});
