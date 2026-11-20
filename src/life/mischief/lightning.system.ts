// The Lightning tool, drawn (design section 13b; the owner: "it summons a
// little storm cloud and then strikes it with lightning, and that's how you get
// something on fire"). Owner: Mischief.
//
// On the click a little storm cloud gathers over the building: puffs drawing
// together and darkening from pale grey to thundery slate. At STRIKE.at the bolt
// comes down from its belly to the spot clicked (a jagged inked ribbon turned
// to the camera, with a second flicker), a white star flashes where it lands and
// a cold light washes over the town round it (brighter at night); the director
// sets the block alight at that moment. Then the cloud hangs a moment, thins to a
// wash and drifts off downwind. On stone the bolt strikes all the same and only
// flashes. Each strike has its own cloud; the cloud is drawn on twos, as one
// shape with one outline (its puffs share an ink).

import { compose, rotationY, scaling, translation, type Mat4 } from '@/core/mat4';
import { rand } from '@/core/rand';
import type { MeshData } from '@/gen/mesh';
import { defineSystem, type InstanceHandle } from '../api';
import { mischiefOf, STRIKE, type Director, type MischiefEvent, type Strike } from './director';
import { boltLightMesh, boltMesh, strikeFlashMesh, stormPuffMesh } from './meshes';
import { easeOut } from './nuke-timing';
import { ownStage, type Owned } from './owned';

const HIDDEN: Mat4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50, 0, 1];
const FPS = 12;
const PUFFS = 9;

interface Storm {
  s: Strike;
  t: number;
  /** Each puff's handle and what it is drawn as (`${look}${shade}${mist}`). */
  puffs: { h: InstanceHandle | null; key: string }[];
  bolt: InstanceHandle | null;
  boltLook: number;
  flash: InstanceHandle | null;
  light: InstanceHandle | null;
  frame: number;
  /** Drift downwind so far. */
  dx: number;
  dz: number;
}

interface State {
  d: Director;
  own: Owned;
  storms: Storm[];
  pools: Map<string, InstanceHandle[]>;
  off: () => void;
}

function take(st: State, k: string, mesh: () => MeshData): InstanceHandle {
  return st.pools.get(k)?.pop() ?? st.own.stage.spawnMesh(mesh(), HIDDEN);
}
function give(st: State, k: string, h: InstanceHandle): void {
  h.setVisible(false);
  let l = st.pools.get(k);
  if (!l) st.pools.set(k, (l = []));
  l.push(h);
}

function end(st: State, w: Storm): void {
  for (const p of w.puffs) if (p.h) give(st, p.key, p.h);
  for (const h of [w.bolt, w.flash, w.light]) h?.release();
  st.storms.splice(st.storms.indexOf(w), 1);
}

function onEvent(st: State, e: MischiefEvent): void {
  if (e.type === 'cloud') st.storms.push({ s: e.strike, t: 0, puffs: [], bolt: null, boltLook: e.strike.id % 3, flash: null, light: null, frame: -1, dx: 0, dz: 0 });
  else if (e.type === 'reset' || e.type === 'undo') for (const w of [...st.storms]) end(st, w);
}

/** Each puff of a storm cloud at `t`: where, how big, what shade, and as a wash with what opacity. */
function puffsAt(w: Storm): { x: number; y: number; z: number; r: number; shade: number; mist: boolean; alpha: number; look: number }[] {
  const t = w.t;
  const [px, py, pz] = w.s.point;
  const cy = py + STRIKE.height;
  const gather = easeOut(t / (STRIKE.at - 0.05));
  const thin = t < STRIKE.at + STRIKE.linger ? 0 : Math.min(1, (t - STRIKE.at - STRIKE.linger) / (STRIKE.gone - STRIKE.at - STRIKE.linger));
  // Gathering it darkens; spent, it pales again before it thins to a wash (no jump from slate to wash).
  const spent = t - STRIKE.at - STRIKE.linger;
  const shade = t < STRIKE.at * 0.35 ? 0 : t < STRIKE.at * 0.7 ? 1 : spent < -0.5 ? 2 : spent < -0.25 ? 1 : 0;
  const out = [];
  for (let i = 0; i < PUFFS; i++) {
    const u = rand(w.s.id, 'puff', i);
    // From a loose ring of pale wisps to a tight, flat-bellied cloud, a little higher in the middle.
    const a = (i / PUFFS) * Math.PI * 2 + w.s.id;
    const far = 1.7 - 1.1 * gather + thin * 0.6;
    const ring = i === 0 ? 0 : (i % 2 ? 1 : 0.55) * far;
    const r = (0.22 + 0.3 * gather) * (i === 0 ? 1.35 : 0.9 + 0.25 * u) * (1 + thin * 0.7);
    out.push({
      x: px + w.dx + Math.cos(a) * ring,
      y: cy + (i === 0 ? 0.18 : (1 - (i % 2)) * 0.12) + thin * 0.4 + Math.sin(t * 3 + i) * 0.02,
      z: pz + w.dz + Math.sin(a) * ring,
      r,
      shade,
      mist: thin > 0,
      alpha: 0.85 * (1 - thin) ** 1.3,
      look: i % 3,
    });
  }
  return out;
}

