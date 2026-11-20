// L50 · The scuffle's drawings (meshes only; people.system places them):
// the rolling dust cloud, what pops out of it (a fist, a shoe, a hat, a
// star), the bubble of comic swearing over it, and the stars that circle a
// dazed head. All in world units, built round their own middle, sized to
// read at playing zoom (a person is 0.46 tall).

import { multiply, rotationY, rotationZ, scaling, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { rand } from '@/core/rand';
import { PALETTE } from '@/style/palette';

/** A ball: a lathe from the bottom pole to the top. */
function ball(b: MeshBuilder, r: number, segments = 8, rings = 6): void {
  const prof: [number, number][] = [];
  for (let i = 0; i <= rings; i++) {
    const a = Math.PI * (1 - i / rings);
    prof.push([Math.max(0, Math.sin(a) * r), Math.cos(a) * r]);
  }
  b.lathe(prof, { segments });
}

/**
 * The dust cloud: a heap of puffs, each its own ink group so the pen draws
 * every one round. Origin on the ground at its middle. `variant` (0–2)
 * shuffles the heap: shown in turn, on twos, it boils.
 */
export function cloudMesh(variant: number, radius = 0.3, height = 0.5): MeshData {
  const b = new MeshBuilder({ ink: `scuffle-cloud-${variant}` });
  b.setPattern(PATTERN.none);
  const puffs = 11;
  for (let i = 0; i < puffs; i++) {
    const r = (what: string): number => rand(variant + 1, 'puff', what, i);
    const a = (i / puffs) * Math.PI * 2 + r('a') * 0.6;
    const ring = i < 7 ? 1 : 0.45;
    const pr = radius * (0.42 + r('r') * 0.22) * (i < 7 ? 1 : 1.15);
    const y = i < 7 ? pr * 0.9 + r('y') * height * 0.35 : height * 0.55 + r('y') * height * 0.25;
    const x = Math.cos(a) * radius * 0.62 * ring, z = Math.sin(a) * radius * 0.62 * ring;
    b.setInk(`puff${i}`).setColor(i % 3 === 0 ? '#d9c8a4' : i % 3 === 1 ? '#fbf6ea' : '#efe5cf');
    b.at(translation(x, y, z), () => ball(b, pr, 16, 10)); // round enough to read as a soft puff close up
  }
  // Speed lines of dust at the foot: little flat streaks.
  b.setInk('streaks').setColor('#bfae8c');
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.5) / 4) * Math.PI * 2 + variant;
    b.at(rotationY(a), () => b.box([radius * 0.95, 0.005, -0.012], [radius * 1.35, 0.02, 0.012]));
  }
  return b.build();
}

export type PopKind = 'fist' | 'shoe' | 'hat' | 'star';
export const POPS: readonly PopKind[] = ['fist', 'shoe', 'hat', 'star', 'fist'];

/** What pops out of the cloud, pointing out along +Z from its origin. */
export function popMesh(kind: PopKind): MeshData {
  const b = new MeshBuilder({ ink: `scuffle-${kind}` });
  b.setPattern(PATTERN.none);
  switch (kind) {
    case 'fist':
      b.setInk('cuff').setColor(PALETTE.white);
      b.box([-0.03, -0.03, -0.02], [0.03, 0.03, 0.03]);
      b.setInk('fist').setColor('#e9b48d');
      b.at(translation(0, 0, 0.07), () => ball(b, 0.055));
      break;
    case 'shoe':
      b.setInk('shoe').setColor('#4a3328');
      b.box([-0.035, -0.03, -0.02], [0.035, 0.03, 0.12]);
      b.box([-0.035, -0.03, 0.08], [0.035, 0.0, 0.15]);
      b.setInk('sole').setColor('#2b1d17');
      b.box([-0.037, -0.042, -0.02], [0.037, -0.03, 0.15]);
      break;
    case 'hat':
      b.setInk('hat').setColor('#3c3a48');
      b.lathe([[0, 0], [0.085, 0], [0.085, 0.012], [0.05, 0.016], [0.048, 0.07], [0.04, 0.085], [0, 0.088]], { segments: 10 });
      b.setInk('band').setColor(PALETTE.red);
      b.lathe([[0.05, 0.018], [0.049, 0.032]], { segments: 10 });
      break;
    case 'star':
      star(b, 0.075, '#ffd23f', 'star');
      break;
  }
  return b.build();
}

/** A flat five-pointed star facing ±Z, a little thick. */
function star(b: MeshBuilder, r: number, colour: string, ink: string): void {
  b.setInk(ink).setColor(colour);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr, 0]);
  }
  const t = 0.008;
  // Fan from the middle, both faces, and the rim.
  for (let i = 0; i < 10; i++) {
    const p = pts[i]!, q = pts[(i + 1) % 10]!;
    b.tri([0, 0, t], [p[0], p[1], t], [q[0], q[1], t]);
    b.tri([0, 0, -t], [q[0], q[1], -t], [p[0], p[1], -t]);
    b.quad([p[0], p[1], -t], [q[0], q[1], -t], [q[0], q[1], t], [p[0], p[1], t]);
  }
}

/** The little star that circles a dazed head. */
export function dazeStarMesh(): MeshData {
  const b = new MeshBuilder({ ink: 'scuffle-daze' });
  b.setPattern(PATTERN.none);
  star(b, 0.04, '#ffe066', 'daze');
  return b.build();
}

export type Grawlix = 'hash' | 'at' | 'bang' | 'splat' | 'skull' | 'bolt' | 'spiral';
const GRAWLIX: readonly Grawlix[] = ['hash', 'at', 'bang', 'splat', 'skull', 'bolt', 'spiral'];

