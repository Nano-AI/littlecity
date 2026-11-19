// D13-T · tier 1 · The tallest structure flies a flag. Town-wide: which
// structure is tallest depends on the whole town, so a far-away edit may
// move this one flag (and only this one; it is a rule of its own so that
// D13's other flags never depend on the rest of the town).
//
// The flag goes on the highest 'flag-mount' socket of the structure that
// reaches highest, if it has one (towers and lighthouses do) and D13 has not
// already put a flag there.
//
// Reads: townFacts.tallest, flag-mount sockets. Claims: the socket.

import { keyY } from '@/core/grid';
import { defineRule, slot } from '@/resolve/engine/api';
import { socketsOfType } from '@/resolve/facts/plan-index.fact';
import { townFacts } from '@/resolve/facts/town.fact';
import { townColor } from './lib';

export default defineRule<{ socket: string; banner: boolean }>({
  id: 'D13-T.tallest-flag',
  part: 'decoration',
  tier: 1,
  priority: 865,
  townWide: true,
  about: 'Town-wide. Reads: townFacts.tallest, flag-mount sockets, roles. Claims: the socket.',
  find({ facts, plan }) {
    const tallest = townFacts(facts).tallest;
    if (!tallest || tallest.top < 3) return [];
    const mounts = socketsOfType(facts, 'flag-mount').filter((s) => s.structure === tallest.id);
    if (!mounts.length) return [];
    const top = mounts.reduce((a, b) => (keyY(b.cell) > keyY(a.cell) ? b : a));
    return [{ anchor: top.cell, structure: tallest.id, key: top.id, data: { socket: top.id, banner: plan.roles.get(tallest.id)?.role === 'castle-turret' } }];
  },
  claims: (c) => [slot.socket(c.data.socket)],
  apply(c, out, ctx) {
    out.prop({ type: 'flag', variant: c.data.banner ? 'banner' : 'pennant', at: { socket: c.data.socket }, params: { color: townColor(ctx.seed), look: Math.floor(ctx.rand('look') * 100) } });
  },
});
