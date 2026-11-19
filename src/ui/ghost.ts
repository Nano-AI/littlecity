// The ghost preview (design section 7; mouse only). Owner: Interface. Pure.
//
// On hover the game applies the piece to a what-if world, runs the shape
// stage on it, and hands the view the new structure to draw translucent.
// Auto neighbours whose resolved kind would change shimmer; an illegal
// target shows a red outline. Only placing a piece has a ghost: the Change,
// Paint and Erase tools act on what is already there.

import { NO_CELL, type CellKey } from '@/core/grid';
import type { Edit, EditResult, Terrain, World } from '@/core/world';
import type { Ghost } from '@/render/api';
import type { ShapePlan, StructureId } from '@/resolve/plan';
import { applyEdit } from '@/world/world';
import type { Plan } from './actions';

export interface GhostHost {
  readonly world: World;
  readonly terrain: Terrain;
  /** The shape as shown now. */
  readonly shape: ShapePlan;
  can(e: Edit): EditResult;
  preview(world: World): ShapePlan;
}

const isPlacement = (e: Edit): boolean => e.type === 'placeBlock' || e.type === 'placeFloor' || e.type === 'placeEdge';

/** The Auto blocks that would resolve to a different kind in `next` than they do in `now`. */
export function changedAutos(world: World, now: ShapePlan, next: ShapePlan): CellKey[] {
  const out: CellKey[] = [];
  for (const [cell, block] of world.blocks) {
    if (block.kind !== 'auto') continue;
    const after = next.kinds.get(cell);
    if (after !== undefined && after !== now.kinds.get(cell)) out.push(cell);
  }
  return out;
}

/** The ghost for a planned placement, or null when there is nothing to show. */
export function ghostFor(plan: Plan, host: GhostHost): Ghost | null {
  const placing = plan.tries.some(isPlacement) || plan.refusal !== undefined;
  if (!placing) return null;
  const edit = plan.tries.find((e) => host.can(e).ok);
  if (!edit) return plan.at === NO_CELL ? null : { plan: host.shape, show: [], refuse: plan.at };

  const preview = host.preview(applyEdit(host.world, host.terrain, edit));
  let id: StructureId | undefined;
  if (edit.type === 'placeBlock') id = preview.structureAt.get(edit.cell);
  else if (edit.type === 'placeFloor') id = preview.floorAt.get(edit.cell);
  else if (edit.type === 'placeEdge') id = preview.edgeAt.get(edit.edge);
  const shimmer = changedAutos(host.world, host.shape, preview);
  return { plan: preview, show: id === undefined ? [] : [id], ...(shimmer.length > 0 ? { shimmer } : {}) };
}
