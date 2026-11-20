// Falling rain and snow over the finished page (Seasons, design section 13a). The particles are made
// in the vertex shader from their number (shaders/weather.ts): this file only picks the square of
// world tiles the camera can see, how many particles to show (capped, lighter on phones, thinned out
// at the overview), the wind's drift, and the colours after the grade. Two draw calls at most (rain
// and snow, while one turns into the other); none at all under a dry sky.

import * as THREE from 'three';
import { WEATHER } from '@/style/season';
import { PALETTE } from '@/style/palette';
import { parseColor } from '@/gen/mesh';
import type { CameraFrame } from './camera';
import type { Grade } from './grade';
import { precipFragment, precipVertex } from './shaders/weather';

/** World units a tile side, and particles in a tile. */
const TILE = 3;
const PER = 128;
/** The most tiles a side the square may have (desktop, phone). */
const MAX_TILES = 18;
const MAX_TILES_PHONE = 12;
/** The column particles fall through, world units: from the sea to above the tallest tower. */
const FLOOR = 0.3;
const TOP = 11;

export interface PrecipInput {
  frame: CameraFrame;
  rain: number;
  snow: number;
  /** The wind where the camera looks: direction and strength. */
  wind: { dirX: number; dirZ: number; strength: number };
  grade: Grade;
  /** 0 by day to 1 at night. */
  night: number;
  seconds: number;
  dt: number;
  /**
   * Fly mode: the perspective eye and the unit way it looks. The square of tiles is then laid round
   * what the eye sees, not round the orbit camera's target (frame is still passed, and ignored).
   */
  eye?: { at: readonly [number, number, number]; forward: readonly [number, number, number] };
  /** Device pixels per CSS pixel now (the quality governor may change it). */
  pixelRatio?: number;
}

export interface Precip {
  /** Sets up this frame; false if nothing falls. */
  update(input: PrecipInput): boolean;
  /**
   * Fly mode: draws with twins of the materials compiled with these defines (PERSP, and REVZ for a
   * reversed depth buffer), so particles have perspective size and are hidden by the fly view's depth;
   * null goes back to the orbit camera's materials.
   */
  perspective(defines: Record<string, number> | null): void;
  readonly scene: THREE.Scene;
  /** Particles shown this frame (for the benchmark). */
  readonly shown: number;
  dispose(): void;
}

export interface PrecipTargets {
  tHeight: { value: THREE.Texture };
  tDepth: { value: THREE.Texture };
  uMap: { value: THREE.Vector4 };
  uMapRange: { value: number };
  uZOrigin: { value: THREE.Vector3 };
  uZAxis: { value: THREE.Vector3 };
  uCanvas: { value: THREE.Vector2 };
  /** Fly mode only: CSS pixels per world unit at a distance of one, and the near and far planes. */
  uFocal: { value: number };
  uClip: { value: THREE.Vector2 };
}

const rgb = (hex: string): [number, number, number] => {
  const [r, g, b] = parseColor(hex);
  return [r / 255, g / 255, b / 255];
};

