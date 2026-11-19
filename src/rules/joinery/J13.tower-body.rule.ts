// J13 · Tower body. Base trim only at the bottom and a band course every two
// storeys are the generator's; this rule decides the rest of a tower's (and a
// lighthouse's) body:
//   - its shape and cap by role (round with a cone for a watchtower, square
//     with a spire for a steeple, and so on), when nothing stands on it;
//   - small windows spiralling a quarter turn per storey (arrow slits on a
//     castle turret), skipping sides another block touches, the belfry, the
//     clock and dove-hole storeys and the lantern stage;
//   - a door on the ground storey if no door rule (J06) gave it one;
//   - the tag 'footing:water' when it rises straight out of the sea.

import { above, below, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import type { FeatureVariant, Role, Tag } from '@/core/vocab';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';

const BY_ROLE: Partial<Record<Role, { body: Tag; cap: FeatureVariant<'cap'> }>> = {
  steeple: { body: 'body:square', cap: 'spire' },
  'castle-turret': { body: 'body:round', cap: 'battlements' },
  'clock-tower': { body: 'body:square', cap: 'pyramid' },
  observatory: { body: 'body:round', cap: 'dome' },
  dovecote: { body: 'body:round', cap: 'dovecote' },
  campanile: { body: 'body:square', cap: 'pyramid' },
  watchtower: { body: 'body:round', cap: 'cone' },
};

export default defineRule({
  id: 'J13.tower-body',
  part: 'joinery',
  tier: 1,
  priority: 870,
  about:
    'Reads: tower and lighthouse structures, their roles and features so far, the cells and floors straight outside. Emits: tags body:round/square and footing:water; ' +
    'a cap by role (sockets tower-top, flag-mount); window/slit features spiralling up (socket window); a main door if there is none (socket door).',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind === 'tower' || s.kind === 'lighthouse') out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    const n = s.cells.length;
    const bottom = s.cells[0]!;
    const top = s.cells[n - 1]!;
    const have = plan.featuresByStructure.get(s.id) ?? [];

    if (keyY(bottom) === 0 && plan.terrain.height[columnIndex(keyX(bottom), keyZ(bottom))] === 0) out.tag(s.id, 'footing:water');

    if (s.kind === 'tower') {
      const look = BY_ROLE[plan.roles.get(s.id)?.role ?? 'watchtower'] ?? BY_ROLE.watchtower!;
      out.tag(s.id, look.body);
      if (!plan.kinds.has(above(top)) && !have.some((f) => f.type === 'cap')) {
        const cap = out.feature({ type: 'cap', variant: look.cap, structure: s.id, cell: top });
        out.socket({ type: 'tower-top', owner: cap, cell: top, structure: s.id });
        out.socket({ type: 'flag-mount', owner: cap, cell: top, structure: s.id });
        if (look.cap === 'dome') out.socket({ type: 'telescope', owner: cap, cell: top, structure: s.id });
        if (look.cap === 'battlements' || look.cap === 'dovecote') out.socket({ type: 'perch', owner: cap, cell: top, structure: s.id });
      }
    }

    // A side is free for a window or a door if nothing stands in the cell outside it.
    const groundAt = (c: CellKey): number => plan.terrain.height[columnIndex(keyX(c), keyZ(c))]!;
    const firm = (c: CellKey): boolean => {
      if (c === NO_CELL) return false;
      if (keyY(c) < groundAt(c)) return true;
      const k = plan.kinds.get(c);
      return k !== undefined && KINDS[k].solid;
    };
    const free = (cell: CellKey, d: Dir4): boolean => {
      const o = neighbor(cell, d);
      return o !== NO_CELL && !plan.kinds.has(o) && keyY(o) >= groundAt(o);
    };

    // The door: the ground storey's best side, scored as J06 scores a house's: a street right outside
    // (+5), a plaza (+4), a floor within 3 cells (+3), open ground (+1). Never over a drop, the sea or
    // into a cliff. (Worked out from the cells straight ahead, so the rule stays cheap.)
    let doorDir = have.find((f) => f.type === 'door' && f.cell === bottom)?.dir as Dir4 | undefined;
    const start = hash(s.seed, 'spiral') & 3;
    // No door where it stands on a pitched roof or on another tower; none in mid-air.
    const under = below(bottom);
    const underKind = under === NO_CELL ? undefined : plan.kinds.get(under);
    const onFlat = firm(under) && underKind !== 'house' && underKind !== 'tower' && underKind !== 'lighthouse';
    if (!have.some((f) => f.type === 'door') && onFlat) {
      let best = -Infinity;
      for (let k = 0; k < 4; k++) {
        const d = ((start + k) & 3) as Dir4;
        if (!free(bottom, d)) continue;
        let o = neighbor(bottom, d);
        if (!firm(below(o))) continue; // a drop, or the sea
        const first = plan.world.floors.get(o);
        let score = first === 'path' ? 5 : first === 'plaza' ? 4 : 1;
        for (let step = 0; step < 3 && o !== NO_CELL && !plan.kinds.has(o) && keyY(o) >= groundAt(o); step++, o = neighbor(o, d)) {
          if (plan.world.floors.has(o)) {
            score += 3;
            break;
          }
        }
        if (score > best) {
          best = score;
          doorDir = d;
        }
      }
      if (doorDir !== undefined && best > -Infinity) {
        const door = out.feature({ type: 'door', variant: 'plain', structure: s.id, cell: bottom, dir: doorDir, params: { main: 1 } });
        out.socket({ type: 'door', owner: door, cell: bottom, dir: doorDir, structure: s.id });
      }
    }

    // Windows: one per storey, a quarter turn on from the one below.
    if (!have.some((f) => f.type === 'window' || f.type === 'arrow-slit')) {
      const skip = new Set<CellKey>();
      for (const f of have) if ((f.type === 'belfry' || f.type === 'clock-face' || f.type === 'dove-holes') && f.cell !== undefined) skip.add(f.cell);
      const slits = plan.roles.get(s.id)?.role === 'castle-turret';
      if (have.some((f) => f.type === 'cap' && f.variant === 'lantern-room') && n > 1) skip.add(top);
      let turn = doorDir !== undefined ? (doorDir + 1) & 3 : start;
      for (const cell of s.cells) {
        if (!skip.has(cell)) {
          for (let k = 0; k < 4; k++) {
            const d = ((turn + k) & 3) as Dir4;
            if (!free(cell, d) || (cell === bottom && d === doorDir)) continue;
            if (slits) out.feature({ type: 'arrow-slit', structure: s.id, cell, dir: d });
            else {
              const w = out.feature({ type: 'window', variant: 'slit', structure: s.id, cell, dir: d });
              out.socket({ type: 'window', owner: w, cell, dir: d, structure: s.id });
            }
            break;
          }
        }
        turn = (turn + 1) & 3;
      }
    }
  },
});
