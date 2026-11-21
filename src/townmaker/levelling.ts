// Building the site: when no flat ground is big enough for a district that
// needs it (the marble city's forum, a castle), the planner levels a
// terrace for it, as real builders do, with the game's own land edit
// (src/world/land.ts): columns raised or dug one level per edit, at most
// two levels anywhere, never on or beside water, never at the map's edge,
// on an empty island (Grow a town clears it first). The steps it leaves at
// the terrace's edge are what the retaining-wall rule (U07) faces with
// stone where streets pass.
//
// The edits are ordinary, saved with the town (World.terrainEdits), and part
// of the growth's one undo step.

import { columnIndex, SIZE_X, SIZE_Z } from '@/core/grid';
import type { Edit, Terrain, World } from '@/core/world';
import { editsOf, islandOf, landEditable } from '@/terrain/land';
import { applyEdit, canApply, emptyWorld } from '@/world/world';
import type { Site } from './site';

export interface Levelled {
  /** The land edits, in order. */
  edits: Edit[];
  /** The island they make. */
  terrain: Terrain;
  /** Column-levels moved in all. */
  cost: number;
  /** The levelled rectangle (world columns, inclusive) and its height. */
  rect: [number, number, number, number];
  height: number;
}

/**
 * The cheapest w × d (or d × w) rectangle to level, within `maxDelta` of its
 * target height everywhere, every column land (with a ring of land round it
 * unless `tight`); and
 * the edits that level it. `near` breaks ties toward a point. Null when no
 * rectangle qualifies or the cost passes `maxCost`.
 */
export function levelSite(
  terrain: Terrain,
  site: Site,
  w: number,
  d: number,
  near: readonly [number, number],
  opts: { maxDelta?: number; maxCost?: number; minHeight?: number; tight?: boolean } = {},
): Levelled | null {
  const maxDelta = opts.maxDelta ?? 2;
  const maxCost = opts.maxCost ?? w * d;
  const minHeight = opts.minHeight ?? 1;
  const tight = opts.tight ?? false;
  let best: { x0: number; z0: number; ww: number; dd: number; t: number; cost: number; score: number } | null = null;
  for (const [ww, dd] of w === d ? [[w, d]] : [[w, d], [d, w]]) {
    for (let z0 = 1; z0 + dd < SIZE_Z - 1; z0++) {
      for (let x0 = 1; x0 + ww < SIZE_X - 1; x0++) {
        let lo = 99, hi = 0, sum = 0, ok = true;
        for (let z = z0 - 1; z <= z0 + dd && ok; z++) {
          for (let x = x0 - 1; x <= x0 + ww && ok; x++) {
            const i = columnIndex(x, z);
            const inside = x >= x0 && x < x0 + ww && z >= z0 && z < z0 + dd;
            // The rectangle on land the editor may shape; a ring of land round it unless `tight` (then the
            // terrace may come right to the shore).
            if (inside && (terrain.height[i] === 0 || !landEditable(x, z))) ok = false;
            if (!inside && !tight && (terrain.height[i] === 0 || site.waterDist[i]! < 1)) ok = false;
            if (!inside) continue;
            const h = terrain.height[i]!;
            lo = Math.min(lo, h);
            hi = Math.max(hi, h);
            sum += h;
          }
        }
        if (!ok || hi - lo > maxDelta * 2) continue;
        const t = Math.max(minHeight, Math.round(sum / (ww * dd)));
        if (hi - t > maxDelta || t - lo > maxDelta) continue;
        let cost = 0;
        for (let z = z0; z < z0 + dd; z++) for (let x = x0; x < x0 + ww; x++) cost += Math.abs(terrain.height[columnIndex(x, z)]! - t);
        if (cost > maxCost) continue;
        const cx = x0 + ww / 2, cz = z0 + dd / 2;
        const score = cost + (Math.abs(cx - near[0]) + Math.abs(cz - near[1])) * 1.5;
        if (!best || score < best.score) best = { x0, z0, ww, dd, t, cost, score };
      }
    }
  }
  if (!best) return null;
  // The edits: each moves every column still off the target one level toward it.
  let world: World = emptyWorld(terrain.seed);
  const prior = editsOf(terrain);
  if (prior) world = { ...world, terrainEdits: prior };
  const edits: Edit[] = [];
  for (let pass = 0; pass < maxDelta; pass++) {
    const now = islandOf(world, terrain);
    const up: number[] = [], down: number[] = [];
    for (let z = best.z0; z < best.z0 + best.dd; z++) {
      for (let x = best.x0; x < best.x0 + best.ww; x++) {
        const i = columnIndex(x, z);
        if (now.height[i]! < best.t) up.push(i);
        else if (now.height[i]! > best.t) down.push(i);
      }
    }
    if (up.length === 0 && down.length === 0) break;
    const e: Edit = { type: 'land', up, down };
    if (!canApply(world, terrain, e).ok) return null;
    world = applyEdit(world, terrain, e);
    edits.push(e);
  }
  const levelled = islandOf(world, terrain);
  for (let z = best.z0; z < best.z0 + best.dd; z++) {
    for (let x = best.x0; x < best.x0 + best.ww; x++) if (levelled.height[columnIndex(x, z)] !== best.t) return null;
  }
  return { edits, terrain: levelled, cost: best.cost, rect: [best.x0, best.z0, best.x0 + best.ww - 1, best.z0 + best.dd - 1], height: best.t };
}
