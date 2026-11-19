// Dressing as a whole (parts D and U): stability, restraint and cost.
// Where each rule fires and where it must not is its fixture's expect()
// (scenarios/rules/D*.scenario.ts, U*.scenario.ts); this file pins what no
// single fixture can.

import { describe, expect, test } from 'vitest';
import { keyX, keyZ } from '@/core/grid';
import { allRules } from '@/resolve/engine/discover';
import { resolveTown } from '@/resolve/index';
import type { DressingPlan, Prop, ShapePlan } from '@/resolve/plan';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { clearways } from './clearways.fact';

const SEED = 4242;

function town(build: (b: TownBuilder) => void, terrain = flatTerrain(SEED)): { shape: ShapePlan; dressing: DressingPlan } {
  const b = new TownBuilder(emptyWorld(SEED), terrain);
  build(b);
  return resolveTown(b.world, terrain);
}

/** A street with houses both sides, a square, an alley and front gardens: the west half of the map. */
function quarter(b: TownBuilder): void {
  b.path(6, 14, 20, 14);
  b.path(12, 15, 12, 20);
  b.plaza(14, 16, 18, 20);
  for (const [x, floors] of [[7, 2], [8, 1], [9, 2], [10, 1]] as const) b.house(x, 12, { floors, color: x % 8 });
  b.house(15, 13, { w: 2, floors: 2, color: 3 });
  b.house(7, 16, { w: 3, floors: 3, color: 1 });
  b.house(7, 18, { w: 3, floors: 3, color: 5 });
}

const anchorCell = (p: Prop): number => {
  if ('cell' in p.at) return p.at.cell;
  const m = /@(\d+)/.exec(p.id);
  return m ? Number(m[1]) : -1;
};
const inWest = (p: Prop): boolean => keyX(anchorCell(p)) <= 21;
const signature = (props: readonly Prop[], keep: (p: Prop) => boolean): string[] => props.filter(keep).map((p) => `${p.id} ${p.hash}`).sort();

describe('stability: props come only from seeded chance', () => {
  const base = town(quarter);

  test('building somewhere else changes no lamp, box, line, awning, garden or flag here', () => {
    const more = town((b) => {
      quarter(b);
      // A second quarter far to the east, with a taller house than anything in the first.
      b.path(30, 30, 40, 30).path(35, 31, 35, 36);
      b.house(31, 29, { floors: 2, color: 2 }).house(33, 29, { floors: 4, color: 4 }).house(38, 31, { w: 2, floors: 2, color: 6 });
      b.plaza(36, 32, 39, 35);
      b.put('tree', 30, 34).put('fountain', 37, 33);
    });
    // Wild ground thins out near new buildings by design, and town-wide rules (the pump goes when a
    // fountain is built anywhere; the viewpoint, the stork, the kite follow the whole town) may move;
    // everything else in the west is untouched.
    const townWide = new Set(['D13-T.tallest-flag', 'D14-T.stork-nest', 'D31.viewpoint', 'D33.hand-pump', 'D34.lost-kite']);
    const keep = (p: Prop): boolean => inWest(p) && p.rule !== 'D24.wild-ground' && !townWide.has(p.rule);
    expect(signature(more.dressing.props, keep)).toEqual(signature(base.dressing.props, keep));
    // And wild ground changes only near the new quarter.
    const wild = (p: Prop): boolean => p.rule === 'D24.wild-ground' && keyX(anchorCell(p)) <= 21 && keyZ(anchorCell(p)) <= 22;
    expect(signature(more.dressing.props, wild)).toEqual(signature(base.dressing.props, wild));
  });

  test('extending a street leaves the lamps along the rest of it where they were', () => {
    const longer = town((b) => {
      quarter(b);
      b.path(21, 14, 27, 14);
    });
    // The old dead end at x = 20 loses its lamp and the lattice fills in round it; a lamp's reach is
    // one spacing plus the gap (six cells), so everything west of x = 14 stays put.
    const lamps = (d: DressingPlan): string[] => signature(d.props, (p) => p.rule === 'D01.street-lamps' && keyX(anchorCell(p)) <= 13);
    expect(lamps(base.dressing).length).toBeGreaterThanOrEqual(2);
    expect(lamps(longer.dressing)).toEqual(lamps(base.dressing));
  });

  test('adding a storey to one house keeps the flower boxes of the others', () => {
    const taller = town((b) => {
      quarter(b);
      b.block('house', 8, 2, 12, { color: 0 });
    });
    const boxes = (d: DressingPlan): string[] => signature(d.props, (p) => p.rule === 'D09.flower-boxes' && keyX(anchorCell(p)) !== 8 && keyX(anchorCell(p)) !== 7 && keyX(anchorCell(p)) !== 9);
    expect(boxes(base.dressing).length).toBeGreaterThan(3);
    expect(boxes(taller.dressing)).toEqual(boxes(base.dressing));
  });

  test('the same town resolves to the same dressing', () => {
    expect(town(quarter).dressing.hash).toBe(base.dressing.hash);
  });
});

