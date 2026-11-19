// DEMO FIXTURE, not a catalogue rule. A life rule: smoke from every chimney.
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'L-X01.demo-smoke',
  part: 'life',
  tier: 1,
  priority: 50,
  find({ facts }) {
    return socketsOfType(facts, 'chimney-top').map((s) => ({ anchor: s.cell, structure: s.structure, data: { socket: s.id } }));
  },
  apply(c, out) {
    out.actor({ type: 'smoke', at: { socket: c.data.socket }, home: c.structure });
  },
});
