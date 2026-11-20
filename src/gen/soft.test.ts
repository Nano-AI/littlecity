// Soft bodies (src/gen/soft.ts): one ink id, and normals that change smoothly everywhere on the body,
// so the pen's crease test (a turn of more than about 30 degrees between neighbouring pixels) cannot fire
// inside it: not across a lump's rings, and not where two lumps meet.

import { describe, expect, test } from 'vitest';
import { inkGroups } from './checks';
import { MeshBuilder, type MeshData } from './mesh';
import { smoothBall, smoothLathe, soft, softenMesh, type SoftBody } from './soft';
import { cloudMesh, popMesh, swearMesh } from '@/parts/people/scuffle-art';
import { bubbleMesh } from '@/parts/people/extras';

const angle = (n: Float32Array, i: number, j: number): number => {
  const d = n[i * 3]! * n[j * 3]! + n[i * 3 + 1]! * n[j * 3 + 1]! + n[i * 3 + 2]! * n[j * 3 + 2]!;
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};

/** The largest angle between the normals two triangles give one point they share (a crease along an edge). */
function worstSharedTurn(m: MeshData): number {
  const at = new Map<string, number[]>();
  const p = m.position;
  for (let v = 0; v < p.length / 3; v++) {
    const k = `${p[v * 3]!.toFixed(5)},${p[v * 3 + 1]!.toFixed(5)},${p[v * 3 + 2]!.toFixed(5)}`;
    (at.get(k) ?? at.set(k, []).get(k)!).push(v);
  }
  let worst = 0;
  for (const vs of at.values()) for (const a of vs) for (const b of vs) worst = Math.max(worst, angle(m.normal, a, b));
  return worst;
}

describe('soft bodies', () => {
  test('a smooth ball has the true normal at every vertex, so no ring shows as a band or a crease', () => {
    const b = new MeshBuilder();
    smoothBall(b, 0, 0, 0, 1, 1, 1, 10, 6);
    const m = b.build();
    for (let v = 0; v < m.position.length / 3; v++) {
      const d = m.position[v * 3]! * m.normal[v * 3]! + m.position[v * 3 + 1]! * m.normal[v * 3 + 1]! + m.position[v * 3 + 2]! * m.normal[v * 3 + 2]!;
      expect(d).toBeCloseTo(1, 5);
    }
    expect(worstSharedTurn(m)).toBeLessThan(0.1);
    // A lathe ball of the same rings is smooth only round its axis: its rings meet at a turn.
    const l = new MeshBuilder();
    const prof: [number, number][] = [];
    for (let i = 0; i <= 6; i++) prof.push([Math.sin((Math.PI * i) / 6), -Math.cos((Math.PI * i) / 6)]);
    l.lathe(prof, { segments: 10 });
    expect(worstSharedTurn(l.build())).toBeGreaterThan(25);
  });

  test('a smooth lathe blends gentle turns of its profile and keeps a sharp rim', () => {
    const b = new MeshBuilder();
    smoothLathe(b, [[0, 0], [0.5, 0.05], [0.6, 0.3], [0.5, 0.6], [0.5, 0.62], [0, 0.62]], { segments: 8, crease: 1.0 });
    const m = b.build();
    // The flat bottom and top meet the side at corners, which stay; between them it is smooth.
    const turns: number[] = [];
    const at = new Map<string, number[]>();
    for (let v = 0; v < m.position.length / 3; v++) {
      const k = `${m.position[v * 3]!.toFixed(5)},${m.position[v * 3 + 1]!.toFixed(5)},${m.position[v * 3 + 2]!.toFixed(5)}`;
      (at.get(k) ?? at.set(k, []).get(k)!).push(v);
    }
    for (const [k, vs] of at) {
      let w = 0;
      for (const a of vs) for (const c of vs) w = Math.max(w, angle(m.normal, a, c));
      const y = Number(k.split(',')[1]);
      if (y > 0.06 && y < 0.61) turns.push(w);
    }
    expect(Math.max(...turns)).toBeLessThan(0.1);
  });

  test('where two lumps meet, the normals either side of the seam agree (no crease), and it is one ink id', () => {
    const b = new MeshBuilder({ ink: 'x' });
    let lumps: SoftBody['lumps'] = [];
    soft(b, { ink: 'body' }, (s) => {
      s.ball(0, 0, 0, 1, 1, 1, 12, 7);
      s.ball(1.2, 0, 0, 0.8, 0.8, 0.8, 12, 7);
      lumps = s.lumps;
    });
    const m = b.build();
    expect(inkGroups(m).size).toBe(1);
    expect(m.inkId[0]).toBe(b.inkOf('body'));
    // Points on each ball's surface, just outside the other, close to where the two surfaces cross
    // (x = 0.7183, the circle of radius 0.6957 there).
    const x = (1 + 1.44 - 0.64) / 2.4, rho = Math.sqrt(1 - x * x);
    const e = 0.01;
    const onA: [number, number, number] = [x - e, Math.sqrt(1 - (x - e) ** 2), 0];
    const onB: [number, number, number] = [x + e, Math.sqrt(0.64 - (x + e - 1.2) ** 2), 0];
    expect(Math.abs(onA[1] - rho)).toBeLessThan(0.02);
    const probe: MeshData = {
      position: new Float32Array([...onA, ...onB, 0, 0, 0]),
      normal: new Float32Array(9),
      color: new Uint8Array(9),
      pattern: new Uint8Array(3),
      inkId: new Uint16Array(3),
      edge: new Float32Array(3),
      sway: new Float32Array(3),
    };
    softenMesh(probe, lumps);
    expect(angle(probe.normal, 0, 1)).toBeLessThan(10);
    // Their own sphere normals there are far apart: the crease the soft field takes away.
    const own = (p: readonly number[], c: number, r: number): number[] => [(p[0]! - c) / r, p[1]! / r, p[2]! / r];
    const a = own(onA, 0, 1), c = own(onB, 1.2, 0.8);
    expect((Math.acos(a[0]! * c[0]! + a[1]! * c[1]! + a[2]! * c[2]!) * 180) / Math.PI).toBeGreaterThan(60);
  });

  test('the scuffle cloud is one outline: its puffs share one ink id (only the motion marks have another)', () => {
    for (const v of [0, 1, 2]) {
      const groups = inkGroups(cloudMesh(v, 0.36, 0.5));
      expect(groups.size).toBe(2);
    }
    // The fist is one soft lump with its cuff.
    expect(inkGroups(popMesh('fist')).size).toBe(2);
  });

  test('a balloon and its tail are one card: one ink id for both, whatever the symbols on it', () => {
    const chat = bubbleMesh();
    expect(inkGroups(chat).size).toBe(2); // the balloon, the dots
    for (const v of [0, 1, 2, 3]) {
      const m = swearMesh(v);
      const ids = new MeshBuilder({ ink: `scuffle-swear-${v}` });
      const balloon = ids.inkOf('bubble');
      // Everything white on it is the balloon (the skull's white is a symbol's, drawn proud of it).
      let white = 0;
      for (let i = 0; i < m.inkId.length; i++) if (m.inkId[i] === balloon) white++;
      expect(white).toBeGreaterThan(100);
    }
  });
});
