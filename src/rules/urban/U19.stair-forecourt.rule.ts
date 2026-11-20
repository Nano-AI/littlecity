// U19 · tier 2 · Forecourt at the foot of grand steps (discovery round 1, UF-10).
//
// A monumental stair never ends in grass: it lands on a paved forecourt. The
// cells a flight of grand steps (R-M04) descends onto, the full width of its
// bottom row and two deep, are paved with stone slabs where they are bare
// ground (grass or sand with nothing on it and no other use). Where a street
// lies straight ahead within 4 of the forecourt, the paving runs on to meet
// it, the width of the flight.
// Must not: water, a block, a floor (a path or a plaza is paved already),
// ground with another use (a garden, a green, a field), or a cell lower or
// higher than the stair's foot.
//
// Stability: depends only on the flight and the few cells in front of it.
//
// Reads: flights, wildGrass, landUse, streets. Claims: a 'paving' slot per
// paved cell (the paving lies at a corner slot and claims no floor slot).

import { keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { DIRS, openWater } from '@/resolve/facts/lib';
import type { Slot } from '@/resolve/plan';
import { flights } from '../decoration/flights.fact';
import { heightAt } from '../decoration/lib';
import { landUse } from './land-use.fact';
import { emit, type Placed } from './plots';

const RULE = 'U19.stair-forecourt';
const DEPTH = 2;
const REACH = 4;

export default defineRule<{ items: Placed[]; cells: CellKey[] }>({
  id: RULE,
  part: 'urban',
  tier: 2,
  priority: 810,
  about: 'Reads: flights of grand steps, terrain, landUse, streets. Claims: a paving slot per paved cell in front of a flight.',
  find({ facts }) {
    const uses = landUse(facts);
    const out: Candidate<{ items: Placed[]; cells: CellKey[] }>[] = [];
    const bare = (c: CellKey, y: number): boolean => {
      if (c === NO_CELL || keyY(c) !== y) return false;
      const x = keyX(c), z = keyZ(c);
      if (openWater(facts, x, z) || heightAt(facts, x, z) !== y) return false;
      return !facts.kinds.has(c) && !facts.world.floors.has(c) && !uses.byCell.has(c);
    };
    for (const f of flights(facts).list) {
      const cells: CellKey[] = [];
      for (const b of f.bottom) {
        const y = keyY(b);
        let c = b;
        for (let k = 0; k < DEPTH; k++) {
          c = neighbor(c, f.dir);
          if (!bare(c, y)) break;
          cells.push(c);
        }
      }
      if (!cells.length) continue;
      // A way on to a street straight ahead, within REACH, all of it bare.
      const way: CellKey[] = [];
      for (const b of f.bottom) {
        const run: CellKey[] = [];
        let c = b;
        for (let k = 0; k < DEPTH; k++) c = neighbor(c, f.dir);
        let met = false;
        for (let k = 0; k < REACH && c !== NO_CELL; k++) {
          c = neighbor(c, f.dir);
          if (c === NO_CELL) break;
          if (facts.world.floors.get(c) === 'path' || facts.world.floors.get(c) === 'plaza') {
            met = true;
            break;
          }
          if (!bare(c, keyY(b))) break;
          run.push(c);
        }
        if (met) way.push(...run);
      }
      const all = [...new Set([...cells, ...way])].sort((a, b) => a - b);
      const set = new Set(all);
      const items: Placed[] = all.map((c) => {
        let mask = 0;
        for (const d of DIRS) if (set.has(neighbor(c, d))) mask |= 1 << d;
        return { type: 'paving', variant: 'slabs', cell: c, pos: 'nw', face: 2, claim: false, params: { mask } };
      });
      out.push({ anchor: f.cells[0]!, data: { items, cells: all } });
    }
    return out;
  },
  claims: (c): Slot[] => c.data.cells.map((cell) => slot.custom('paving', cell)),
  apply: (c, out) => emit(out, c.data.items),
});
