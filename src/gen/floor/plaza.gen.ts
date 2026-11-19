// Plazas (J21, J22). A plaza region is one low stone slab: paved one tile to
// a grid cell (the paving pattern shows the build grid on purpose), its
// outer corners eased, its edge a short stone face so it reads as laid on
// the ground rather than painted there. One ink group for the whole region.
//
// J22 adds, by feature: a border course along the region's outer edge, and a
// radial centre motif (rings and a star) in a region big enough to hold one.
//
// Reads: the region's cells and its features. Nothing else.

import { CELL_H, keyX, keyY, keyZ, neighbor, type CellKey, type Dir4 } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import type { Feature } from '@/resolve/plan';
import { FLOOR } from '@/style/ground';
import { PALETTE } from '@/style/palette';
import { cellSlab, DIRS, fan, SIDE, upTri } from './sheet';

type Pt = readonly [number, number];

/** A flat ring between two radii, as up-facing quads. */
function ring(b: MeshBuilder, cx: number, cz: number, r0: number, r1: number, y: number, seg: number): void {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (r: number, a: number): [number, number, number] => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    upTri(b, p(r0, a0), p(r1, a0), p(r1, a1));
    upTri(b, p(r0, a0), p(r1, a1), p(r0, a1));
  }
}

/** The centre motif: a stone ring, a pale disc, a darker ring and (compass) an eight-pointed star. */
function motif(b: MeshBuilder, f: Feature, y: number): void {
  const size = (f.params as { size?: number } | undefined)?.size ?? 5;
  const cell = f.cell!;
  const even = size % 2 === 0;
  const cx = keyX(cell) + (even ? 1 : 0.5), cz = keyZ(cell) + (even ? 1 : 0.5);
  const R = Math.min(size * 0.34, 2.4);
  const seg = 28;
  // All in the plaza's own ink group and all facing up: colour only, no lines of their own.
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.cobbles }, () => ring(b, cx, cz, R * 0.86, R, y, seg));
  b.with({ color: PALETTE.sand, pattern: PATTERN.none }, () => ring(b, cx, cz, R * 0.5, R * 0.86, y, seg));
  b.with({ color: PALETTE.brick, pattern: PATTERN.none }, () => ring(b, cx, cz, R * 0.42, R * 0.5, y, seg));
  b.with({ color: PALETTE.stone, pattern: PATTERN.none }, () => {
    const disc: Pt[] = [];
    for (let i = 0; i < seg; i++) disc.push([cx + Math.cos((i / seg) * Math.PI * 2) * R * 0.42, cz + Math.sin((i / seg) * Math.PI * 2) * R * 0.42]);
    fan(b, [cx, cz], disc, y, true);
  });
  if (f.variant !== 'rings') {
    // The star: eight points, long ones on the grid axes, in two tones so it reads as folded.
    const yy = y + 0.003;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = R * (i % 2 === 0 ? 0.8 : 0.56), half = R * 0.11;
      const tip: [number, number, number] = [cx + Math.cos(a) * len, yy, cz + Math.sin(a) * len];
      const l: [number, number, number] = [cx + Math.cos(a + Math.PI / 2) * half, yy, cz + Math.sin(a + Math.PI / 2) * half];
      const r: [number, number, number] = [cx - Math.cos(a + Math.PI / 2) * half, yy, cz - Math.sin(a + Math.PI / 2) * half];
      b.with({ color: PALETTE.white, pattern: PATTERN.none }, () => upTri(b, [cx, yy, cz], l, tip));
      b.with({ color: PALETTE.yellow, pattern: PATTERN.none }, () => upTri(b, [cx, yy, cz], tip, r));
    }
  }
}

export default defineGenerator({
  kind: 'plaza',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    const cells = new Set<CellKey>(s.cells);
    const features = plan.featuresByStructure.get(s.id) ?? [];
    const bordered = features.some((f) => f.type === 'plaza-border');
    b.setInk('plaza');
    for (const cell of s.cells) {
      const y0 = keyY(cell) * CELL_H, y1 = y0 + FLOOR.plazaLift;
      const inRegion = (d: Dir4): boolean => cells.has(neighbor(cell, d));
      b.with({ color: PALETTE.plaza, pattern: PATTERN.paving }, () => cellSlab(b, cell, inRegion, { y0, y1, round: FLOOR.plazaRound }));
      if (!bordered) continue;
      // The border course: a band of darker setts along each side where the region ends, a hair above the paving.
      const x = keyX(cell), z = keyZ(cell);
      const w = FLOOR.plazaBorder, e = 0.012, yy = y1 + 0.002;
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.cobbles }, () => {
        for (const d of DIRS) {
          if (inRegion(d)) continue;
          const [dx, dz] = SIDE[d]!;
          // Run the band the whole side; at a corner shared with another closed side, stop short so the two do not overlap.
          const left = inRegion(((d + 3) % 4) as Dir4) ? 0 : w + e, right = inRegion(((d + 1) % 4) as Dir4) ? 0 : e;
          const cx = x + 0.5, cz = z + 0.5;
          const tx = -dz, tz = dx; // along the side, from its "left" end to its "right" end seen from inside
          const p = (along: number, out: number): [number, number, number] => [cx + tx * along + dx * out, yy, cz + tz * along + dz * out];
          const a = -0.5 + left, c = 0.5 - right;
          upTri(b, p(a, 0.5 - e), p(c, 0.5 - e), p(c, 0.5 - e - w));
          upTri(b, p(a, 0.5 - e), p(c, 0.5 - e - w), p(a, 0.5 - e - w));
        }
        // Where the region turns an inner corner, the two bands meet in this cell's corner.
        for (let k = 0; k < 4; k++) {
          const A = k as Dir4, B = ((k + 1) % 4) as Dir4;
          if (!inRegion(A) || !inRegion(B) || cells.has(neighbor(neighbor(cell, A), B))) continue;
          const [ax, az] = SIDE[A]!, [bx, bz] = SIDE[B]!;
          const q = (u: number, v: number): [number, number, number] => [x + 0.5 + ax * u + bx * v, yy, z + 0.5 + az * u + bz * v];
          const lo = 0.5 - e - w;
          upTri(b, q(lo, lo), q(0.5, lo), q(0.5, 0.5));
          upTri(b, q(lo, lo), q(0.5, 0.5), q(lo, 0.5));
        }
      });
    }
    for (const f of features) if (f.type === 'plaza-motif' && f.cell !== undefined) motif(b, f, keyY(f.cell) * CELL_H + FLOOR.plazaLift + 0.002);
    placeFeatures(b, anchors, s, plan, parts, (f) => (f.type === 'floor-link' || f.type === 'plaza-border' || f.type === 'plaza-motif' ? null : undefined));
    return { mesh: b.build(), anchors };
  },
});
