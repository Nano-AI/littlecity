// The Node half of src/render/testing/land-bench.mjs (shaping the land): town
// logic after one raise or dig on the 2,000-block town, and the terrain
// chunks one edit rebuilds, timed, on a steep island and on the bench town.

import { allChunks } from '@/core/grid';
import type { Edit, Terrain, World } from '@/core/world';
import { buildTerrainChunk, terrainLayer } from '@/gen/terrain/terrain.gen';
import { resolveShape } from '@/resolve/index';
import type { ShapePlan } from '@/resolve/plan';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { generateIsland2 } from '@/terrain/terrain2';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { randomLandEdit } from '@/world/land-edits';
import { applyEdit } from '@/world/world';
import { createStagedResolver } from '@/resolve/staged';

export interface LandBench {
  /** The slowest shape rules after a land edit, mean ms. */
  slowest: string[];
  blocks: number;
  /** Warm (as the app runs it): resolveShape after one land edit, and dressing. */
  shapeMs: number[];
  dressingMs: number[];
  /** Terrain chunks rebuilt per edit (hash changed), and the time to build them. */
  chunks: number[];
  chunkMs: number[];
  /** A steep island: every chunk built once, the slowest. */
  steepSeed: number;
  steepChunkMs: number[];
}

const now = (): number => performance.now();

function rebuilt(prev: ShapePlan, next: ShapePlan): { n: number; ms: number } {
  let n = 0, ms = 0;
  for (const c of allChunks()) {
    if (terrainLayer.hash(c, prev) === terrainLayer.hash(c, next)) continue;
    n++;
    const a = now();
    terrainLayer.build(c, next, undefined as never);
    ms += now() - a;
  }
  return { n, ms };
}

export function main(runs = 30): LandBench {
  const scn = findScenario('bench-2000')!;
  const built = buildScenario(scn);
  const opts = scenarioResolveOptions(scn);
  const base: Terrain = built.terrain;
  let world: World = built.world;
  const resolver = createStagedResolver(base, { ...opts, clock: now });
  let prev = resolver.update(world);
  resolver.poll();
  const ruleMs = new Map<string, number>();
  const shapeMs: number[] = [], dressingMs: number[] = [], chunks: number[] = [], chunkMs: number[] = [];
  for (let i = 0; i < runs + 5; i++) {
    // A single dab, brush 1, in the town: raise or dig.
    let e: Edit | null = null;
    for (let k = 0; k < 20 && !e; k++) {
      const cand = randomLandEdit(world, base, 91, i * 20 + k);
      if (cand && cand.type === 'land' && cand.up.length + cand.down.length === 1) e = cand;
    }
    if (!e) continue;
    world = applyEdit(world, base, e);
    const a = now();
    const shape = resolver.update(world);
    if (i >= 5) for (const t of shape.trace) ruleMs.set(t.rule, (ruleMs.get(t.rule) ?? 0) + (t.ms ?? 0));
    const b = now();
    resolver.poll();
    const c = now();
    const r = rebuilt(prev, shape);
    prev = shape;
    if (i < 5) continue; // warm-up
    shapeMs.push(b - a);
    dressingMs.push(c - b);
    chunks.push(r.n);
    chunkMs.push(r.ms);
  }
  // The steep island: the slowest chunk to build.
  let steepSeed = 5;
  for (let s = 1; s < 60; s++) if (generateIsland2(s, (x) => generateTerrain(x, 1)).character === 'steep') { steepSeed = s; break; }
  const t = generateTerrain(steepSeed, 2);
  const w = initialWorld(steepSeed, t, 2);
  const plan = resolveShape(w, t);
  const steepChunkMs: number[] = [];
  for (let k = 0; k < 3; k++) {
    for (const ch of allChunks()) {
      const a = now();
      buildTerrainChunk(ch, plan).build();
      if (k === 2) steepChunkMs.push(now() - a);
    }
  }
  const slowest = [...ruleMs].sort((p, q) => q[1] - p[1]).slice(0, 10).map(([r, ms]) => `${r} ${(ms / runs).toFixed(2)}`);
  return { slowest, blocks: world.blocks.size, shapeMs, dressingMs, chunks, chunkMs, steepSeed, steepChunkMs };
}
