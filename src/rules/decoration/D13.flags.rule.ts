// D13 · tier 1 · Flags.
//
//   a watchtower's cap      a pennant, half the time (DRESSING.flagWatchtower)
//   a castle turret         a swallow-tailed banner, always
//   a lighthouse gallery    a pennant, always
//   the end of a pier       a pennant on its post, half the time (flagPier)
//   a square                a free-standing flagpole, on a plaza containing
//                           a DRESSING.flagSquare² block with no fountain:
//                           at its centre, or (where the big lamp of D02
//                           has the centre) in the middle of its north side
//
// All the flags of one town share a colour (lib.townColor), so a town has
// its colours. The tallest structure's flag is D13-T (town-wide).
//
// Reads: flag-mount and pier-end sockets, roles, plazas, clearways.
// Claims: the socket, or the flagpole's floor slot.

import { key, type CellKey } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { plazas } from '@/resolve/facts/plazas.fact';
import type { Anchor, CellPos, Slot } from '@/resolve/plan';
import { DRESSING } from '@/style/dressing';
import { largestSquareAt } from '../joinery/J22.plaza-paving.rule';
import { clearways } from './clearways.fact';
import { lucky, townColor } from './lib';

interface Flag {
  variant: 'pennant' | 'banner' | 'pole';
  /** A pennant on a pier flies from a tall staff standing on the deck. */
  staff?: number;
  /** A flagpole at the middle of an even square stands this far behind its corner slot. */
  back?: number;
  at: Anchor;
  claim: Slot;
  /** One claim per square: the pole stands at the first of its places that is free. */
  group?: Slot;
}

const RULE = 'D13.flags';

export default defineRule<Flag>({
  id: RULE,
  part: 'decoration',
  tier: 1,
  priority: 870,
  about: 'Reads: flag-mount and pier-end sockets, roles, plazas (largest square), clearways. Claims: the socket, or the flagpole’s floor slot.',
  find({ facts, seed, plan }) {
    const out: Candidate<Flag>[] = [];
    const features = new Map(plan.features.map((f) => [f.id, f]));
    for (const s of socketsOfType(facts, 'flag-mount')) {
      if (s.structure === undefined) continue;
      const role = plan.roles.get(s.structure)?.role;
      const owner = s.owner === undefined ? undefined : features.get(s.owner);
      let variant: Flag['variant'] | null = null;
      if (role === 'castle-turret') variant = 'banner';
      else if (role === 'watchtower') variant = lucky(seed, RULE, s.cell, 'tower', DRESSING.flagWatchtower) ? 'pennant' : null;
      else if (role === 'lighthouse' && owner?.type === 'gallery') variant = 'pennant';
      // From a gallery rail the staff must clear the lantern room.
      const staff = owner?.type === 'gallery' ? 0.95 : undefined;
      if (variant) out.push({ anchor: s.cell, structure: s.structure, key: s.id, data: { variant, staff, at: { socket: s.id }, claim: slot.socket(s.id) } });
    }
    for (const s of socketsOfType(facts, 'pier-end')) {
      if (!lucky(seed, RULE, s.cell, 'pier', DRESSING.flagPier)) continue;
      out.push({ anchor: s.cell, structure: s.structure, key: s.id, data: { variant: 'pennant', staff: 1.05, at: { socket: s.id }, claim: slot.socket(s.id) } });
    }
    const clear = clearways(facts);
    for (const plaza of plazas(facts).list) {
      if (plaza.largestSquare < DRESSING.flagSquare || plaza.cells.some((c) => facts.kinds.get(c) === 'fountain')) continue;
      const sq = largestSquareAt(plaza.cells);
      const half = Math.floor((sq.size - 1) / 2);
      const odd = sq.size % 2 === 1;
      // The centre; else the middle of the north side, then of the south side.
      const places: [CellKey, CellPos][] = [
        [key(sq.x + half, sq.y, sq.z + half), odd ? 'c' : 'se'],
        [key(sq.x + half, sq.y, sq.z), odd ? 'n' : 'ne'],
        [key(sq.x + half, sq.y, sq.z + sq.size - 1), odd ? 's' : 'se'],
      ];
      const group = slot.custom(RULE, 'square', plaza.cells[0]!);
      // All on one anchor (the centre cell), so the engine tries them in this order.
      places.forEach(([cell, pos], i) => {
        if (!clear.free(cell, pos) || !clear.headroom(cell, pos)) return;
        // On a square of even side the true middle is the corner of the cell, a little beyond the corner slot.
        const back = !odd && i === 0 ? 0.15 * Math.SQRT2 : 0;
        out.push({ anchor: places[0]![0], key: `pole-${i}`, data: { variant: 'pole', back, at: back ? { cell, pos } : { cell, pos, face: 2 }, claim: slot.floor(cell, pos), group } });
      });
    }
    return out;
  },
  claims: (c) => (c.data.group ? [c.data.claim, c.data.group] : [c.data.claim]),
  apply(c, out, ctx) {
    const look = Math.floor(ctx.rand('look') * 100);
    const color = townColor(ctx.seed);
    const params = { color, look, ...(c.data.staff ? { staff: c.data.staff } : {}), ...(c.data.back ? { back: c.data.back } : {}) };
    out.prop({ type: 'flag', variant: c.data.variant, at: c.data.at, params });
  },
});
