// L57: what a chapel wears on a wedding day: an arch of white and pink
// flowers over its door, a white bow either side, and garlands of white and
// pink bunting from the arch up the front. Built standing on the doorstep's
// floor at the origin, facing +Z (out of the door, which is behind it at
// −Z); wedding.ts places it. Pure.

import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { FINERY } from '@/style/town-life';
import { PALETTE } from '@/style/palette';

function ball(b: MeshBuilder, x: number, y: number, z: number, r: number, segs = 6): void {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI * (1 - i / 4);
    prof.push([Math.max(0, Math.sin(a) * r), Math.cos(a) * r]);
  }
  b.at([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1], () => b.lathe(prof, { segments: segs }));
}

let arch: MeshData | null = null;

/** The flower arch over the door (0.62 wide, 0.78 tall), with bows and bunting climbing above it. */
export function archMesh(): MeshData {
  if (arch) return arch;
  const b = new MeshBuilder({ ink: 'wedding-arch' }).setPattern(PATTERN.none);
  const half = 0.31, z = -0.36, top = 0.62;
  // The frame: two white posts and a half-round over them.
  b.setInk('frame').setColor(PALETTE.white);
  for (const s of [-1, 1]) b.box([s * half - 0.018, 0, z - 0.018], [s * half + 0.018, top - 0.06, z + 0.018]);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n);
    const x0 = Math.cos(a0) * half, y0 = top - 0.06 + Math.sin(a0) * 0.2;
    const x1 = Math.cos(a1) * half, y1 = top - 0.06 + Math.sin(a1) * 0.2;
    b.quad([x0, y0 - 0.02, z + 0.02], [x1, y1 - 0.02, z + 0.02], [x1, y1 + 0.02, z + 0.02], [x0, y0 + 0.02, z + 0.02]);
  }
  // Leaves and flowers all along it: up the posts and over the top.
  b.setInk('leaves').setColor(PALETTE.leafDark);
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    for (const s of [-1, 1]) ball(b, s * half + s * 0.01, 0.06 + t * (top - 0.12), z + 0.015, 0.04, 5);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (i / n);
    ball(b, Math.cos(a) * half, top - 0.06 + Math.sin(a) * 0.2, z + 0.02, 0.045, 5);
  }
  b.setInk('flowers');
  let k = 0;
  const flower = (x: number, y: number, r: number): void => {
    b.setColor([FINERY.white, FINERY.rose, FINERY.white, FINERY.pink][k++ % 4]!);
    ball(b, x, y, z + 0.05, r, 6);
  };
  for (let i = 0; i <= 8; i++) for (const s of [-1, 1]) flower(s * (half + 0.012), 0.1 + (i / 8) * (top - 0.18), 0.03 + (i % 2) * 0.006);
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (i / 10);
    flower(Math.cos(a) * half, top - 0.06 + Math.sin(a) * 0.2 + 0.01, 0.036);
  }
  // A big white bow at the top, its tails hanging.
  b.setInk('bow').setColor(FINERY.white);
  const by = top + 0.17;
  b.polygon([[0, by, z + 0.08], [-0.1, by + 0.06, z + 0.07], [-0.1, by - 0.05, z + 0.07]]);
  b.polygon([[0, by, z + 0.08], [0.1, by - 0.05, z + 0.07], [0.1, by + 0.06, z + 0.07]]);
  b.polygon([[0, by, z + 0.08], [-0.1, by - 0.05, z + 0.07], [-0.1, by + 0.06, z + 0.07]]);
  b.polygon([[0, by, z + 0.08], [0.1, by + 0.06, z + 0.07], [0.1, by - 0.05, z + 0.07]]);
  b.quad([-0.012, by, z + 0.075], [-0.05, by - 0.2, z + 0.07], [-0.03, by - 0.2, z + 0.07], [0.008, by, z + 0.075]);
  b.quad([0.012, by, z + 0.075], [0.03, by - 0.2, z + 0.07], [0.05, by - 0.2, z + 0.07], [-0.008, by, z + 0.075]);
  b.quad([-0.012, by, z + 0.075], [0.008, by, z + 0.075], [-0.03, by - 0.2, z + 0.07], [-0.05, by - 0.2, z + 0.07]);
  b.quad([0.012, by, z + 0.075], [-0.008, by, z + 0.075], [0.05, by - 0.2, z + 0.07], [0.03, by - 0.2, z + 0.07]);
  ball(b, 0, by, z + 0.085, 0.026, 6);
  // Bunting: two garlands of little flags, from the top of the arch up to the eaves either side.
  b.setInk('bunting');
  for (const s of [-1, 1]) {
    const x0 = 0, y0 = by + 0.02, x1 = s * 0.46, y1 = 1.32;
    const flags = 6;
    for (let i = 0; i < flags; i++) {
      const t0 = (i + 0.15) / flags, t1 = (i + 0.85) / flags;
      const sag = (t: number): number => -Math.sin(t * Math.PI) * 0.12;
      const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0 + sag(t0);
      const cx = x0 + (x1 - x0) * t1, cy = y0 + (y1 - y0) * t1 + sag(t1);
      const mx = (ax + cx) / 2, my = (ay + cy) / 2 - 0.09;
      b.setColor(FINERY.ribbons[i % FINERY.ribbons.length]!);
      b.polygon([[ax, ay, z + 0.06], [mx, my, z + 0.06], [cx, cy, z + 0.06]]);
      b.polygon([[cx, cy, z + 0.06], [mx, my, z + 0.06], [ax, ay, z + 0.06]]);
    }
  }
  arch = b.build();
  return arch;
}
