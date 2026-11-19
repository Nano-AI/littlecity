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
import type { FeatureVariant, Role, Tag } from '@/core/vocab';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import { cellInfo } from '@/resolve/facts/cell.fact';
import { facades } from '@/resolve/facts/facades.fact';

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
    'Reads: tower and lighthouse structures, their roles and features so far, facades. Emits: tags body:round/square and footing:water; ' +
    'a cap by role (sockets tower-top, flag-mount); window/slit features spiralling up (socket window); a main door if there is none (socket door).',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) {
      if (s.kind === 'tower' || s.kind === 'lighthouse') out.push({ anchor: s.cells[0]!, structure: s.id });
    }
    return out;
  },
  apply(c, out, { plan, facts }) {
    const s = plan.structures.get(c.structure!)!;
    const n = s.cells.length;
    const bottom = s.cells[0]!;
    const top = s.cells[n - 1]!;
    const have = plan.featuresByStructure.get(s.id) ?? [];
    const info = cellInfo(facts);

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
    const free = (cell: CellKey, d: Dir4): boolean => {
      const o = neighbor(cell, d);
      return o !== NO_CELL && !plan.kinds.has(o) && !info.at(o).inTerrain;
    };

    // The door: the ground storey's best side, scored as J06 scores a house's.
    let doorDir = have.find((f) => f.type === 'door' && f.cell === bottom)?.dir as Dir4 | undefined;
    const start = hash(s.seed, 'spiral') & 3;
    // No door where it stands on a pitched roof or on another tower; none in mid-air.
    const under = below(bottom);
    const underKind = under === NO_CELL ? undefined : plan.kinds.get(under);
    const onFlat = info.at(bottom).walkableTop && underKind !== 'house' && underKind !== 'tower' && underKind !== 'lighthouse';
    if (!have.some((f) => f.type === 'door') && onFlat) {
      const sides = facades(facts);
      let best = -Infinity;
      for (let k = 0; k < 4; k++) {
        const d = ((start + k) & 3) as Dir4;
        const f = sides.at(bottom, d);
        if (!f || f.drop > 0 || !free(bottom, d)) continue;
        let score = 0;
        if (f.street === 1) score += 5;
        if (f.plaza === 1) score += 4;
        if (f.street !== undefined || f.plaza !== undefined || f.garden !== undefined) score += 3;
        if (f.faces === 'ground') score += 1;
        if (f.faces === 'water' || f.faces === 'cliff' || f.alley) score -= 3;
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
