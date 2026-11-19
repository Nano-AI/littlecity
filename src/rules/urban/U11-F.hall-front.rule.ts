// U11-F · tier 2 · The town hall's front (the shape half of U11; the role is
// U11.civic-hall). On a house with the role 'town-hall':
//
//   an arcade      one bay in front of every ground-storey cell that looks
//                  straight out onto the square (feature 'arcade'); where the
//                  run of bays ends, a whole pier closes it
//   a balcony      on the storey over the main door (an iron balcony; J09
//                  puts a tall window behind it)
//   a clock        on the top storey over the door (or, on a hall of two
//                  storeys, beside the balcony): feature 'vista/clock', which
//                  owns 'clock-hands' and, on a hall of three storeys or more,
//                  a 'flag-mount' for D13's flag
//
// Runs in the shape stage (part 'joinery') after the main door (J06, 940)
// and before the windows (J09, 910), so the windows leave the clock's wall
// clear. Priority 916: before U09 (915), so a hall at a street's end keeps
// its own clock.
//
// Reads: roles, the main door, facades (plaza right outside, exposed walls).
// Claims: nothing (one candidate per hall).

import { above, neighbor, turn, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import type { Feature, StructureId } from '@/resolve/plan';

const RULE = 'U11-F.hall-front';

export default defineRule<{ door: Feature }>({
  id: RULE,
  part: 'joinery',
  tier: 2,
  priority: 916,
  about: 'Reads: town-hall roles, the main door (J06), facades (plaza right outside, exposed walls above the door), plazas (squares). Emits: arcade bays, a balcony and a clock (vista/clock, with clock-hands and flag-mount sockets).',
  find({ plan }) {
    const out: Candidate<{ door: Feature }>[] = [];
    for (const [id, { role }] of plan.roles) {
      if (role !== 'town-hall') continue;
      const door = (plan.featuresByStructure.get(id) ?? []).find((f) => f.type === 'door' && (f.params as { main?: number } | undefined)?.main === 1);
      if (!door || door.cell === undefined || door.dir === undefined) continue;
      out.push({ anchor: door.cell, structure: id, data: { door } });
    }
    return out;
  },
  apply(c, out, { facts, plan }) {
    const s: StructureId = c.structure!;
    const all = facades(facts);
    const squares = plazas(facts);
    const mine = all.byStructure.get(s) ?? [];
    const exposed = (cell: CellKey, d: Dir4): boolean => {
      const f = all.at(cell, d);
      return !!f && f.structure === s && !f.touching;
    };

    // The arcade: ground-storey cells looking straight out onto a square.
    const bays = new Set<number>();
    for (const f of mine) {
      if (f.storey !== 1 || f.plaza !== 1 || f.drop !== 0 || f.touching) continue;
      if (!squares.byCell.get(neighbor(f.cell, f.dir))?.square) continue;
      bays.add(f.cell * 4 + f.dir);
    }
    for (const k of [...bays].sort((a, b) => a - b)) {
      const cell = Math.floor(k / 4), d = (k % 4) as Dir4;
      const runsOn = (side: Dir4): 0 | 1 => (bays.has(neighbor(cell, side) * 4 + d) ? 0 : 1);
      out.feature({ type: 'arcade', structure: s, cell, dir: d, params: { left: runsOn(turn(d, 1)), right: runsOn(turn(d, -1)) } });
    }

    // Balcony and clock, over the door.
    const door = c.data.door;
    const d = door.dir as Dir4;
    const column: CellKey[] = [];
    for (let cell = above(door.cell!); plan.structureAt.get(cell) === s && exposed(cell, d); cell = above(cell)) column.push(cell);
    if (column.length === 0) return;
    const balcony = out.feature({ type: 'balcony', structure: s, cell: column[0]!, dir: d, variant: 'iron' });
    out.socket({ type: 'perch', owner: balcony, structure: s, cell: column[0]!, dir: d });
    let clockAt: CellKey | null = column.length >= 2 ? column[column.length - 1]! : null;
    if (clockAt === null) {
      // Two storeys: beside the balcony, on whichever side has a wall.
      for (const side of [turn(d, -1), turn(d, 1)] as Dir4[]) {
        const n = neighbor(column[0]!, side);
        if (plan.structureAt.get(n) === s && exposed(n, d)) {
          clockAt = n;
          break;
        }
      }
    }
    if (clockAt === null) return;
    const clock = out.feature({ type: 'vista', variant: 'clock', structure: s, cell: clockAt, dir: d });
    out.socket({ type: 'clock-hands', owner: clock, structure: s, cell: clockAt, dir: d });
    // A flag beside the clock, where there is room for it under the eave (a hall of three storeys or more).
    if (column.length >= 2) out.socket({ type: 'flag-mount', owner: clock, name: 'flag-mount', structure: s, cell: clockAt, dir: d });
  },
});
