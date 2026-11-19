// R-L01 · Lighthouse. Always: red and white bands (the generator), a gallery
// rail and a lantern room on the top storey, with the socket the beam (L09)
// turns in. Six storeys or more add a second gallery half-way up.

import { above } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';

export default defineRule({
  id: 'R-L01.lighthouse',
  part: 'roles',
  tier: 1,
  priority: 7990,
  about:
    'Reads: lighthouse structures. Emits: role lighthouse; cap/lantern-room (sockets lantern, tower-top, flag-mount) and a gallery ' +
    '(sockets flag-mount, perch) on the top cell when nothing stands on it; tag second-gallery and a second gallery at 6+ storeys.',
  find({ plan }) {
    const out = [];
    for (const s of plan.structures.values()) if (s.kind === 'lighthouse') out.push({ anchor: s.cells[0]!, structure: s.id });
    return out;
  },
  apply(c, out, { plan }) {
    const s = plan.structures.get(c.structure!)!;
    const n = s.cells.length;
    const top = s.cells[n - 1]!;
    out.role(s.id, 'lighthouse');
    const gallery = (cell: number): void => {
      const g = out.feature({ type: 'gallery', structure: s.id, cell });
      out.socket({ type: 'flag-mount', owner: g, cell, structure: s.id });
      out.socket({ type: 'perch', owner: g, cell, structure: s.id });
    };
    if (!plan.kinds.has(above(top))) {
      const cap = out.feature({ type: 'cap', variant: 'lantern-room', structure: s.id, cell: top });
      out.socket({ type: 'lantern', owner: cap, cell: top, structure: s.id });
      out.socket({ type: 'tower-top', owner: cap, cell: top, structure: s.id });
      gallery(top);
    }
    if (n >= 6) {
      out.tag(s.id, 'second-gallery');
      gallery(s.cells[Math.floor(n / 2)]!);
    }
  },
});
