// R-H99 · tier 2 · Role props. The props the tier 2 house roles promise
// (catalogue R-H03, R-H05, R-H06, R-H14), which belong to a role rather than
// to any general decoration rule:
//
//   boathouse        a slipway from the boat doors into the water (when the
//                    doors face open water); a net hung to dry on a landward wall
//   inn              a lantern on a bracket by the door
//   mill house       flour sacks by the door and a hand cart
//   lookout cottage  a telescope on a tripod outside
//
// A decoration-stage rule (props exist only there), kept with the house role
// rules it serves. Priority 895: before the general doorstep dressing (D11),
// so these get their floor slots first.
import { DIR4_NAMES, neighbor, NO_CELL, opposite, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { cellInfo } from '@/resolve/facts/cell.fact';
import { facades } from '@/resolve/facts/facades.fact';
import type { Anchor, CellPos } from '@/resolve/plan';

type Variant = 'slipway' | 'net' | 'lantern' | 'sacks' | 'cart' | 'telescope';
interface Data {
  variant: Variant;
  at: Anchor;
  claim: string;
  params?: { back: number; up: number };
}

/** The floor corners of the cell outside a door on side d: the two by the wall, then the two away from it. */
const CORNERS: Record<Dir4, readonly [CellPos, CellPos, CellPos, CellPos]> = {
  0: ['sw', 'se', 'nw', 'ne'],
  1: ['nw', 'sw', 'ne', 'se'],
  2: ['nw', 'ne', 'sw', 'se'],
  3: ['ne', 'se', 'nw', 'sw'],
};

export default defineRule<Data>({
  id: 'R-H99.role-props',
  part: 'decoration',
  tier: 2,
  priority: 895,
  about: 'Reads: house roles, main doors and their sockets, facades. Emits: role-prop props. Claims: the floor slots they stand on.',
  find(ctx) {
    const { plan, facts } = ctx;
    const info = cellInfo(facts);
    const all = facades(facts);
    const out: Candidate<Data>[] = [];
    const free = (cell: CellKey): boolean => cell !== NO_CELL && !facts.kinds.has(cell) && info.at(cell).standable;
    for (const [id, { role }] of plan.roles) {
      if (role !== 'boathouse' && role !== 'inn' && role !== 'mill-house' && role !== 'lookout-cottage') continue;
      const door = (plan.featuresByStructure.get(id) ?? []).find((f) => f.type === 'door' && (f.params as { main?: number } | undefined)?.main === 1);
      if (!door || door.cell === undefined || door.dir === undefined) continue;
      const dir = door.dir as Dir4;
      const socket = (plan.socketsByOwner.get(door.id) ?? []).find((s) => s.type === 'door');
      const front = neighbor(door.cell, dir);
      const steps = (door.params as { steps?: number } | undefined)?.steps ?? 0;
      const add = (variant: Variant, at: Anchor, claim: string, params?: Data['params']): void => {
        out.push({ anchor: door.cell!, structure: id, key: variant, data: { variant, at, claim, params } });
      };
      // Where loose things can stand: the cell outside the door if it is level and not a garden bed,
      // else outside another ground-storey wall.
      const open = (cell: CellKey): boolean => free(cell) && facts.world.floors.get(cell) !== 'garden';
      let yard: { cell: CellKey; dir: Dir4 } | null = steps === 0 && open(front) ? { cell: front, dir } : null;
      if (!yard) {
        const other = (all.byStructure.get(id) ?? []).find((f) => f.storey === 1 && f.drop === 0 && !f.touching && open(neighbor(f.cell, f.dir)));
        if (other) yard = { cell: neighbor(other.cell, other.dir), dir: other.dir };
      }
      const corner = (i: number): { at: Anchor; claim: string } => {
        const pos = CORNERS[yard!.dir][i]!;
        return { at: { cell: yard!.cell, pos, face: yard!.dir }, claim: slot.floor(yard!.cell, pos) };
      };
      if (role === 'boathouse') {
        if (socket && all.at(door.cell, dir)?.water === 1) add('slipway', { socket: socket.id }, slot.custom('role-prop', id, 'slipway'));
        // The net: on a ground-storey wall that looks onto dry, level ground, not the door's.
        const wall = (all.byStructure.get(id) ?? []).find((f) => f.storey === 1 && f.drop === 0 && f.dir !== dir && !f.touching && f.faces !== 'structure' && free(neighbor(f.cell, f.dir)));
        if (wall) {
          const cell = neighbor(wall.cell, wall.dir);
          const pos = DIR4_NAMES[opposite(wall.dir)] as CellPos;
          add('net', { cell, pos, face: wall.dir }, slot.floor(cell, pos));
        }
      } else if (role === 'inn') {
        if (socket) add('lantern', { socket: socket.id }, slot.custom('role-prop', id, 'lantern'), { back: Math.round((0.37 + steps * 0.1) * 100) / 100, up: Math.round(steps * 0.16 * 100) / 100 });
      } else if (!yard) {
        continue; // nowhere level to stand things
      } else if (role === 'mill-house') {
        const sacks = corner(0), cart = corner(1); // either side of the door
        add('sacks', sacks.at, sacks.claim);
        add('cart', cart.at, cart.claim);
      } else {
        const scope = corner(2);
        add('telescope', scope.at, scope.claim);
      }
    }
    return out;
  },
  claims: (c) => [c.data.claim],
  apply(c, out) {
    out.prop({ type: 'role-prop', variant: c.data.variant, at: c.data.at, ...(c.data.params ? { params: c.data.params } : {}) });
  },
});
