// D11 · tier 2 · Doorstep.
//
// What stands at a house door that opens at ground level: a doormat,
// always; a pair of potted plants (DRESSING.doorPots); a barrel
// (doorBarrel); a bicycle leaning on the wall (doorBicycle, only where the
// door faces a street); and where the door faces a street or a square, a
// small lantern on the wall beside it, which glows at night and owns a
// 'lamp-head' socket.
//
// It is ONE prop per door, drawn against the wall beside the door and on
// the ground just in front of it, so it never stands in the doorway. The
// pots take the house's own flower colour (its window boxes and front
// garden match).
//
// Stability: each door rolls for itself, seeded by its own cell and feature id.
//
// Reads: door features and their sockets, facades (what the door faces).
// Claims: the door's socket.

import type { Dir4 } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { DRESSING } from '@/style/dressing';
import { lucky } from './lib';

const RULE = 'D11.doorstep';

interface Step {
  socket: string;
  steps: number;
  street: boolean;
  lit: boolean;
}

export default defineRule<Step>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 890,
  about: 'Reads: door features and sockets on houses, facades (street or plaza in front). Claims: the door socket.',
  find({ facts, plan }) {
    const all = facades(facts);
    const out: Candidate<Step>[] = [];
    for (const f of plan.features) {
      if (f.type !== 'door' || f.cell === undefined || f.dir === undefined) continue;
      if (f.variant === 'hatch' || f.variant === 'deck' || facts.kinds.get(f.cell) !== 'house') continue;
      const fc = all.at(f.cell, f.dir as Dir4);
      const steps = (f.params as { steps?: number } | undefined)?.steps ?? 0;
      // At ground level: the door's stoop reaches the ground outside (one storey of steps at most).
      if (!fc || fc.drop > 1 || (fc.drop === 1 && steps === 0)) continue;
      const socket = (plan.socketsByOwner.get(f.id) ?? []).find((s) => s.type === 'door');
      if (!socket) continue;
      const street = fc.street === 1 || fc.street === 2;
      out.push({ anchor: f.cell, structure: f.structure, key: f.id, data: { socket: socket.id, steps, street, lit: street || fc.plaza === 1 } });
    }
    return out;
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    const d = c.data;
    const k = c.key ?? 0;
    const roll = (name: string, p: number): 0 | 1 => (lucky(ctx.seed, RULE, c.anchor, `${k}:${name}`, p) ? 1 : 0);
    const house = c.structure === undefined ? undefined : ctx.plan.structures.get(c.structure);
    const step = out.prop({
      type: 'doorstep',
      at: { socket: d.socket },
      params: {
        steps: d.steps,
        pots: roll('pots', DRESSING.doorPots),
        barrel: roll('barrel', DRESSING.doorBarrel),
        bicycle: d.street ? roll('bicycle', DRESSING.doorBicycle) : 0,
        lantern: d.lit ? 1 : 0,
        flowers: hash(house?.seed ?? 1, 'flowers') % 5,
        look: hash(ctx.seed, RULE, c.anchor, k) % 1000,
      },
    });
    if (d.lit) out.socket({ type: 'lamp-head', owner: step, cell: c.anchor, structure: c.structure });
  },
});