describe('restraint: nothing blocks a door, a stair or the walking line', () => {
  const hill = (): ReturnType<typeof town> => {
    const t = new TerrainBuilder(SEED).flat(1).rect(20, 8, 30, 14, 2);
    return town((b) => {
      quarter(b);
      b.path(21, 14, 25, 14).path(25, 15, 25, 18);
      b.house(23, 12, { floors: 2, color: 2 });
      b.stack('marble', 27, 17, { floors: 1 });
      b.block('stairs', 26, 1, 17, { rot: 1 });
    }, t.build());
  };

  test('no prop stands on a slot that is walked, and no two props share a floor slot', () => {
    for (const t of [town(quarter), hill()]) {
      const clear = clearways(t.shape.facts);
      const seen = new Set<string>();
      for (const p of t.dressing.props) {
        if (!('cell' in p.at)) continue;
        // A retaining wall and a garden fence stand ON an edge by design; nothing else may be on a walked slot.
        if (p.type !== 'retaining-wall' && p.type !== 'garden-fence' && p.type !== 'flower-bed') {
          expect(clear.walked(p.at.cell, p.at.pos), `${p.id} on a walking line`).toBe(false);
        }
        if (p.type === 'garden-fence') continue; // it stands on the cell line, outside the bed that has the slot
        const k = `${p.at.cell}:${p.at.pos}`;
        expect(seen.has(k), `two props on ${k} (${p.id})`).toBe(false);
        seen.add(k);
      }
    }
  });

  test('no floor-slot prop stands in a cell that holds a block', () => {
    const t = town(quarter);
    for (const p of t.dressing.props) {
      if ('cell' in p.at) expect(t.shape.kinds.has(p.at.cell), `${p.id} inside a block`).toBe(false);
    }
  });

  test('the cell in front of every door keeps its centre and its door side clear', () => {
    const t = town(quarter);
    const clear = clearways(t.shape.facts);
    expect(clear.doorFronts.size).toBeGreaterThan(4);
    for (const [cell, sides] of clear.doorFronts) {
      const here = t.dressing.props.filter((p) => 'cell' in p.at && p.at.cell === cell && p.type !== 'garden-fence' && p.type !== 'flower-bed');
      for (const p of here) {
        const pos = (p.at as { pos: string }).pos;
        expect(pos, `${p.id} in a doorway`).not.toBe('c');
        for (const d of sides) expect(pos.includes('nesw'[d]!), `${p.id} on the door side`).toBe(false);
      }
    }
  });
});

describe('the rules themselves', () => {
  test('every decoration and urban rule says what it reads and claims, and follows the priority convention', () => {
    const mine = allRules().filter((r) => (r.part === 'decoration' || r.part === 'urban') && /^[DU]\d/.test(r.id));
    expect(mine.length).toBeGreaterThanOrEqual(10);
    for (const r of mine) {
      expect(r.about, r.id).toMatch(/Reads: .*Claims: /s);
      expect(r.priority, r.id).toBeGreaterThan(600);
      expect(r.priority, r.id).toBeLessThanOrEqual(1000);
      const n = Number(/^[DU](\d+)/.exec(r.id)?.[1]);
      expect(Math.abs(r.priority - (1000 - n * 10)), `${r.id} priority`).toBeLessThanOrEqual(5);
    }
  });

  test('only the town-wide rule depends on the whole town', () => {
    const wide = allRules().filter((r) => (r.part === 'decoration' || r.part === 'urban') && /^[DU]\d/.test(r.id) && r.townWide).map((r) => r.id);
    for (const id of wide) expect(id).toMatch(/-T\.|D12|D14|D31|D33|D34/);
  });
});
