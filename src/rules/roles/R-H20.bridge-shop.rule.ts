// R-H20 · tier 2 · Bridge shop (RC-05, the Ponte Vecchio). Houses standing on
// a bridge or viaduct are its shops:
//
//   a house whose lowest cells all stand on arch cells (the deck of a
//   bridge, a viaduct or a sky bridge);
//   the bridge they stand on (any run of that arch structure) carries a
//   floor somewhere on its deck, or meets a floor at one of its ends (the
//   deck is a street);
//   some cell of that deck beside the house is left free, so people pass
//   it (a house that fills the whole deck is a gate: not this rule).
//
// Draws: the shop's shopfront facing the deck (J06 gives it a shop door
// with its awning and sign sockets, J09 the shopfront windows; D07 hangs
// awning and sign), half-timbered walls on the cells over the arch (a
// 'jetty' feature each, as J27 marks a bracketed room), and timber struts
// under its walls where they overhang the drop (J30 'bridge-brackets').
// A shop type is picked as R-H07 picks one.
//
// Priority 9965: before the stilt house (9960), which would take a house
// over the water on a bridge for one standing on stilts.

import { above, below, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { ShopType } from '@/core/vocab';
import { defineRule } from '@/resolve/engine/api';
import { structureInfo } from '@/resolve/facts/structure.fact';
import type { Facts } from '@/resolve/facts/api';
import { distToDock } from '../joinery/houses.fact';
import { houseStructures } from '../joinery/houses.lib';
import { archRuns } from '../joinery/J15.arch-runs.fact';

const TYPES: readonly ShopType[] = ['bakery', 'cafe', 'books', 'flowers', 'fish', 'tailor', 'cheese', 'toys'];

/** The lowest cells of a house, if every one of them stands on an arch whose run is a street with room beside the house. */
export function onBridge(f: Facts, cells: readonly CellKey[]): CellKey[] | null {
  const runs = archRuns(f);
  const mine = new Set(cells);
  const minY = Math.min(...cells.map(keyY));
  const lowest = cells.filter((c) => keyY(c) === minY);
  if (lowest.length === 0) return null;
  let street = false, room = false;
  for (const c of lowest) {
    const under = below(c);
    const arch = under === NO_CELL ? undefined : runs.at(under);
    if (!arch) return null;
    // The whole bridge (every run of the arch structure: a deck two or more wide is several runs).
    for (const run of runs.byStructure.get(arch.run.structure) ?? []) {
      for (const a of run.cells) {
        const top = above(a);
        if (f.world.floors.has(top)) street = true;
        if (!mine.has(top) && !f.kinds.has(top)) room = true;
      }
      const lo = run.cells[0]!, hi = run.cells[run.cells.length - 1]!;
      for (const [end, d] of [[lo, run.axis === 'x' ? 3 : 0], [hi, run.axis === 'x' ? 1 : 2]] as [CellKey, Dir4][]) {
        const beyond = neighbor(above(end), d);
        if (beyond !== NO_CELL && f.world.floors.has(beyond)) street = true;
      }
    }
  }
  return street && room ? lowest : null;
}

export default defineRule<{ nearDock: boolean; lowest: CellKey[] }>({
  id: 'R-H20.bridge-shop',
  part: 'roles',
  tier: 2,
  priority: 9965,
  about: 'Reads: house structures, the arch runs under their lowest cells, floors on and at the ends of those decks, distToDock. Claims: the role. Emits: tag shop:<type>; a jetty feature on each lowest cell.',
  find(ctx) {
    const info = structureInfo(ctx.facts);
    const docks = distToDock(ctx.facts);
    const out = [];
    for (const s of houseStructures(ctx)) {
      if (ctx.plan.roles.has(s.id) || !info.has(s.id)) continue;
      const lowest = onBridge(ctx.facts, s.cells);
      if (!lowest) continue;
      out.push({ anchor: s.cells[0]!, structure: s.id, data: { nearDock: s.cells.some((c) => docks.at(keyX(c), keyZ(c)) <= 6), lowest } });
    }
    return out;
  },
  apply(c, out, ctx) {
    out.role(c.structure!, 'bridge-shop');
    const types = TYPES.filter((t) => t !== 'fish' || c.data.nearDock);
    out.tag(c.structure!, `shop:${ctx.pick(types, null, 'type')}`);
    for (const cell of c.data.lowest) out.feature({ type: 'jetty', structure: c.structure!, cell });
  },
});
