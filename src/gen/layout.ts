// World frames for everything in a town (Stage 0, real; treat as frozen).
//
// One pure answer to "where is this socket / prop / actor", shared by the
// renderer (to place instances), life (to walk to a door or sit on a seat)
// and tests. Resolution order for a socket:
//   1. the frame its structure's generator returned in GenOutput.anchors;
//   2. for a socket owned by a prop: the prop's frame × its part's anchors[name];
//   3. the fallback from its cell and dir (socketFallbackFrame).

import { multiply, type Mat4, type Mat4Like } from '@/core/mat4';
import type { Actor, DressingPlan, Prop, ShapePlan, Socket } from '@/resolve/plan';
import type { PartOutput } from './api';
import { anchorFrame, socketFallbackFrame, type Placement } from './frames';

export interface Layout {
  /** World frame of a socket, or null if no rule declared it. */
  socket(id: string): Mat4 | null;
  /** World frame (and line span) of a prop or actor; null for free-roaming actors and broken anchors. */
  item(id: string): Placement | null;
}

export interface LayoutInput {
  shape: ShapePlan;
  dressing: DressingPlan | null;
  /** Socket frames from the generators (every GenOutput.anchors merged). */
  anchors: ReadonlyMap<string, Mat4Like> | Record<string, Mat4Like>;
  /** The part output for a prop, to read the frames of sockets the prop owns. */
  propOutput?(p: Prop, span: number): PartOutput | null;
}

export function createLayout(input: LayoutInput): Layout {
  const { shape, dressing } = input;
  const anchorOf =
    input.anchors instanceof Map
      ? (id: string): Mat4Like | undefined => (input.anchors as ReadonlyMap<string, Mat4Like>).get(id)
      : (id: string): Mat4Like | undefined => (input.anchors as Record<string, Mat4Like>)[id];

  const sockets = new Map<string, Socket>();
  for (const s of shape.sockets) sockets.set(s.id, s);
  const items = new Map<string, Prop | Actor>();
  const props = new Map<string, Prop>();
  if (dressing) {
    for (const s of dressing.sockets) sockets.set(s.id, s);
    for (const p of dressing.props) {
      items.set(p.id, p);
      props.set(p.id, p);
    }
    for (const a of dressing.actors) items.set(a.id, a);
  }

  const socketCache = new Map<string, Mat4 | null>();
  const itemCache = new Map<string, Placement | null>();
  const busy = new Set<string>();

  const socket = (id: string): Mat4 | null => {
    const hit = socketCache.get(id);
    if (hit !== undefined) return hit;
    const s = sockets.get(id);
    let result: Mat4 | null = null;
    if (s && !busy.has(`s:${id}`)) {
      busy.add(`s:${id}`);
      const fromGenerator = anchorOf(id);
      if (fromGenerator) {
        result = Array.from(fromGenerator);
      } else {
        const owner = s.owner !== undefined ? props.get(s.owner) : undefined;
        if (owner) {
          const placed = item(owner.id);
          const local = placed ? input.propOutput?.(owner, placed.span)?.anchors?.[s.name ?? s.type] : undefined;
          if (placed && local) result = multiply(placed.frame, local);
        }
        result ??= socketFallbackFrame(s);
      }
      busy.delete(`s:${id}`);
    }
    socketCache.set(id, result);
    return result;
  };

  const item = (id: string): Placement | null => {
    const hit = itemCache.get(id);
    if (hit !== undefined) return hit;
    const it = items.get(id);
    let result: Placement | null = null;
    if (it && it.at && !busy.has(`i:${id}`)) {
      busy.add(`i:${id}`);
      result = anchorFrame(it.at, socket);
      busy.delete(`i:${id}`);
    }
    itemCache.set(id, result);
    return result;
  };

  return { socket, item };
}
