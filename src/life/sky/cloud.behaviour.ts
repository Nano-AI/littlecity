// L31: clouds drift over the paper with the wind. A cloud is a few lobes of
// mist, edged with a soft graphite line by the page, seen over the paper
// round the map (it thins away over the map itself, so it never washes out
// the town); its soft cool shadow slides across the island. It goes
// with the wind where it is (faster in a gust) and, once it has drifted off
// the paper, comes back in from the far side upwind. The actor is the first
// lobe; it spawns the rest and the shadow.
//
// All travel, all smooth: a cloud has no poses.

import { SIZE_X, SIZE_Z } from '@/core/grid';
import { compose, scaling, translation, type Mat4 } from '@/core/mat4';
import { defineBehaviour, type InstanceHandle } from '../api';
import { CLOUDS } from '@/rules/life/L31.sky.rule';

/** How far (columns) from the map's middle a cloud may drift before it comes round again. */
export const CLOUD_REACH = 44;
/** Columns a second at no wind, and per unit of wind. */
const DRIFT = 0.18, DRIFT_WIND = 0.55;

interface Lobe {
  handle: InstanceHandle;
  dx: number;
  dy: number;
  dz: number;
  size: number;
}
interface State {
  lobes: Lobe[];
  shadow: InstanceHandle;
  x: number;
  z: number;
  y: number;
  radius: number;
  n: number;
  m: Mat4;
  /** The other clouds of this town (and this one): crossing shadows share their shade. */
  peers: Set<State>;
}

/** The clouds of each town, so that shadows which cross can share their shade instead of stacking into a dark blot. */
const PEERS = new WeakMap<object, Set<State>>();

export default defineBehaviour({
  actor: 'cloud',
  create(item, ctx): State {
    const index = item.params?.index ?? 0;
    const lobes: Lobe[] = [];
    const count = 5 + Math.floor(ctx.rand('lobes') * 3);
    const long = 4 + 2.5 * ctx.rand('long'), wide = 2 + 1.2 * ctx.rand('wide');
    for (let i = 0; i < count; i++) {
      const handle = i === 0 ? ctx.instance : ctx.stage.spawn({ actor: 'cloud', params: { look: i } }, ctx.instance.base);
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      lobes.push({ handle, dx: t * long * 2 + (ctx.rand('dx', i) - 0.5) * 0.6, dy: (ctx.rand('dy', i) - 0.3) * 0.5, dz: (ctx.rand('dz', i) - 0.5) * wide, size: (3.2 + 2.4 * ctx.rand('size', i)) * (1 - Math.abs(t) * 0.55) });
    }
    const shadow = ctx.stage.spawn({ actor: 'cloud', variant: 'shadow' }, ctx.instance.base);
    // Spread over the paper, one per band, so the sky opens with clouds already in it.
    const along = ((index + 0.5) / CLOUDS - 0.5) * CLOUD_REACH * 1.6;
    const across = (ctx.rand('across') - 0.5) * 30;
    let peers = PEERS.get(ctx.stage);
    if (!peers) PEERS.set(ctx.stage, (peers = new Set()));
    const state: State = { lobes, shadow, x: SIZE_X / 2 + along, z: SIZE_Z / 2 + across, y: 9 + 3 * ctx.rand('y'), radius: long * 1.15, n: 0, m: new Array<number>(16).fill(0), peers };
    peers.add(state);
    return state;
  },
  update(state, dt, signals, ctx) {
    const wind = signals.wind(state.x, state.z);
    const v = (DRIFT + DRIFT_WIND * wind.strength) * dt;
    state.x += wind.dirX * v;
    state.z += wind.dirZ * v;
    // Off the paper downwind: back in from upwind, somewhere else across.
    const ox = state.x - SIZE_X / 2, oz = state.z - SIZE_Z / 2;
    if (ox * wind.dirX + oz * wind.dirZ > CLOUD_REACH) {
      const k = state.n++;
      const across = (ctx.rand('back', k) - 0.5) * 36;
      state.x = SIZE_X / 2 - wind.dirX * CLOUD_REACH - wind.dirZ * across;
      state.z = SIZE_Z / 2 - wind.dirZ * CLOUD_REACH + wind.dirX * across;
    }
    // The cloud lies along the wind.
    const c = wind.dirX, s = wind.dirZ;
    const night = signals.time.isNight ? 0.45 : 1;
    // A cloud is seen over the paper round the map, never laid over the town itself (it would wash
    // out the very thing being built): it thins away as it drifts in over the map, and its shadow
    // crosses the island instead.
    const outside = Math.max(Math.max(-state.x, state.x - SIZE_X), Math.max(-state.z, state.z - SIZE_Z));
    const seen = Math.min(1, Math.max(0, (outside + 2) / 8));
    for (const l of state.lobes) {
      const wx = state.x + l.dx * c - l.dz * s, wz = state.z + l.dx * s + l.dz * c;
      l.handle.setMatrix(compose(translation(wx, state.y + l.dy, wz), scaling(l.size, l.size * 0.7, l.size)));
      l.handle.setParams(0.42 * night * seen, l.dx, 1, 0);
    }
    // The shadow is smaller than the cloud and soft all through: a passing shade over a few houses,
    // never a whole quarter of the town at full strength.
    const r = state.radius * 0.75;
    state.shadow.setMatrix(compose(translation(state.x, 0.9, state.z), scaling(r, 1, r)));
    // The shadow falls on the island and the sea, not on the paper round the map: it fades out at the edge.
    const out = Math.max(Math.max(-state.x, state.x - SIZE_X), Math.max(-state.z, state.z - SIZE_Z));
    const onMap = 1 - Math.min(1, Math.max(0, (out + r * 0.6) / (r * 0.8)));
    // Where shadows cross they share the shade: two right on top of each other are together as dark as
    // one, not nearly twice as dark (which read as a black blot on the sea).
    let crowd = 0;
    for (const o of state.peers) {
      if (o !== state) crowd += Math.max(0, 1 - Math.hypot(o.x - state.x, o.z - state.z) / (r + o.radius * 0.75));
    }
    state.shadow.setParams((0.2 * (signals.time.light * 0.8 + 0.2) * onMap) / (1 + crowd), 0, 0, r);
  },
  dispose(state) {
    state.peers.delete(state);
    for (let i = 1; i < state.lobes.length; i++) state.lobes[i]!.handle.release();
    state.shadow.release();
  },
});
