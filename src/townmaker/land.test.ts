// Grow a town on a reshaped island (shaping the land): the town maker reads
// the island as the player left it, so every edit it makes is legal there and
// nothing is built inside a raised hill or on a dug river but what may stand
// on water.

import { describe, expect, test } from 'vitest';
import { columnIndex, keyX, keyY, keyZ } from '@/core/grid';
import type { Edit } from '@/core/world';
import { islandOf } from '@/terrain/land';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { applyEdit, canApply } from '@/world/world';
import { growTown } from './index';

describe('Grow a town on reshaped land', () => {
  test('a river dug across the island and a hill raised: every grown edit is legal on the island as it is', () => {
    const seed = 3;
    const base = generateTerrain(seed, 2);
    let w = initialWorld(seed, base, 2);
    const dig: number[] = [];
    for (let x = 6; x < 42; x++) dig.push(columnIndex(x, 24));
    for (let pass = 0; pass < 6; pass++) {
      const e: Edit = { type: 'land', up: [], down: dig };
      if (canApply(w, base, e).ok) w = applyEdit(w, base, e);
    }
    const hill: number[] = [];
    for (let z = 14; z <= 17; z++) for (let x = 20; x <= 23; x++) hill.push(columnIndex(x, z));
    for (let pass = 0; pass < 3; pass++) {
      const e: Edit = { type: 'land', up: hill, down: [] };
      if (canApply(w, base, e).ok) w = applyEdit(w, base, e);
    }
    const t = islandOf(w, base);
    let river = 0;
    for (let x = 6; x < 42; x++) if (t.height[columnIndex(x, 24)] === 0) river++;
    expect(river).toBeGreaterThan(30);

    const edits = growTown(t, seed);
    expect(edits.length).toBeGreaterThan(40);
    // Grow a town clears the island first (src/ui/growth.ts), then plays the edits.
    let grown = w;
    for (const cell of [...w.blocks.keys()]) grown = applyEdit(grown, base, { type: 'eraseBlock', cell });
    for (const e of edits) {
      const v = canApply(grown, base, e);
      expect(v.ok, `${JSON.stringify(e)}: ${v.ok ? '' : v.reason}`).toBe(true);
      grown = applyEdit(grown, base, e);
    }
    expect(grown.terrainEdits).toBe(w.terrainEdits);
    // Nothing on the dug river but what may stand in water.
    for (const [c, b] of grown.blocks) {
      if (keyZ(c) !== 24 || keyX(c) < 6 || keyX(c) >= 42 || keyY(c) !== 0 || t.height[columnIndex(keyX(c), 24)] !== 0) continue;
      expect(['dock', 'arch', 'auto', 'marble', 'pillar', 'house', 'tower']).toContain(b.kind);
    }
  });
});
