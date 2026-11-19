// What a click means (design section 7). Owner: Interface. Pure.
//
// planUse() turns "this tool, on this picked face" into the edits to try;
// planErase() does the same for a right click or a long press. Neither
// decides whether an edit is legal: that is canApply's job (the world
// module), and the caller asks it before applying anything. What lives here
// is only targeting: which cell, which edge, which way stairs face, what the
// Change tool steps to next.

import { columnIndex, DIR4, edgeOf, inBounds, key, keyX, keyY, keyZ, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { AUTO_KINDS, KINDS, PALETTE_SIZE, placedInfo, type Kind, type PlacedKind } from '@/core/kinds';
import type { Vec3 } from '@/core/mat4';
import type { Edit, Rot, Terrain, World } from '@/core/world';
import { faceZone, type Pick } from './pick';
import { isEdgePiece, isFloorPiece, isToolId, type ItemId } from './pieces';

export interface ToolState {
  /** The selected tray item: a piece or a tool. */
  item: ItemId;
  /** The colour swatch: 'auto' (the default) or a forced palette index. */
  swatch: number | 'auto';
  /** The house style for a new house: 0 or absent = Random. */
  style?: number;
}

export interface ActionContext {
  world: World;
  terrain: Terrain;
  /** Resolved kinds of the town as shown (so an Auto block that became an arch counts as an arch). */
  kinds?: ReadonlyMap<CellKey, Kind> | null;
  /** The direction the camera looks, world space: stairs with nothing to climb face away from it. */
  rayDir?: Vec3;
}

export interface Plan {
  /** Edits to try, in order; the first one canApply accepts is the one to apply. */
  tries: Edit[];
  /** The cell the action is about (where a refusal shows), or NO_CELL. */
  at: CellKey;
  /** Nothing can be tried here, and this is why (outside the map). */
  refusal?: string;
  /** The Change tool on a piece that cannot change: nothing happens and the block wiggles. */
  wiggle?: boolean;
}

const nothing = (at: CellKey = NO_CELL): Plan => ({ tries: [], at });

/** The Change tool's order: Auto, then the kinds Auto can become, then Auto again. */
export const CHANGE_CYCLE: readonly PlacedKind[] = ['auto', ...AUTO_KINDS];

function resolvedKind(ctx: ActionContext, cell: CellKey): Kind | null {
  const placed = ctx.world.blocks.get(cell)?.kind;
  if (placed === undefined) return null;
  return ctx.kinds?.get(cell) ?? (placed === 'auto' ? null : placed);
}

function solidAt(ctx: ActionContext, x: number, y: number, z: number): boolean {
  if (!inBounds(x, y, z)) return false;
  if (y < ctx.terrain.height[columnIndex(x, z)]!) return true;
  const block = ctx.world.blocks.get(key(x, y, z));
  return block !== undefined && placedInfo(block.kind).solid;
}

/**
 * Which way new stairs face (design section 7). `rot` is the Dir4 the flight
 * climbs toward: 0 north, 1 east, 2 south, 3 west. It points at the
 * neighbouring column whose walkable top is exactly one level higher; with
 * several, the one nearest the pointer; with none, away from the camera.
 */
export function stairsRot(cell: CellKey, point: Vec3, ctx: ActionContext): Rot {
  const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
  let best: Dir4 | null = null;
  let bestDist = Infinity;
  for (let d = 0 as Dir4; d < 4; d++) {
    const [dx, dz] = DIR4[d]!;
    if (!solidAt(ctx, x + dx, y, z + dz) || solidAt(ctx, x + dx, y + 1, z + dz)) continue;
    // Distance from the pointer to the middle of the boundary shared with that neighbour.
    const dist = Math.hypot(point[0] - (x + 0.5 + dx * 0.5), point[2] - (z + 0.5 + dz * 0.5));
    if (dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  if (best !== null) return best;
  if (!ctx.rayDir) return 0;
  let away: Dir4 = 0;
  let most = -Infinity;
  for (let d = 0 as Dir4; d < 4; d++) {
    const dot = DIR4[d]![0] * ctx.rayDir[0] + DIR4[d]![1] * ctx.rayDir[2];
    if (dot > most) {
      away = d;
      most = dot;
    }
  }
  return away;
}

/**
 * The cell a floor goes into. Normally the target cell; but a floor shares
 * its cell with a tree, fountain, stall, cell fence or cell wall, and runs
 * through an arch standing on the ground, so pointing at one of those means
 * "under this".
 */
function floorCell(pick: Pick, ctx: ActionContext): CellKey {
  if (pick.hit !== 'block') return pick.target;
  const kind = resolvedKind(ctx, pick.cell);
  if (kind === null) return pick.target;
  if (KINDS[kind].keepsFloor && !KINDS[kind].solid) return pick.cell;
  if (kind === 'arch' && pick.normal[1] === 0) return pick.cell;
  return pick.target;
}

/** A click (or tap) with the selected tray item on a picked face. */
export function planUse(tool: ToolState, pick: Pick, ctx: ActionContext): Plan {
  const item = tool.item;
  if (item === 'erase') return planErase(pick, ctx);

  if (item === 'change' || item === 'paint') {
    if (pick.hit !== 'block') return nothing();
    const block = ctx.world.blocks.get(pick.cell);
    if (!block) return nothing();
    if (item === 'paint') {
      const color = tool.swatch === 'auto' ? (block.color + 1) % PALETTE_SIZE : tool.swatch;
      return color === block.color ? nothing(pick.cell) : { tries: [{ type: 'paint', cell: pick.cell, color }], at: pick.cell };
    }
    const index = CHANGE_CYCLE.indexOf(block.kind);
    if (index >= 0) {
      const tries: Edit[] = [];
      for (let n = 1; n < CHANGE_CYCLE.length; n++) {
        tries.push({ type: 'setKind', cell: pick.cell, kind: CHANGE_CYCLE[(index + n) % CHANGE_CYCLE.length]! });
      }
      return { tries, at: pick.cell };
    }
    if (block.kind === 'stairs') {
      return { tries: [{ type: 'setRot', cell: pick.cell, rot: ((block.rot + 1) % 4) as Rot }], at: pick.cell };
    }
    return { tries: [], at: pick.cell, wiggle: true };
  }
  if (isToolId(item)) return nothing();

  if (isFloorPiece(item)) {
    const cell = floorCell(pick, ctx);
    if (cell === NO_CELL) return { tries: [], at: NO_CELL, refusal: 'outside the map' };
    return { tries: [{ type: 'placeFloor', cell, floor: item }], at: cell };
  }

  const target = pick.target;
  if (target === NO_CELL) return { tries: [], at: NO_CELL, refusal: 'outside the map' };

  if (isEdgePiece(item)) {
    const side = faceZone(pick);
    if (side !== null) {
      const edge = edgeOf(target, side);
      if (edge === NO_CELL) return { tries: [], at: target, refusal: 'outside the map' };
      return { tries: [{ type: 'placeEdge', edge, kind: item }], at: target };
    }
  }

  const edit: Edit = { type: 'placeBlock', cell: target, kind: item, color: tool.swatch, from: pick.from };
  if (item === 'stairs') edit.rot = stairsRot(target, pick.point, ctx);
  if (item === 'house' && tool.style) edit.style = tool.style;
  return { tries: [edit], at: target };
}

/**
 * Alt-click (design section 7, "Copy a look"): the kind, wall colour and
 * house style of the block under the pointer, to put into the hand. Null
 * when the pointer is not on a block.
 */
export function copyLook(pick: Pick, ctx: ActionContext): { item: PlacedKind; swatch: number; style: number } | null {
  if (pick.hit !== 'block') return null;
  const block = ctx.world.blocks.get(pick.cell);
  if (!block) return null;
  return { item: block.kind, swatch: block.color, style: block.style ?? 0 };
}

/**
 * Erase (right click, long press, or the Erase tool): one block, floor or
 * edge piece. On a top face the thing lying on it goes first: the edge
 * piece in the strip you point at, then the floor; otherwise the block you
 * point at. Terrain cannot be erased.
 */
export function planErase(pick: Pick, ctx: ActionContext): Plan {
  const { world } = ctx;
  const onTop = pick.hit !== 'water' && pick.normal[1] === 1 && pick.target !== NO_CELL;
  if (onTop) {
    const side = faceZone(pick);
    if (side !== null) {
      const edge = edgeOf(pick.target, side);
      if (edge !== NO_CELL && world.edges.has(edge)) return { tries: [{ type: 'eraseEdge', edge }], at: pick.target };
    }
    if (world.floors.has(pick.target)) return { tries: [{ type: 'eraseFloor', cell: pick.target }], at: pick.target };
  }
  if (pick.hit === 'block') return { tries: [{ type: 'eraseBlock', cell: pick.cell }], at: pick.cell };
  if (onTop) {
    // Bare ground: forgive a click that missed the strip, and take the nearest edge piece around this square.
    const nearest = faceZone(pick, 0.51);
    for (const side of nearest === null ? [] : [nearest, ...([0, 1, 2, 3] as Dir4[]).filter((d) => d !== nearest)]) {
      const edge = edgeOf(pick.target, side);
      if (edge !== NO_CELL && world.edges.has(edge)) return { tries: [{ type: 'eraseEdge', edge }], at: pick.target };
    }
  }
  return nothing();
}

/**
 * The cells on a straight walk from one cell to another at the first cell's
 * level, moving one column at a time (never diagonally, so a painted run has
 * no gaps). Leaves out `from`, includes `to`.
 */
export function lineCells(from: CellKey, to: CellKey): CellKey[] {
  const y = keyY(from);
  let x = keyX(from), z = keyZ(from);
  const x1 = keyX(to), z1 = keyZ(to);
  const nx = Math.abs(x1 - x), nz = Math.abs(z1 - z);
  const sx = Math.sign(x1 - x), sz = Math.sign(z1 - z);
  const out: CellKey[] = [];
  for (let ix = 0, iz = 0; ix < nx || iz < nz; ) {
    if (iz >= nz || (ix < nx && (0.5 + ix) / nx <= (0.5 + iz) / nz)) {
      x += sx;
      ix++;
    } else {
      z += sz;
      iz++;
    }
    out.push(key(x, y, z));
  }
  return out;
}
