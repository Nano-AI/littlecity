// D20 · tier 1 · Bridge lamps.
//
//   a stone bridge   a short lamp on the end post at each end ('bridge-end'
//                    sockets, R-A01): two lamps, on opposite corners
//   a sky bridge     a lantern hanging under its crown ('arch-crown', J15)
//   a pier           the harbour lamp at its end ('pier-end', R-D02), unless
//                    D13 flew a pennant there
//
// Reads: bridge-end, arch-crown and pier-end sockets, roles.
// Claims: each socket.

import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';

type Kind = 'bridge' | 'pier' | 'hanging';

export default defineRule<{ socket: string; kind: Kind }>({
  id: 'D20.bridge-lamps',
  part: 'decoration',
  tier: 1,
  priority: 800,
  about: 'Reads: bridge-end, pier-end and (on sky bridges) arch-crown sockets. Claims: each socket.',
  find({ facts, plan }) {
    const out: Candidate<{ socket: string; kind: Kind }>[] = [];
    for (const s of socketsOfType(facts, 'bridge-end')) out.push({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id, kind: 'bridge' } });
    for (const s of socketsOfType(facts, 'pier-end')) out.push({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id, kind: 'pier' } });
    for (const s of socketsOfType(facts, 'arch-crown')) {
      if (s.structure === undefined || plan.roles.get(s.structure)?.role !== 'sky-bridge') continue;
      out.push({ anchor: s.cell, structure: s.structure, key: s.id, data: { socket: s.id, kind: 'hanging' } });
    }
    return out;
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, { rand }) {
    const at = { socket: c.data.socket };
    const lamp =
      c.data.kind === 'hanging'
        ? out.prop({ type: 'hanging-lantern', at })
        : out.prop({ type: 'lamp', variant: c.data.kind === 'bridge' ? 'bridge' : 'pier', at, params: { look: Math.floor(rand('look') * 1000) } });
    out.socket({ type: 'lamp-head', owner: lamp, cell: c.anchor, structure: c.structure });
  },
});
