// L36: a door's leaf swings open as somebody reaches the threshold and shuts
// after them (design section 13, "Doors and thresholds"). Who needs which
// door is the crowd's business (src/life/people/doors.ts: it also keeps
// people out of a doorway until its door is open); this only draws the
// angle the door table says, eased, on twos.
//
// Cost: a shut door is never touched. Its instance stands where the plan put
// it; the matrix is set only while the angle changes (or the house bounces),
// and actors never make the page redraw its grounding picture.

import { invertAffine, multiply, type Mat4, type Mat4Like } from '@/core/mat4';
import { HATCH, hatchLift, hingesOf, leafSwing, wallInSocket, type LeafKind } from '@/parts/openings/door-leaf';
import { defineBehaviour, type InstanceHandle } from '../api';
import { carryOf } from '../feedback/carry';
import { easeInOut } from '../motion/ease';
import { Twos } from '../motion/twos';
import { doorTableOf } from './table';

interface State {
  key: string;
  kind: LeafKind;
  /** The leaf's wall frame in its socket's frame, and back. */
  wall: Mat4;
  unwall: Mat4;
  /** The right leaf of a double door, or a derived hatch's frame. */
  extra: InstanceHandle | null;
  twos: Twos;
  /** What was last drawn: the eased opening, the base it was drawn on, whether it was carried. */
  shown: number;
  base: Mat4Like | null;
  carried: boolean;
}

/** The door table's key for a door-leaf actor: its door feature's id (the socket's owner), or the derived hatch's. */
export function doorKeyOf(at: { socket: string } | { cell: number } | object | null): string {
  if (at && 'socket' in at) {
    const i = at.socket.lastIndexOf('/');
    return i < 0 ? at.socket : at.socket.slice(0, i);
  }
  if (at && 'cell' in at) return `hatch@${at.cell}`;
  return '';
}

/** The local swing of leaf `i` (0, or 1 for a double door's right leaf) at opening `f` (0–1 eased), in the socket frame. */
function swingOf(s: State, i: number, f: number): Mat4 {
  const local = s.kind === 'hatch' ? hatchLift(f * HATCH.lift) : leafSwing(hingesOf(s.kind)[i]!, f * hingesOf(s.kind)[i]!.swing);
  return multiply(multiply(s.wall, local), s.unwall);
}

export default defineBehaviour({
  actor: 'door-leaf',
  create(item, ctx): State {
    const variant = item.variant ?? 'plain';
    const kind: LeafKind = variant === 'double-right' ? 'double' : variant;
    const derived = item.params?.derived === 1;
    const wall = kind === 'hatch' && derived ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : wallInSocket(kind, Math.max(0, Math.round(item.params?.steps ?? 0)));
    let extra: InstanceHandle | null = null;
    if (variant === 'double') extra = ctx.stage.spawn({ actor: 'door-leaf', variant: 'double-right' }, ctx.instance.base);
    else if (kind === 'hatch' && derived) extra = ctx.stage.spawn({ actor: 'door-leaf', variant: 'hatch', params: { frame: 1 } }, ctx.instance.base);
    return { key: doorKeyOf(item.at), kind, wall, unwall: invertAffine(wall), extra, twos: new Twos(ctx.rand('twos')), shown: 0, base: null, carried: false };
  },
  update(state, dt, _signals, ctx) {
    const open = doorTableOf(ctx.stage)?.open(state.key) ?? 0;
    const carry = carryOf(ctx.stage, ctx.item.home);
    const base = ctx.instance.base;
    // On twos, like every drawn pose; but the moment it is shut again is drawn at once.
    const tick = state.twos.tick(dt) > 0;
    const f = easeInOut(open);
    const moved = base !== state.base || carry !== null || state.carried;
    if (!moved && (f === state.shown || (!tick && f !== 0))) return;
    state.shown = f;
    state.base = base;
    state.carried = carry !== null;
    const place = (h: InstanceHandle, i: number): void => {
      const m = multiply(base, swingOf(state, i, f));
      h.setMatrix(carry ? multiply(carry, m) : m);
    };
    place(ctx.instance, 0);
    if (state.extra) {
      if (state.kind === 'double') place(state.extra, 1);
      else if (moved) state.extra.setMatrix(carry ? multiply(carry, base) : base);
    }
  },
  dispose(state) {
    state.extra?.release();
  },
});
