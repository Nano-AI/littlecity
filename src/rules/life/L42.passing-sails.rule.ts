// L42 · tier 3 · Passing sails (town-wide). Any lighthouse → far out, beyond
// where the small boats sail, a tall ship crosses the horizon once in a
// while without calling.
//
// "Far out" on this map is a line close along one edge, where a whole hull
// fits all the way across (the side most open to the sea is tried first).
// The rule names the line; the harbour system sails it (visit.ts): the ship
// comes up out of the distance at one end and goes down into it at the
// other, and never while a ship is coming in or going out.

import { key, SIZE_X, SIZE_Z } from '@/core/grid';
import { hash } from '@/core/rand';
import { defineRule } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { townFacts } from '@/resolve/facts/town.fact';
import { hullSize } from './berths.fact';
import { hullClear, obstacleColumns, seaField } from './ship-routes';
import { SHIP_LOOKS } from './ships.lib';

export interface PassingLine {
  x: number;
  z: number;
  x2: number;
  z2: number;
}

/** The line a tall ship crosses along, or null if no edge has room. Pure. */
export function passingLine(f: Facts): PassingLine | null {
  const field = seaField(obstacleColumns(f.terrain, f.kinds));
  const h = hullSize('galleon');
  const lines: (PassingLine & { room: number })[] = [];
  for (const inset of [2.3, 3.2]) {
    const lo = 1, hiX = SIZE_X - 1, hiZ = SIZE_Z - 1;
    const cand: PassingLine[] = [
      { x: lo, z: inset, x2: hiX, z2: inset },
      { x: SIZE_X - inset, z: lo, x2: SIZE_X - inset, z2: hiZ },
      { x: hiX, z: SIZE_Z - inset, x2: lo, z2: SIZE_Z - inset },
      { x: inset, z: hiZ, x2: inset, z2: lo },
    ];
    for (const c of cand) {
      const len = Math.hypot(c.x2 - c.x, c.z2 - c.z);
      const yaw = Math.atan2(c.x2 - c.x, c.z2 - c.z);
      let ok = true, room = Infinity;
      // Only the stretch inside the map counts: the ends are where it rises and sinks.
      for (let s = 4; s <= len - 4 && ok; s += 0.5) {
        const x = c.x + ((c.x2 - c.x) * s) / len, z = c.z + ((c.z2 - c.z) * s) / len;
        ok = hullClear(field, h, x, z, yaw, 0.4);
        room = Math.min(room, field.at(x, z));
      }
      if (ok) lines.push({ ...c, room });
    }
    if (lines.length) break;
  }
  if (!lines.length) return null;
  lines.sort((a, b) => b.room - a.room || a.x + a.z - b.x - b.z);
  const { x, z, x2, z2 } = lines[0]!;
  return { x, z, x2, z2 };
}

export default defineRule<PassingLine>({
  id: 'L42.passing-sails',
  part: 'life',
  tier: 3,
  priority: 580,
  townWide: true,
  about: 'Reads: lighthouses; the open sea along the edges of the map. Emits: one ship-call (passing) with the line it crosses on.',
  find({ facts }) {
    if ((townFacts(facts).structuresByKind.get('lighthouse') ?? 0) === 0) return [];
    const line = passingLine(facts);
    return line ? [{ anchor: key(0, 0, 0), key: 'passing', data: line }] : [];
  },
  apply(c, out, ctx) {
    const d = c.data;
    out.actor({ type: 'ship-call', variant: 'passing', at: null, params: { look: hash(ctx.seed, 'L42', 'look') % SHIP_LOOKS, x: d.x, z: d.z, x2: d.x2, z2: d.z2 } });
  },
});
