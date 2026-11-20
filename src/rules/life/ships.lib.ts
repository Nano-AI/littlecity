// Shared by the big-ship rules (L38–L40): what a call says, and the places
// on the quay where residents come to watch a ship in. Not a rule file.

import { DIR4, key, type CellKey } from '@/core/grid';
import { hash } from '@/core/rand';
import type { ApplyContext, Candidate, RuleOut } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { harbour, type BigShip, type ShipPlan } from './berths.fact';

/** Liveries × figureheads × sails: the looks a ship can have. */
export const SHIP_LOOKS = 48;

/** The candidates for a ship kind: one at every berth it fits (berths.fact.ts), at the berth's first quay cell. */
export function shipCandidates(facts: Facts, ship: BigShip): Candidate<ShipPlan>[] {
  return harbour(facts)
    .plans.filter((p) => p.ship === ship)
    .map((plan) => ({ anchor: key(plan.berth.x, 0, plan.berth.z) as CellKey, key: `${ship}:${plan.berth.key}`, data: plan }));
}

/** Emits the call and, every other cell along the berth, a place to stand and watch (dir: toward the water). */
export function emitCall(ship: BigShip, rule: string, c: Candidate<ShipPlan>, out: RuleOut, ctx: ApplyContext): void {
  const b = c.data.berth;
  const id = out.actor({
    type: 'ship-call',
    variant: ship,
    at: null,
    params: { look: hash(ctx.seed, rule, 'look') % SHIP_LOOKS, x: b.x, z: b.z, along: b.along, cells: b.cells, out: b.out, dir: c.data.dir },
  });
  const [ax, az] = DIR4[b.along]!;
  const mid = Math.floor(b.cells / 2);
  for (let i = 0; i < b.cells; i++) {
    // Not where the gangplank comes down (the middle), and not on every cell.
    if (i % 2 === 1 || Math.abs(i - mid) <= 1) continue;
    out.socket({ type: 'haunt-ship', owner: id, name: `watch${i}`, cell: key(b.x + ax * i, b.level, b.z + az * i), dir: b.out });
  }
}
