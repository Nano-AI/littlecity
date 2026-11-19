// Held length (design section 7, "Held length"). Owner: Interface. Pure.
//
// Pieces that usually come in runs can be stretched before they are placed:
// pillars, towers and lighthouses grow straight up; fences, walls, floors,
// docks, arches and marble grow along the ground, following terrain steps of
// one level. planRun() works out the run: the first cell is whatever a plain
// click would place (planUse), and each next cell is tried against the world
// as it would be after the earlier ones. The run ends at the first cell
// canApply refuses; nothing here decides what is legal.

import { DIR4, E, edgeOf, inBounds, inColumnBounds, key, keyX, keyY, keyZ, N, NO_CELL, S, W, above, below, type CellKey, type Dir4 } from '@/core/grid';
import { placedInfo } from '@/core/kinds';
import type { Edit, World } from '@/core/world';
import { applyEdit, canApply, isSolid } from '@/world/world';
import { INPUT } from '@/style/input';
import { planUse, type ActionContext, type ToolState } from './actions';
import { faceZone, type Pick } from './pick';
import { isFloorPiece, type ItemId } from './pieces';

/** Length runs from 1 to this (design section 7). */
export const MAX_LENGTH = 12;

export type Growth = 'up' | 'ground';

const UPWARD = new Set<ItemId>(['pillar', 'tower', 'lighthouse']);
const ALONG = new Set<ItemId>(['fence', 'wall', 'dock', 'arch', 'marble']);

/** How the piece grows when it has a length, or null for pieces that have none. */
export function growthOf(item: ItemId): Growth | null {
  if (UPWARD.has(item)) return 'up';
  if (ALONG.has(item) || isFloorPiece(item)) return 'ground';
  return null;
}

export const clampLength = (n: number): number => Math.max(1, Math.min(MAX_LENGTH, Math.round(n)));

export interface Run {
  /** The edits to apply, in order; empty when the first cell is refused. */
  edits: Edit[];
  /** The world after all of them (the input world when there are none). */
  world: World;
  /** Which way the run grows (null for a run of one, or when nothing fits). */
  dir: Dir4 | 'up' | null;
  /** The cell the run starts from (where a refusal shows), or NO_CELL. */
  at: CellKey;
  /** Why the first cell is refused, when it is. */
  refusal: string | null;
}

/**
 * The side of the pointed-at face nearest the pointer, as a direction on
 * the ground. On a top (or bottom, or water) face that is one of its four
 * edges; on a side face, the nearer of its two upright edges.
 */