export default defineSystem<State>({
  id: 'mischief.lightning',
  order: 14,
  create(ctx) {
    const d = mischiefOf(ctx.stage);
    const st: State = { d, own: ownStage(ctx.stage), storms: [], pools: new Map(), off: () => {} };
    st.off = d.on((e) => onEvent(st, e));
    return st;
  },
  update(st, dt, signals) {
    const yaw = (st.d.camera.yaw * Math.PI) / 180;
    const dark = 1 - signals.time.light;
    for (const w of [...st.storms]) {
      w.t += dt;
      const t = w.t;
      if (t >= STRIKE.gone) {
        end(st, w);
        continue;
      }
      const [px, py, pz] = w.s.point;
      if (t > STRIKE.at) {
        const wind = signals.wind(px, pz);
        const v = (0.25 + 0.5 * wind.strength) * Math.min(1, (t - STRIKE.at) / 1.5);
        w.dx += wind.dirX * v * dt;
        w.dz += wind.dirZ * v * dt;
      }
      // ── the bolt, the flash and its light (every frame: they are quick) ──
      const since = t - STRIKE.at;
      const boltOn = since >= 0 && since < STRIKE.bolt && !(since > 0.08 && since < 0.12);
      if (boltOn) {
        if (since >= 0.12 && w.boltLook === w.s.id % 3) {
          // The second flicker: a different bolt.
          w.bolt?.release();
          w.bolt = null;
          w.boltLook = (w.s.id + 1) % 3;
        }
        w.bolt ??= st.own.stage.spawnMesh(boltMesh(w.boltLook), HIDDEN);
        const len = Math.max(0.5, STRIKE.height - 0.25);
        w.bolt.setMatrix(compose(translation(px + w.dx * 0.3, py, pz + w.dz * 0.3), rotationY(yaw), scaling(2.2, len, 2.2)));
        w.bolt.setParams(1);
        w.bolt.setVisible(true);
      } else if (w.bolt) w.bolt.setVisible(false);
      if (since >= 0 && since < STRIKE.flash) {
        w.flash ??= st.own.stage.spawnMesh(strikeFlashMesh(), HIDDEN);
        const k = 1 - since / STRIKE.flash;
        const sc = 0.15 + 0.45 * k;
        w.flash.setMatrix(compose(translation(px, py + 0.05, pz), rotationY(yaw + since * 4), scaling(sc, sc, sc)));
        w.flash.setParams(1);
        w.flash.setVisible(true);
      } else if (w.flash) {
        w.flash.release();
        w.flash = null;
      }
      if (since >= 0 && since < 0.45) {
        w.light ??= st.own.stage.spawnMesh(boltLightMesh(), HIDDEN);
        const k = (1 - since / 0.45) ** 2 * (since > 0.08 && since < 0.12 ? 0.4 : 1);
        w.light.setMatrix([3.2, 0, 0, 0, 0, 2.4, 0, 0, 0, 0, 3.2, 0, px, py + 0.4, pz, 1]);
        w.light.setParams((0.1 + 0.28 * dark) * k);
        w.light.setVisible(true);
      } else if (w.light) {
        w.light.release();
        w.light = null;
      }
      // ── the cloud, on twos ──
      const frame = Math.floor(t * FPS);
      if (frame === w.frame) continue;
      w.frame = frame;
      puffsAt(w).forEach((p, i) => {
        const slot = (w.puffs[i] ??= { h: null, key: '' });
        const k = `storm${p.look}${p.shade}${p.mist}`;
        if (slot.key !== k) {
          if (slot.h) give(st, slot.key, slot.h);
          slot.h = take(st, k, () => stormPuffMesh(p.look, p.shade, p.mist));
          slot.key = k;
        }
        const s = p.r * 2;
        slot.h!.setMatrix([s, 0, 0, 0, 0, s * 0.72, 0, 0, 0, 0, s, 0, p.x, p.y, p.z, 1]);
        if (p.mist) slot.h!.setParams(p.alpha);
        slot.h!.setVisible(p.alpha > 0.01);
      });
    }
  },
  dispose(st) {
    st.off();
    st.own.releaseAll();
  },
});