/** One swearing symbol, about 0.06 tall, in the XY plane at z = 0, facing +Z. */
function symbol(b: MeshBuilder, g: Grawlix): void {
  const d = 0.007;
  const bar = (x0: number, y0: number, x1: number, y1: number): void => {
    b.box([x0, y0, 0], [x1, y1, d]);
  };
  switch (g) {
    case 'hash':
      b.setInk('hash').setColor(PALETTE.ink);
      bar(-0.016, -0.03, -0.007, 0.03);
      bar(0.007, -0.03, 0.016, 0.03);
      bar(-0.027, 0.006, 0.027, 0.015);
      bar(-0.027, -0.015, 0.027, -0.006);
      break;
    case 'bang':
      b.setInk('bang').setColor(PALETTE.red);
      bar(-0.007, -0.008, 0.007, 0.032);
      bar(-0.007, -0.032, 0.007, -0.018);
      break;
    case 'at':
      b.setInk('at').setColor(PALETTE.ink);
      for (let i = 0; i < 10; i++) {
        if (i === 9) continue; // the gap where the tail leaves
        const a = (i / 10) * Math.PI * 2;
        b.at(multiply(translation(Math.cos(a) * 0.024, Math.sin(a) * 0.024, 0), rotationZ(a)), () => bar(-0.005, -0.009, 0.005, 0.009));
      }
      b.at(translation(0, 0, 0), () => bar(-0.008, -0.008, 0.008, 0.008));
      break;
    case 'splat':
      b.setInk('splat').setColor(PALETTE.ink);
      for (let i = 0; i < 3; i++) b.at(rotationZ((i * Math.PI) / 3), () => bar(-0.03, -0.0045, 0.03, 0.0045));
      break;
    case 'skull': {
      b.setInk('skull').setColor('#f7f3ea');
      const head: [number, number, number][] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        head.push([Math.cos(a) * 0.024, 0.006 + Math.sin(a) * 0.022, d]);
      }
      b.polygon(head);
      bar(-0.013, -0.03, 0.013, -0.01);
      b.setInk('eyes').setColor(PALETTE.ink);
      b.at(translation(0, 0, d), () => {
        bar(-0.015, 0.0, -0.004, 0.012);
        bar(0.004, 0.0, 0.015, 0.012);
        bar(-0.002, -0.022, 0.002, -0.012);
      });
      break;
    }
    case 'bolt':
      b.setInk('bolt').setColor('#ffcf26');
      b.polygon([[0.012, 0.034, d], [-0.016, -0.002, d], [0.0, -0.002, d], [-0.012, -0.034, d], [0.018, 0.006, d], [0.002, 0.006, d]]);
      b.polygon([[0.012, 0.034, 0], [0.002, 0.006, 0], [0.018, 0.006, 0], [-0.012, -0.034, 0], [0.0, -0.002, 0], [-0.016, -0.002, 0]]);
      break;
    case 'spiral':
      b.setInk('spiral').setColor(PALETTE.ink);
      for (let i = 0; i < 14; i++) {
        const a = i * 0.75, rr = 0.004 + i * 0.0021;
        b.at(translation(Math.cos(a) * rr, Math.sin(a) * rr, 0), () => bar(-0.0045, -0.0045, 0.0045, 0.0045));
      }
      break;
  }
}

/**
 * The swearing bubble: a flat white balloon with a tail, a row of three big
 * grawlix on its face (+Z) and its back. Origin at the tip of the tail. The
 * people system turns it to face the camera. `variant` picks the row.
 */
export function swearMesh(variant: number): MeshData {
  const b = new MeshBuilder({ ink: `scuffle-swear-${variant}` });
  const rx = 0.26, ry = 0.13, cy = 0.2, t = 0.012;
  b.setInk('bubble').setColor(PALETTE.white).setPattern(PATTERN.none);
  const rim: [number, number][] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    // A little lumpy, like a hand-drawn balloon.
    const k = 1 + 0.05 * Math.sin(a * 5 + variant);
    rim.push([Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  for (let i = 0; i < rim.length; i++) {
    const p = rim[i]!, q = rim[(i + 1) % rim.length]!;
    b.tri([0, cy, t], [p[0], p[1], t], [q[0], q[1], t]);
    b.tri([0, cy, -t], [q[0], q[1], -t], [p[0], p[1], -t]);
    b.quad([p[0], p[1], -t], [q[0], q[1], -t], [q[0], q[1], t], [p[0], p[1], t]);
  }
  // The tail, down to the cloud.
  const tail: [number, number][] = [[-0.05, cy - ry * 0.8], [0.0, 0], [0.04, cy - ry * 0.85]];
  b.tri([tail[0]![0], tail[0]![1], t], [tail[1]![0], tail[1]![1], t], [tail[2]![0], tail[2]![1], t]);
  b.tri([tail[0]![0], tail[0]![1], -t], [tail[2]![0], tail[2]![1], -t], [tail[1]![0], tail[1]![1], -t]);
  const row: Grawlix[] = [];
  for (let i = 0; i < 3; i++) {
    let g = GRAWLIX[Math.floor(rand(variant + 11, 'grawlix', i) * GRAWLIX.length)]!;
    while (row.includes(g)) g = GRAWLIX[(GRAWLIX.indexOf(g) + 1) % GRAWLIX.length]!;
    row.push(g);
  }
  for (const side of [0, Math.PI]) {
    b.at(rotationY(side), () => {
      row.forEach((g, i) => {
        b.at(multiply(translation((i - 1) * 0.15, cy + (i === 1 ? 0.01 : -0.005), t), scaling(2)), () => symbol(b, g));
      });
    });
  }
  return b.build();
}
