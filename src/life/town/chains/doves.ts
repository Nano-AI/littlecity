// L57: white doves let go at the chapel door as the couple come out. They
// fly up out of the doorstep, circle high over the couple while the
// procession walks (above the roofs, so they show wherever the door faces
// and from the whole-island view), and when it is over they fly off on the
// wind, out over the sea. Drawn a little larger the further off the camera
// is, like the petals and what people carry. Wings beat on twos.
//
// With no stage (tests) the same flight runs and nothing is drawn.

import type { Mat4 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { airborne } from '@/gen/airborne';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { FINERY } from '@/style/town-life';
import type { InstanceHandle, LifeStage } from '../../api';
import { farScale } from './petals';

interface Dove {
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Its own place in the ring, and its own beat. */
  phase: number;
  beat: number;
  /** Seconds since let go. */
  age: number;
  up: InstanceHandle | null;
  down: InstanceHandle | null;
}

export interface Doves {
  /** Let go from (x, y, z): `n` doves. */
  release(x: number, y: number, z: number, n: number, seed: number): void;
  /** Every frame: where they circle over (null: they fly off), life seconds, and the wind's way. */
  step(dt: number, now: number, over: { x: number; y: number; z: number } | null, wind: { dirX: number; dirZ: number }): void;
  readonly count: number;
  dispose(): void;
}

let meshes: [MeshData, MeshData] | null = null;
/** A dove from above: a white body and two wings, up (a V) or down; facing +Z, wingspan about 0.3. */
function doveMeshes(): [MeshData, MeshData] {
  if (meshes) return meshes;
  const build = (lift: number): MeshData => {
    const b = new MeshBuilder({ ink: 'dove' }).setPattern(airborne(PATTERN.none)).setColor(FINERY.veil);
    b.setInk('body');
    // Body: a long diamond, the tail a fan behind.
    const body: [number, number, number][] = [[0, 0, 0.13], [0.035, 0.01, 0.02], [0, 0.02, -0.08], [-0.035, 0.01, 0.02]];
    b.polygon(body);
    b.polygon([...body].reverse());
    const tail: [number, number, number][] = [[0, 0.01, -0.06], [0.04, 0.01, -0.15], [-0.04, 0.01, -0.15]];
    b.polygon(tail);
    b.polygon([...tail].reverse());
    b.setInk('wings');
    for (const s of [-1, 1]) {
      const w: [number, number, number][] = [[s * 0.02, 0.012, 0.05], [s * 0.16, lift, 0.0], [s * 0.15, lift * 0.9, -0.05], [s * 0.02, 0.012, -0.03]];
      b.polygon(w);
      b.polygon([...w].reverse());
    }
    return b.build();
  };
  meshes = [build(0.09), build(-0.05)];
  return meshes;
}

const m4: Mat4 = new Array<number>(16).fill(0);
function at(x: number, y: number, z: number, yaw: number, bank: number, k: number): Mat4 {
  const c = Math.cos(yaw), s = Math.sin(yaw), cb = Math.cos(bank), sb = Math.sin(bank);
  // Ry(yaw) · Rz(bank) · S(k)
  m4[0] = c * cb * k; m4[1] = sb * k; m4[2] = -s * cb * k; m4[3] = 0;
  m4[4] = -c * sb * k; m4[5] = cb * k; m4[6] = s * sb * k; m4[7] = 0;
  m4[8] = s * k; m4[9] = 0; m4[10] = c * k; m4[11] = 0;
  m4[12] = x; m4[13] = y; m4[14] = z; m4[15] = 1;
  return m4;
}

export function createDoves(stage: LifeStage | null): Doves {
  const doves: Dove[] = [];
  let tick = -1;
  const doves_: Doves = {
    release(x, y, z, n, seed) {
      for (let i = 0; i < n; i++) {
        const [up, down] = stage ? doveMeshes().map((m) => stage.spawnMesh(m, at(x, y, z, 0, 0, 1))) : [null, null];
        down?.setVisible(false);
        doves.push({ x: x + (rand(seed, 'dove-x', i) - 0.5) * 0.3, y: y + 0.4, z: z + (rand(seed, 'dove-z', i) - 0.5) * 0.3, heading: rand(seed, 'dove-h', i) * Math.PI * 2, phase: (i / n) * Math.PI * 2 + rand(seed, 'dove-p', i) * 0.6, beat: 5 + rand(seed, 'dove-b', i) * 3, age: -i * 0.12, up: up ?? null, down: down ?? null });
      }
    },
    step(dt, now, over, wind) {
      for (let i = doves.length - 1; i >= 0; i--) {
        const d = doves[i]!;
        d.age += dt;
        if (d.age < 0) continue;
        let tx: number, ty: number, tz: number;
        if (over) {
          // A wide ring high over them, each at its own place in it, drifting round.
          const a = d.phase + now * 0.45;
          const r = 1.6 + Math.sin(d.phase * 3 + now * 0.3) * 0.4;
          tx = over.x + Math.cos(a) * r;
          tz = over.z + Math.sin(a) * r;
          ty = over.y + Math.min(3.6, 0.8 + d.age * 1.2) + Math.sin(d.phase + now * 1.3) * 0.25;
        } else {
          // Off on the wind, up and away out of the town.
          tx = d.x + wind.dirX * 4 + Math.cos(d.phase) * 0.5;
          tz = d.z + wind.dirZ * 4 + Math.sin(d.phase) * 0.5;
          ty = d.y + 1.2;
        }
        const dx = tx - d.x, dy = ty - d.y, dz = tz - d.z;
        const dist = Math.hypot(dx, dz);
        // Turn toward it, at a dove's turn; fly at a dove's speed.
        let want = Math.atan2(dx, dz) - d.heading;
        want -= Math.round(want / (Math.PI * 2)) * Math.PI * 2;
        const turn = Math.max(-2.2 * dt, Math.min(2.2 * dt, want));
        d.heading += turn;
        const speed = over ? Math.min(2.2, 0.9 + dist * 0.8) : 2.6;
        d.x += Math.sin(d.heading) * speed * dt;
        d.z += Math.cos(d.heading) * speed * dt;
        d.y += Math.max(-1, Math.min(1.5, dy * 1.5)) * dt;
        (d as Dove & { bank?: number }).bank = -turn / Math.max(dt, 1e-3) * 0.25;
        if (!over && (d.age > 60 || d.x < -12 || d.x > 60 || d.z < -12 || d.z > 60)) {
          d.up?.release();
          d.down?.release();
          doves.splice(i, 1);
        }
      }
      const t = Math.floor(now * 15);
      if (t === tick) return;
      tick = t;
      const k = farScale(3);
      for (const d of doves) {
        if (!d.up || !d.down) continue;
        const flap = Math.floor(Math.max(0, d.age) * d.beat) % 2 === 0;
        const m = at(d.x, d.y, d.z, d.heading, (d as Dove & { bank?: number }).bank ?? 0, k);
        (flap ? d.up : d.down).setMatrix(m);
        d.up.setVisible(flap);
        d.down.setVisible(!flap);
      }
    },
    get count() {
      return doves.length;
    },
    dispose() {
      for (const d of doves) {
        d.up?.release();
        d.down?.release();
      }
      doves.length = 0;
    },
  };
  return doves_;
}
