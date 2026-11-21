// L50 · The scuffle's drawings (meshes only; people.system places them):
// the rolling dust cloud, what pops out of it (a fist, a shoe, a hat, a
// star), the bubble of comic swearing over it, and the stars that circle a
// dazed head. All in world units, built round their own middle, sized to
// read at playing zoom (a person is 0.46 tall).

import { multiply, rotationY, rotationZ, scaling, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { smoothLathe, soft } from '@/gen/soft';
import { tube } from '@/parts/ground/kit';
import { balloon, stroke } from './balloon';
import { rand } from '@/core/rand';
import { PALETTE } from '@/style/palette';

/**
 * The dust cloud: the classic cartoon brawl, ONE rolling lumpy ball of dust (a soft body, src/gen/soft.ts:
 * one ink id and normals that run smoothly across every lump, so the pen draws a single scalloped
 * outline round the whole mass and nothing inside it), with a few motion marks whipping round it.
 * Origin on the ground at its middle. `variant` (0-2) shuffles the lumps: shown in turn, on twos, it
 * boils.
 */
export function cloudMesh(variant: number, radius = 0.3, height = 0.5): MeshData {
  const b = new MeshBuilder({ ink: `scuffle-cloud-${variant}` });
  b.setPattern(PATTERN.none);
  const R = radius, H = height;
  const coreY = H * 0.5, coreR = R * 0.74, coreH = H * 0.4;
  soft(b, { ink: 'cloud', round: 0.7 }, (s) => {
    s.b.setColor(CLOUD[0]);
    s.ball(0, coreY, 0, coreR, coreH, coreR, 12, 7);
    // Lumps all over its face: a ring of big ones round the middle and low down (what rolls along the
    // ground), smaller ones on the shoulders, a couple on top.
    const n = 12;
    for (let i = 0; i < n; i++) {
      const r = (what: string): number => rand(variant + 1, 'lump', what, i);
      const tier = i < 6 ? 0 : i < 10 ? 1 : 2;
      const a = (tier === 0 ? i / 6 : tier === 1 ? (i - 6) / 4 + 0.12 : (i - 10) / 2 + 0.3) * Math.PI * 2 + (r('a') - 0.5) * 0.7;
      const el = tier === 0 ? -0.15 + r('e') * 0.35 : tier === 1 ? 0.55 + r('e') * 0.3 : 1.05 + r('e') * 0.3;
      const lr = R * (tier === 0 ? 0.4 + r('r') * 0.14 : tier === 1 ? 0.32 + r('r') * 0.1 : 0.27 + r('r') * 0.08);
      const ce = Math.cos(el), se = Math.sin(el);
      const x = Math.cos(a) * ce * coreR * 0.86, z = Math.sin(a) * ce * coreR * 0.86;
      const y = Math.max(lr * 0.85, coreY + se * coreH * 0.86);
      // Paler on top, where the light catches it.
      s.b.setColor(tier === 2 || (tier === 1 && r('c') < 0.5) ? CLOUD[1] : CLOUD[0]);
      s.ball(x, y, z, lr, lr * 0.9, lr, 12, 7);
    }
  });
  // Motion marks: a few short curved strokes of ink whipping round the cloud.
  b.setInk('marks').setColor(PALETTE.ink);
  for (let i = 0; i < 4; i++) {
    const r = (what: string): number => rand(variant + 1, 'mark', what, i);
    const a0 = (i / 4) * Math.PI * 2 + r('a') * 0.8, span = 0.8 + r('s') * 0.4;
    const y = H * (0.25 + 0.55 * ((i * 0.37 + r('y') * 0.3) % 1));
    const rr = R * (1.22 + r('o') * 0.12);
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 6; k++) {
      const t = a0 + (span * k) / 6;
      pts.push([Math.cos(t) * rr, y + (k / 6 - 0.5) * H * 0.08 * (i % 2 ? 1 : -1), Math.sin(t) * rr]);
    }
    tube(b, pts, [0.0035, 0.006, 0.007, 0.007, 0.006, 0.005, 0.003], { seg: 4 });
  }
  return b.build();
}

/** The dust's two tones: the body of it, and paler lumps on top. */
const CLOUD = ['#efe4cc', '#faf5ea'] as const;

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
      // The fist: knuckles and a thumb as one soft lump, the cuff a line of its own.
      soft(b, { ink: 'fist' }, (s) => {
        s.b.setColor('#e9b48d');
        s.ball(0, 0, 0.075, 0.05, 0.046, 0.058, 12, 7);
        s.ball(0.034, 0.012, 0.06, 0.022, 0.02, 0.03, 8, 5);
      });
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
      smoothLathe(b, [[0, 0], [0.085, 0], [0.085, 0.012], [0.05, 0.016], [0.048, 0.07], [0.04, 0.085], [0, 0.088]], { segments: 14, crease: 0.9 });
      b.setInk('band').setColor(PALETTE.red);
      b.lathe([[0.05, 0.018], [0.049, 0.032]], { segments: 14 });
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
    case 'at': {
      // One unbroken stroke: the little bowl, up its stem and round the big ring nearly closed.
      b.setInk('at').setColor(PALETTE.ink);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 14; i++) {
        const a = -0.3 + (i / 14) * Math.PI * 2;
        pts.push([0.003 + Math.cos(a) * 0.009, Math.sin(a) * 0.01]);
      }
      pts.push([0.013, -0.006], [0.017, -0.011], [0.022, -0.01]);
      for (let i = 0; i <= 18; i++) {
        const a = -0.35 + (i / 18) * (Math.PI * 2 - 0.5);
        pts.push([Math.cos(a) * 0.027, Math.sin(a) * 0.027]);
      }
      stroke(b, pts, 0.0065, d);
      break;
    }
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
    case 'spiral': {
      b.setInk('spiral').setColor(PALETTE.ink);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const a = i * 0.32, rr = 0.003 + i * 0.00068;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      stroke(b, pts, 0.0065, d);
      break;
    }
  }
}

/**
 * The swearing bubble: a clean rounded balloon and its tail cut from one outline (balloon.ts: one line
 * round both, no seam, no facets), a row of three big grawlix on its face (+Z) and its back. Origin at
 * the tip of the tail. The people system turns it to face the camera. `variant` picks the row and
 * leans the tail.
 */
export function swearMesh(variant: number): MeshData {
  const b = new MeshBuilder({ ink: `scuffle-swear-${variant}` });
  const rx = 0.27, ry = 0.135, cy = 0.215, t = 0.01;
  b.setInk('bubble').setColor(PALETTE.white).setPattern(PATTERN.none);
  const lean = variant % 2 ? -1 : 1;
  balloon(b, { rx, ry, cy, t, left: -Math.PI / 2 - 0.3 + lean * 0.12, right: -Math.PI / 2 + 0.05 + lean * 0.12, tipX: -lean * 0.07, bow: lean * 0.03, segments: 40, wobble: 0.025, seed: variant });
  const row: Grawlix[] = [];
  for (let i = 0; i < 3; i++) {
    let g = GRAWLIX[Math.floor(rand(variant + 11, 'grawlix', i) * GRAWLIX.length)]!;
    while (row.includes(g)) g = GRAWLIX[(GRAWLIX.indexOf(g) + 1) % GRAWLIX.length]!;
    row.push(g);
  }
  for (const side of [0, Math.PI]) {
    b.at(rotationY(side), () => {
      row.forEach((g, i) => {
        b.at(multiply(translation((i - 1) * 0.155, cy + (i === 1 ? 0.012 : -0.006), t + 0.001), scaling(2)), () => symbol(b, g));
      });
    });
  }
  return b.build();
}
