// The rest of the game on generator 2's islands (design section 6, "Terrain,
// second generation"): the town logic, the sea lane, and Grow a town, on a
// spread of seeds of every character, with and without rivers.

import { describe, expect, test, vi } from 'vitest';
import { SIZE_X, SIZE_Z } from '@/core/grid';
import { hash } from '@/core/rand';
import type { Terrain } from '@/core/world';
import { resolveShape, resolveTown } from '@/resolve/index';
import { computeLane, obstacleDistance } from '@/rules/life/sea-lanes.fact';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { generateIsland2, type IslandCharacter } from '@/terrain/terrain2';
import { growTown } from '@/townmaker/index';
import { applyEdit, emptyWorld, type World } from '@/world/world';
import { columnIndex, SEA_Y } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { createLife } from '@/life/runtime';
import { createSignals } from '@/life/signals';
import { recordingStage } from '@/life/testing/stage';
import { sized } from './helpers/tier';

vi.setConfig({ testTimeout: sized(60_000, 600_000) });

/** Five seeds of each character in the gate, ten in the full run (LC_FULL=1), and the rivers each has. */
const EACH = sized(5, 10);
function spread(): { seed: number; character: IslandCharacter; rivers: number }[] {
  const want: Record<IslandCharacter, number> = { gentle: EACH, hilly: EACH, steep: EACH, archipelago: EACH };
  const out: { seed: number; character: IslandCharacter; rivers: number }[] = [];
  for (let seed = 1; seed < 400 && out.length < EACH * 4; seed++) {
    const isl = generateIsland2(seed, (s) => generateTerrain(s, 1));
    if (want[isl.character] <= 0) continue;
    want[isl.character]--;
    out.push({ seed, character: isl.character, rivers: isl.rivers });
  }
  return out;
}
const SPREAD = spread();

function build(terrain: Terrain, edits: ReturnType<typeof growTown>): World {
  let w = emptyWorld(terrain.seed, 2);
  for (const e of edits) w = applyEdit(w, terrain, e); // throws on the first illegal edit
  return w;
}

describe('generator 2 islands in the rest of the game', () => {
  test('the spread has every character and both river counts', () => {
    expect(new Set(SPREAD.map((s) => s.character)).size).toBe(4);
    expect(SPREAD.some((s) => s.rivers === 0)).toBe(true);
    expect(SPREAD.some((s) => s.rivers > 0)).toBe(true);
  });

  test('the starting island resolves, and the sea lane circles the outside clear of land', () => {
    const kinds: string[] = [];
    for (const { seed, character } of SPREAD) {
      const t = generateTerrain(seed, 2);
      const w = initialWorld(seed, t, 2);
      const { shape } = resolveTown(w, t);
      const lane = computeLane(t, shape.kinds);
      kinds.push(`${seed} ${character}: ${lane.kind}`);
      for (let s = 0; s < lane.length; s += 0.5) {
        const p = lane.at(s);
        expect(p.x > 0 && p.x < SIZE_X && p.z > 0 && p.z < SIZE_Z).toBe(true);
        expect(obstacleDistance(t, shape.kinds, p.x, p.z), `seed ${seed}`).toBeGreaterThanOrEqual(2.8);
      }
    }
    expect(kinds.filter((k) => k.endsWith('loop')).length, kinds.join('\n')).toBeGreaterThanOrEqual(Math.floor(SPREAD.length * 0.85));
    // The rest sail a shuttle (an arc there and back): still a lane, never none.
    expect(kinds.filter((k) => k.endsWith('none'))).toEqual([]);
  });

  test('Grow a town never throws, every edit is legal, and the town resolves', () => {
    const sizes: string[] = [];
    for (const { seed, character } of SPREAD) {
      const t = generateTerrain(seed, 2);
      const edits = growTown(t, seed);
      const w = build(t, edits);
      expect(() => resolveShape(w, t), `seed ${seed}`).not.toThrow();
      sizes.push(`${seed} ${character}: ${w.blocks.size} blocks`);
    }
    // A town's worth everywhere; adapting the town generator to rivers and steep ground is still to do
    // (docs/swarm/requests/terrain2.md), so the bar is lower than generator 1's.
    for (const line of sizes) expect(Number(line.split(': ')[1]!.split(' ')[0]), line).toBeGreaterThan(100);
  });

  test('the dice in the browser test grows a full town on its generator-2 island', () => {
    // tests/e2e/grow-town.e2e.test.ts pins Date.now to 3 and Math.random to 0.5 (src/app/main.ts newSeed).
    const seed = hash(3, 'island', Math.floor(0.5 * 0x7fffffff)) | 0;
    const t = generateTerrain(seed, 2);
    expect(build(t, growTown(t, seed)).blocks.size).toBeGreaterThan(200);
  });

  // Half a minute of game time in the gate, a minute in the full run.
  test('life on grown towns of every character: a minute of boats and people, nothing thrown, boats afloat', () => {
    for (const character of ['gentle', 'hilly', 'steep', 'archipelago'] as const) {
      const { seed } = SPREAD.find((s) => s.character === character && s.rivers > 0) ?? SPREAD.find((s) => s.character === character)!;
      const t = generateTerrain(seed, 2);
      const w = build(t, growTown(t, seed));
      const { shape, dressing } = resolveTown(w, t);
      const rec = recordingStage({ shape, dressing });
      const signals = createSignals(seed);
      const life = createLife(rec.stage, signals);
      life.sync({ shape, dressing });
      const boats = dressing.actors.filter((a) => a.type === 'sailboat' || a.type === 'fishing-boat' || a.type === 'rowboat');
      for (let f = 0; f < 60 * sized(30, 60); f++) {
        life.update(signals.advance(1 / 60));
        if (f % 60) continue;
        for (const b of boats) {
          const r = rec.of(b.id);
          if (!r.visible) continue;
          const [x, y, z] = positionOf(r.matrix);
          expect([x, y, z].every(Number.isFinite), `${b.id} on seed ${seed}`).toBe(true);
          expect(Math.abs(y - SEA_Y), `${b.id} on seed ${seed}`).toBeLessThan(0.2);
          expect(t.height[columnIndex(Math.floor(x), Math.floor(z))], `${b.id} at ${x.toFixed(1)},${z.toFixed(1)} on seed ${seed}`).toBe(0);
        }
      }
      life.dispose();
    }
  });
});
