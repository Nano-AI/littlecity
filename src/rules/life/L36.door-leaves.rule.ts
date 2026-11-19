// L36 · Doors that open (design section 13, "Doors and thresholds"). One
// 'door-leaf' actor for every door: its leaf as its own instance, which life
// swings open as somebody reaches the threshold and closes after them
// (src/life/doors/door-leaf.behaviour.ts, driven by the crowd's door table
// src/life/people/doors.ts). While the part exists the door's own part and
// the monuments' tower door draw a dark doorway in place of the leaf, so
// every door must get one: tier 1.
//
// Also one per roof hatch the walking graph derived (a terrace no door opens
// onto): the frame and the lid, so people climb out of something.

import { defineRule } from '@/resolve/engine/api';
import { featuresOfType } from '@/resolve/facts/plan-index.fact';
import type { ActorVariant } from '@/core/vocab';
import { navOf } from './people.lib';

type Kind = ActorVariant<'door-leaf'>;
type Data = { socket: string; kind: Kind; steps: number; look: number } | { cell: number; kind: 'hatch'; look: number };

/** Which leaf a door feature has: monuments draw their own round-headed door (towerDoor). */
function kindOf(variant: string | undefined, structureKind: string, rule: string): Kind {
  if (structureKind === 'tower' || structureKind === 'lighthouse' || (structureKind === 'marble' && rule.startsWith('R-M'))) return 'tower';
  if (variant === 'double' || variant === 'shop' || variant === 'deck' || variant === 'hatch') return variant;
  return 'plain';
}

export default defineRule<Data>({
  id: 'L36.door-leaves',
  part: 'life',
  tier: 1,
  priority: 990,
  about: 'Reads: door features and their door sockets, hatches the walking graph derived. Emits: a door-leaf actor per door, which life swings open.',
  find(ctx) {
    const out = [];
    for (const f of featuresOfType(ctx.facts, 'door')) {
      const socket = (ctx.plan.socketsByOwner.get(f.id) ?? []).find((s) => s.type === 'door');
      const s = ctx.plan.structures.get(f.structure);
      if (!socket || !s) continue;
      const kind = kindOf(f.variant, s.kind, f.rule);
      out.push({ anchor: socket.cell, structure: f.structure, key: socket.id, data: { socket: socket.id, kind, steps: Math.max(0, Math.round(f.params?.steps ?? 0)), look: s.hash } as Data });
    }
    const nav = navOf(ctx);
    for (const d of nav?.doors ?? []) {
      if (!d.hatch || !d.feature.startsWith('hatch@')) continue;
      const s = ctx.plan.structures.get(d.structure);
      out.push({ anchor: d.cell, structure: d.structure, key: d.feature, data: { cell: d.cell, kind: 'hatch', look: s?.hash ?? 0 } as Data });
    }
    return out;
  },
  apply(c, out) {
    const d = c.data;
    if ('socket' in d) {
      out.actor({ type: 'door-leaf', variant: d.kind, at: { socket: d.socket }, home: c.structure, params: { steps: d.steps, look: d.look % 1e6 } });
    } else {
      out.actor({ type: 'door-leaf', variant: 'hatch', at: { cell: d.cell, pos: 'c' }, home: c.structure, params: { derived: 1, look: d.look % 1e6 } });
    }
  },
});
