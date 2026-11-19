// DEMO FIXTURE, not a catalogue rule. A joinery rule: every cottage gets a
// door on the south face of its lowest cell (with a 'door' socket owned by
// the door) and a chimney on its top cell (with a 'chimney-top' socket).
import { S } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'J-X01.demo-door',
  part: 'joinery',
  tier: 1,
  priority: 50,
  find({ plan }) {
    // Roles ran before joinery, so plan.roles is complete here.
    return [...plan.structures.values()]
      .filter((s) => plan.roles.get(s.id)?.role === 'cottage')
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id, data: { top: s.cells[s.cells.length - 1]! } }));
  },
  apply(c, out) {
    const door = out.feature({ type: 'door', structure: c.structure!, cell: c.anchor, dir: S, variant: 'plain', params: { main: 1 } });
    out.socket({ type: 'door', owner: door, cell: c.anchor, dir: S, structure: c.structure });
    const chimney = out.feature({ type: 'chimney', structure: c.structure!, cell: c.data.top, variant: 'plain' });
    out.socket({ type: 'chimney-top', owner: chimney, cell: c.data.top, structure: c.structure });
  },
});
