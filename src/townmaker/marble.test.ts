// The marble city on nearly every island: where no flat ground is big
// enough for its forum, the planner levels a terrace for it with land edits.
// Those edits are part of the town: legal in order, saved with it, undone
// with the growth.

import { describe, expect, test } from 'vitest';
import { columnIndex } from '@/core/grid';
import { islandOf } from '@/terrain/land';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { applyEdit, canApply } from '@/world/world';
import { createHistory, pushHistory, undo } from '@/world/history';
import { decodeTown, encodeTown } from '@/world/save';
import { planKind } from './kinds';
import { sized } from '../../tests/helpers/tier';

describe('a marble city on nearly every island', () => {
  test('generator 2: offered on all but the islands with no room at all for its compact forum', () => {
    const refused: number[] = [];
    let levelled = 0;
    const lines: string[] = [];
    for (const [gen, last] of [[2, sized(16, 40)], [1, sized(6, 30)]] as const) {
      for (let seed = 1; seed <= last; seed++) {
        const t = generateTerrain(seed, gen);
        const p = planKind(t, seed, 'marble');
        if (!p) {
          if (gen === 2) refused.push(seed);
          lines.push(`g${gen} s${seed}: refused`);
          continue;
        }
        if (p.levelled > 0) levelled++;
        let marble = 0;
        let w = initialWorld(seed, t, gen);
        for (const cell of [...w.blocks.keys()]) w = applyEdit(w, t, { type: 'eraseBlock', cell });
        for (const e of p.edits) w = applyEdit(w, t, e);
        for (const b of w.blocks.values()) if (b.kind === 'marble' || b.kind === 'pillar') marble++;
        lines.push(`g${gen} s${seed}: forum ${p.forum}${p.levelled ? `, levelled ${p.levelled} column-levels` : ''}, marble and pillars ${marble}`);
      }
    }
    console.log(`marble cities:\n${lines.join('\n')}`);
    // Seed 18 is a ring of land round a lagoon: no 9 × 12 of land anywhere.
    expect(refused.filter((s) => s !== 18)).toEqual([]);
    expect(levelled).toBeGreaterThan(0);
  });

  test('a levelled forum: the land edits are legal in order, saved with the town, and one undo takes them back', () => {
    const seed = 4; // flat ground 9 at most: the forum is levelled
    const base = generateTerrain(seed, 2);
    const plan = planKind(base, seed, 'marble')!;
    expect(plan.levelled).toBeGreaterThan(0);
    expect(plan.edits[0]!.type).toBe('land');
    const start = initialWorld(seed, base, 2);
    let h = createHistory(start);
    // Grow a town clears the island first, then plays the edits as one step.
    let w = start;
    for (const cell of [...w.blocks.keys()]) w = applyEdit(w, base, { type: 'eraseBlock', cell });
    for (const e of plan.edits) {
      const v = canApply(w, base, e);
      expect(v.ok, v.ok ? '' : v.reason).toBe(true);
      w = applyEdit(w, base, e);
    }
    h = pushHistory(h, w);
    expect(w.terrainEdits?.size).toBeGreaterThan(0);
    // The share code keeps the reshaped ground.
    const back = decodeTown(encodeTown(w));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect([...(back.world.terrainEdits ?? new Map())]).toEqual([...w.terrainEdits!]);
      const a = islandOf(w, base), b = islandOf(back.world, base);
      for (let i = 0; i < 48 * 48; i++) expect(b.height[i]).toBe(a.height[i]);
    }
    // One undo: the island as it was.
    h = undo(h);
    expect(h.present.terrainEdits?.size ?? 0).toBe(0);
    expect(islandOf(h.present, base).height[columnIndex(24, 24)]).toBe(base.height[columnIndex(24, 24)]);
  });
});
