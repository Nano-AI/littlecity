// Shared by the people rules (L21–L28, L32). Not a rule file.

import { DIR4, keyX, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import type { RuleContext } from '@/resolve/engine/api';
import { usableDoors } from '@/resolve/nav';
import type { NavDoor, NavGraph, Structure } from '@/resolve/plan';

/** The walking graph, or null in a town that has none yet. */
export function navOf(ctx: RuleContext): NavGraph | null {
  const nav = ctx.dressing?.nav ?? null;
  return nav && nav.nodes.length > 0 ? nav : null;
}

/** House structures in the order they were first placed (a structure's id is its lowest `seq`). */
export function homes(ctx: RuleContext): Structure[] {
  return [...ctx.facts.structures.values()].filter((s) => s.kind === 'house' && s.cells.length > 0).sort((a, b) => a.id - b.id);
}

/** The door a household uses: its main door if that opens onto the graph, else any door that does. */
export function frontDoor(nav: NavGraph | null, structure: number): NavDoor | null {
  return nav ? (usableDoors(nav, structure)[0] ?? null) : null;
}

/** Column steps between two cells. */
export function steps(a: CellKey, b: CellKey): number {
  return Math.abs(keyX(a) - keyX(b)) + Math.abs(keyZ(a) - keyZ(b));
}

/** The side of `from` that faces `to` most directly. */
export function toward(from: CellKey, to: CellKey): Dir4 {
  const dx = keyX(to) - keyX(from), dz = keyZ(to) - keyZ(from);
  let best: Dir4 = 0;
  let score = -Infinity;
  for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
    const s = dx * DIR4[d]![0] + dz * DIR4[d]![1];
    if (s > score) {
      score = s;
      best = d;
    }
  }
  return best;
}