export function groundDirection(pick: Pick): Dir4 {
  const fx = pick.point[0] - keyX(pick.cell);
  const fz = pick.point[2] - keyZ(pick.cell);
  if (pick.normal[0] !== 0) return fz < 0.5 ? N : S;
  if (pick.normal[2] !== 0) return fx < 0.5 ? W : E;
  const sides: readonly (readonly [Dir4, number])[] = [
    [N, fz],
    [E, 1 - fx],
    [S, 1 - fz],
    [W, fx],
  ];
  let best: Dir4 = N;
  let bestDist = Infinity;
  for (const [d, dist] of sides) {
    if (dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  return best;
}

/** An edge piece on side `side` of its cell grows along the boundary line, toward the nearer end. */
export function edgeDirection(pick: Pick, side: Dir4): Dir4 {
  const fx = pick.point[0] - keyX(pick.cell);
  const fz = pick.point[2] - keyZ(pick.cell);
  return side === N || side === S ? (fx < 0.5 ? W : E) : fz < 0.5 ? N : S;
}

/**
 * Where a ground piece would sit in the column next to `cell` in direction
 * `d`: the first free cell above that column's walkable top, at most one
 * level up or down from `cell`. NO_CELL when the step is bigger or the
 * column is off the map. Docks stay on the sea surface; a piece that is not
 * resting on anything (an arch or marble placed off a wall) goes straight on.
 */
export function nextGroundCell(w: World, ctx: ActionContext, cell: CellKey, d: Dir4, waterOnly: boolean): CellKey {
  const [dx, dz] = DIR4[d]!;
  const x = keyX(cell) + dx, z = keyZ(cell) + dz, y = keyY(cell);
  if (!inColumnBounds(x, z)) return NO_CELL;
  if (waterOnly) return key(x, 0, z);
  const solid = (l: number): boolean => inBounds(x, l, z) && isSolid(w, ctx.terrain, key(x, l, z));
  if (!isSolid(w, ctx.terrain, below(cell))) return inBounds(x, y, z) ? key(x, y, z) : NO_CELL;
  if (solid(y)) return !inBounds(x, y + 1, z) || solid(y + 1) ? NO_CELL : key(x, y + 1, z);
  if (solid(y - 1)) return key(x, y, z);
  if (solid(y - 2)) return key(x, y - 1, z);
  return NO_CELL;
}

/** The run a click would place with this piece held at this length. A length of 1 is exactly a plain click. */
export function planRun(tool: ToolState, pick: Pick, ctx: ActionContext, length: number): Run {
  const plan = planUse(tool, pick, ctx);
  const nothing = (refusal: string | null): Run => ({ edits: [], world: ctx.world, dir: null, at: plan.at, refusal });
  if (plan.tries.length === 0) return nothing(plan.refusal ?? null);

  let w = ctx.world;
  let first: Edit | null = null;
  let reason = '';
  for (const e of plan.tries) {
    const verdict = canApply(w, ctx.terrain, e);
    if (verdict.ok) {
      first = e;
      break;
    }
    reason ||= verdict.reason;
  }
  if (!first) return nothing(reason);
  w = applyEdit(w, ctx.terrain, first);
  const edits: Edit[] = [first];

  const growth = growthOf(tool.item);
  const n = clampLength(length);
  if (growth === null || n === 1) return { edits, world: w, dir: null, at: plan.at, refusal: null };

  // Where the run is now, which way it goes, and how to make the next edit.
  let cell: CellKey;
  let dir: Dir4 | 'up';
  let make: (c: CellKey) => Edit | null;
  if (first.type === 'placeEdge') {
    const side = faceZone(pick)!;
    const kind = first.kind;
    cell = pick.target;
    dir = edgeDirection(pick, side);
    make = (c) => {
      const edge = edgeOf(c, side);
      return edge === NO_CELL ? null : { type: 'placeEdge', edge, kind };
    };
  } else if (first.type === 'placeFloor') {
    const floor = first.floor;
    cell = first.cell;
    dir = groundDirection(pick);
    make = (c) => ({ type: 'placeFloor', cell: c, floor });
  } else if (first.type === 'placeBlock') {
    const kind = first.kind;
    // The first cell's colour throughout.
    const color = w.blocks.get(first.cell)!.color;
    cell = first.cell;
    dir = growth === 'up' ? 'up' : groundDirection(pick);
    make = (c) => ({ type: 'placeBlock', cell: c, kind, color, from: null });
  } else {
    return { edits, world: w, dir: null, at: plan.at, refusal: null };
  }

  const waterOnly = first.type === 'placeBlock' && placedInfo(first.kind).waterOnly;
  while (edits.length < n) {
    const next = dir === 'up' ? above(cell) : nextGroundCell(w, ctx, cell, dir, waterOnly);
    if (next === NO_CELL) break;
    const edit = make(next);
    if (!edit || !canApply(w, ctx.terrain, edit).ok) break;
    w = applyEdit(w, ctx.terrain, edit);
    edits.push(edit);
    cell = next;
  }
  return { edits, world: w, dir, at: plan.at, refusal: null };
}

/**
 * Turns wheel deltas into length steps (design section 7): one step per
 * mouse-wheel notch, one per `INPUT.lengthScroll` pixels of trackpad scroll.
 * Scrolling up (a negative delta) adds.
 */
export function createScrollSteps(): { feed(pixels: number, notch: boolean): number; reset(): void } {
  let acc = 0;
  return {
    feed(pixels, notch) {
      if (pixels === 0) return 0;
      if (notch || Math.abs(pixels) >= INPUT.wheelNotch) {
        acc = 0;
        return pixels < 0 ? 1 : -1;
      }
      if (Math.sign(acc) !== Math.sign(pixels)) acc = 0;
      acc += pixels;
      const steps = Math.trunc(acc / INPUT.lengthScroll);
      acc -= steps * INPUT.lengthScroll;
      return steps === 0 ? 0 : -steps;
    },
    reset() {
      acc = 0;
    },
  };
}
