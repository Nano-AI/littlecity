// Staged resolve for the app (plan Review Focus 1). Owner: Logic.
//
// update(world) resolves the shape at once; poll(), called once a frame,
// resolves the dressing for the NEWEST shape only and returns it once.
// Several edits before a poll cost one dressing, for the last world; a
// dressing for a superseded world is never computed or returned, so nothing
// flickers back. preview() is a what-if shape for the ghost and touches
// neither; placing the piece that was just previewed reuses that shape.
//
// Content hashes: a structure whose hash is unchanged keeps the very same
// Structure object from the previous shape, so `prev === next` tells the
// renderer (and life) it need not rebuild. diffShapes lists what changed.

import type { Terrain, World } from '@/core/world';
import type { ResolveOptions } from './engine/api';
import { resolveDressing, resolveShape } from './index';
import type { DressingPlan, ShapePlan, Structure, StructureId } from './plan';

export interface StagedResolver {
  /** Resolves the shape for this world now and queues its dressing. */
  update(world: World): ShapePlan;
  /**
   * Returns the dressing for the NEWEST world once, when it is ready;
   * otherwise null. Dressing for an older world is dropped, never returned.
   */
  poll(): { shape: ShapePlan; dressing: DressingPlan } | null;
  /** A what-if shape for the ghost preview. Does not disturb update/poll. */
  preview(world: World): ShapePlan;
  /** The latest shape passed back from update(), or null before the first. */
  readonly shape: ShapePlan | null;
}

/** `opts` is passed to every resolve (the app passes a scenario's own rules). */
export function createStagedResolver(terrain: Terrain, opts: ResolveOptions = {}): StagedResolver {
  let shape: ShapePlan | null = null;
  let version = 0;
  let dressed = 0;
  // The last ghost preview: placing the piece that was hovered is the same world again.
  let previewed: ShapePlan | null = null;
  return {
    update(world) {
      if (shape && shape.world === world) return shape;
      let next: ShapePlan;
      if (previewed && previewed !== shape && sameWorld(previewed.world, world)) {
        next = previewed;
        (next as { world: World }).world = world;
      } else next = resolveShape(world, terrain, opts);
      previewed = null;
      if (shape) keepUnchanged(shape, next);
      shape = next;
      version++;
      return shape;
    },
    poll() {
      if (!shape || dressed === version) return null;
      const target = shape;
      const v = version;
      const dressing = resolveDressing(target, opts);
      if (v !== version) return null; // superseded while dressing (never, while dressing is synchronous)
      dressed = v;
      return { shape: target, dressing };
    },
    preview(world) {
      return (previewed = resolveShape(world, terrain, opts));
    },
    get shape() {
      return shape;
    },
  };
}

/** Same blocks, floors and edge pieces (and seed and next seq): the same town to resolve. */
export function sameWorld(a: World, b: World): boolean {
  if (a === b) return true;
  if (a.seed !== b.seed || a.nextSeq !== b.nextSeq) return false;
  if (a.blocks.size !== b.blocks.size || a.floors.size !== b.floors.size || a.edges.size !== b.edges.size) return false;
  for (const [c, x] of a.blocks) {
    const y = b.blocks.get(c);
    if (!y || y.kind !== x.kind || y.color !== x.color || y.rot !== x.rot || y.seq !== x.seq || (y.style ?? 0) !== (x.style ?? 0)) return false;
  }
  for (const [c, k] of a.floors) if (b.floors.get(c) !== k) return false;
  for (const [e, k] of a.edges) if (b.edges.get(e) !== k) return false;
  return true;
}

/** Swaps in the previous Structure object wherever id and hash are unchanged. */
function keepUnchanged(prev: ShapePlan, next: ShapePlan): void {
  const map = next.structures as Map<StructureId, Structure>;
  for (const [id, s] of map) {
    const old = prev.structures.get(id);
    if (old && old !== s && old.hash === s.hash) map.set(id, old);
  }
}

export interface ShapeDiff {
  /** Structure ids new in `next`. */
  added: StructureId[];
  /** Ids in both whose content hash changed (rebuild these). */
  changed: StructureId[];
  /** Ids gone from `next`. */
  removed: StructureId[];
}

/** What changed between two shapes, by structure id and content hash. */
export function diffShapes(prev: ShapePlan | null, next: ShapePlan): ShapeDiff {
  const added: StructureId[] = [];
  const changed: StructureId[] = [];
  const removed: StructureId[] = [];
  for (const [id, s] of next.structures) {
    const old = prev?.structures.get(id);
    if (!old) added.push(id);
    else if (old.hash !== s.hash) changed.push(id);
  }
  if (prev) for (const id of prev.structures.keys()) if (!next.structures.has(id)) removed.push(id);
  const asc = (a: number, b: number): number => a - b;
  return { added: added.sort(asc), changed: changed.sort(asc), removed: removed.sort(asc) };
}
