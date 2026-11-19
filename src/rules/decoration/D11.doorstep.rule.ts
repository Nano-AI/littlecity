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
// Reads: door features and their sockets, facades (what the door faces),
// the role props R-H99 placed at the door.
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
  /** R-H99 already put this role's things at the door: only the mat from here. */
  busy: boolean;
}

export default defineRule<Step>({
  id: RULE,
  part: 'decoration',
  tier: 2,
  priority: 890,
  about: 'Reads: door features and sockets on houses, facades (street or plaza in front). Claims: the door socket.',
  find({ facts, plan, dressing }) {
    const all = facades(facts);
    const out: Candidate<Step>[] = [];
    // A house whose role already dressed its door (R-H99: an inn's lantern, a mill's sacks and cart,
    // a lookout's telescope, a boathouse's slipway) keeps that.
    const role = new Map<number, string[]>();
    for (const p of dressing?.props ?? []) {
      if (p.type !== 'role-prop') continue;
      const cell = Number(/@(\d+):/.exec(p.id)?.[1] ?? -1);
      role.set(cell, [...(role.get(cell) ?? []), p.variant ?? '']);
    }
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
      const there = role.get(f.cell) ?? [];
      const busy = there.some((v) => v !== 'lantern' && v !== 'net');
      out.push({ anchor: f.cell, structure: f.structure, key: f.id, data: { socket: socket.id, steps, street, lit: (street || fc.plaza === 1) && !there.includes('lantern'), busy } });
    }
    return out;
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    const d = c.data;
    const k = c.key ?? 0;
    const roll = (name: string, p: number): 0 | 1 => (lucky(ctx.seed, RULE, c.anchor, `${k}:${name}`, p) ? 1 : 0);
    const house = c.structure === undefined ? undefined : ctx.plan.structures.get(c.structure);
    const { busy, lit } = d;
    const step = out.prop({
      type: 'doorstep',
      at: { socket: d.socket },
      params: {
        steps: d.steps,
        pots: busy ? 0 : roll('pots', DRESSING.doorPots),
        barrel: busy ? 0 : roll('barrel', DRESSING.doorBarrel),
        bicycle: d.street && !busy ? roll('bicycle', DRESSING.doorBicycle) : 0,
        lantern: lit ? 1 : 0,
        flowers: hash(house?.seed ?? 1, 'flowers') % 5,
        look: hash(ctx.seed, RULE, c.anchor, k) % 1000,
      },
    });
    if (lit) out.socket({ type: 'lamp-head', owner: step, cell: c.anchor, structure: c.structure });
  },
});