export function createPrecip(shared: PrecipTargets, phone: boolean, pixelRatio: number): Precip {
  const maxTiles = phone ? MAX_TILES_PHONE : MAX_TILES;
  const slots = maxTiles * maxTiles * PER;
  const geometry = new THREE.BufferGeometry();
  // Nothing per vertex but its number: the shader works everything else out from that.
  const ids = new Float32Array(slots * 6);
  for (let i = 0; i < ids.length; i++) ids[i] = i;
  geometry.setAttribute('position', new THREE.BufferAttribute(ids, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  const scene = new THREE.Scene();
  const make = (snow: boolean) => {
    const u = {
      ...shared,
      uBase: { value: new THREE.Vector2() },
      uTiles: { value: 1 },
      uPer: { value: PER },
      uTile: { value: TILE },
      uKeep: { value: 0 },
      uTime: { value: 0 },
      uTop: { value: TOP },
      uFloor: { value: FLOOR },
      uSpeed: { value: snow ? 0.85 : 9 },
      uDrift: { value: new THREE.Vector2() },
      uSnow: { value: snow ? 1 : 0 },
      uView: { value: new THREE.Vector2(1, 1) },
      uPR: { value: pixelRatio },
      uLen: { value: 0.85 },
      uRainCol: { value: new THREE.Vector3() },
      uFlakeCol: { value: new THREE.Vector3() },
      uRimCol: { value: new THREE.Vector3() },
      uRainInk: { value: 0.4 },
      uFlakeInk: { value: 0.3 },
      uAmount: { value: 1 },
    };
    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: precipVertex,
      fragmentShader: precipFragment,
      uniforms: u,
      transparent: true,
      // A rain stroke's corners wind either way, as it falls down the page.
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    return { mesh, u, material, twin: null as THREE.RawShaderMaterial | null };
  };
  const rain = make(false);
  const snow = make(true);
  const drift = { rain: [0, 0], snow: [0, 0] };
  let shown = 0;

  return {
    scene,
    get shown() {
      return shown;
    },
    perspective(defines) {
      for (const p of [rain, snow]) {
        if (!defines) {
          p.mesh.material = p.material;
          continue;
        }
        if (!p.twin) {
          p.twin = p.material.clone();
          p.twin.uniforms = p.u;
          p.twin.defines = { ...defines };
        }
        p.mesh.material = p.twin;
      }
    },
    update(input) {
      shown = 0;
      const { frame } = input;
      let cx: number, cz: number, tiles: number;
      if (input.eye) {
        // Fly mode: as many tiles as there may be, round the ground ahead of the eye (where its view
        // meets the ground, or 20 units on), the square kept over the map (on a desktop it covers the
        // whole map wherever the eye is, a drone's far off included).
        const { at, forward: f } = input.eye;
        const fl = Math.hypot(f[0], f[2]) || 1;
        const ahead = f[1] < -0.05 ? (at[1] / -f[1]) * fl : 20;
        tiles = maxTiles;
        const half = (tiles * TILE) / 2;
        const keep = (v: number): number => (2 * half >= 50 ? 24 : Math.min(49 - half, Math.max(half - 1, v)));
        cx = keep(at[0] + (f[0] / fl) * ahead);
        cz = keep(at[2] + (f[2] / fl) * ahead);
      } else {
        const pitch = Math.max(0.17, -frame.forward[1]);
        // The ground the picture shows, and toward the camera as far as a particle at the top of its
        // column can stand and still be seen (high things look farther off).
        const lean = (TOP - FLOOR) * Math.sqrt(1 - pitch * pitch) / pitch;
        const fx = frame.forward[0], fz = frame.forward[2];
        const fl = Math.hypot(fx, fz) || 1;
        const reach = Math.max(frame.halfW, frame.halfH / pitch) + lean * 0.5 + TILE;
        cx = frame.target[0] - (fx / fl) * lean * 0.5;
        cz = frame.target[2] - (fz / fl) * lean * 0.5;
        tiles = Math.min(maxTiles, Math.ceil((2 * reach) / TILE) + 1);
      }
      const bx = Math.floor(cx / TILE - tiles / 2), bz = Math.floor(cz / TILE - tiles / 2);
      const cap = phone ? WEATHER.capPhone : WEATHER.capDesktop;
      const [rw, gw, bw] = input.grade.tint, [lr, lg, lb] = input.grade.lift;
      const graded = (c: readonly number[]): [number, number, number] => [c[0]! * rw + lr, c[1]! * gw + lg, c[2]! * bw + lb];
      const ink = rgb(PALETTE.ink), paper = rgb(PALETTE.white);
      let any = false;
      for (const [kind, amount] of [['rain', input.rain], ['snow', input.snow]] as const) {
        const p = kind === 'rain' ? rain : snow;
        const on = amount > 0.01;
        p.mesh.visible = on;
        if (!on) continue;
        any = true;
        const n = tiles * tiles * PER;
        // From the first few drops to a downpour: how many fall follows the amount from nothing.
        const want = Math.min(cap, n) * Math.min(1, amount * 1.25);
        const keep = Math.min(1, want / n);
        shown += Math.round(n * keep);
        // The wind carries what falls (snow much less hurriedly); followed smoothly, so a gust does
        // not throw a whole column of flakes sideways at once.
        const d = drift[kind];
        const k = kind === 'rain' ? 2.6 : 0.8;
        const goal = [input.wind.dirX * input.wind.strength * k, input.wind.dirZ * input.wind.strength * k];
        const follow = 1 - Math.exp(-input.dt / (kind === 'rain' ? 0.6 : 3));
        d[0]! += (goal[0]! - d[0]!) * follow;
        d[1]! += (goal[1]! - d[1]!) * follow;
        const u = p.u;
        u.uBase.value.set(bx, bz);
        u.uTiles.value = tiles;
        u.uKeep.value = keep;
        u.uTime.value = input.seconds;
        u.uDrift.value.set(d[0]!, d[1]!);
        u.uView.value.copy(shared.uCanvas.value);
        if (input.pixelRatio !== undefined) u.uPR.value = input.pixelRatio;
        u.uAmount.value = Math.min(1, 0.6 + amount * 0.5);
        u.uRainInk.value = WEATHER.rainInk * (1 - 0.35 * input.night);
        u.uFlakeInk.value = WEATHER.flakeInk;
        // Graphite by day; at night, pale strokes and flakes against the dark page.
        const tint = [rw, gw, bw];
        const streak = ink.map((c, i) => c * 0.55 + [0.42, 0.48, 0.62][i]! * 0.45);
        const pale = [0.82, 0.86, 0.98];
        u.uRainCol.value.set(...graded(streak.map((c, i) => c + (pale[i]! / Math.max(0.2, tint[i]!) - c) * input.night)));
        u.uFlakeCol.value.set(...graded(paper.map((c) => Math.min(1.25, c / Math.max(0.35, 1 - 0.55 * input.night)))));
        u.uRimCol.value.set(...graded(ink.map((c, i) => c + ([0.5, 0.55, 0.7][i]! - c) * 0.35)));
        p.mesh.geometry.setDrawRange(0, Math.min(slots, n) * 6);
      }
      return any;
    },
    dispose() {
      geometry.dispose();
      for (const p of [rain, snow]) {
        p.material.dispose();
        p.twin?.dispose();
      }
    },
  };
}
