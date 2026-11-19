// Generated supports (design section 9): what stops a block floating. A
// layer, not a structure: one mesh per chunk, drawn from plan.supports.
//
//   bracket   S2  two console brackets under the block, against the wall
//                 beside it: timber under a house, stone under stone
//   pillar    S3  a stone column from the block's underside down to the
//                 first solid top, with a capital that spreads to carry it;
//                 in the sea it stands on a footing
//   arcade    S4  neighbouring long pillars are joined at the top by arches
//   stilts    S3  four slim timber posts at the cell's corners, braced, when
//                 a tree or a stall stands in the column (nothing is hidden)
//   platform  S3  a pillar that ends in a slab, under a piece that needs
//                 ground to stand on
//
// Supports are never blocks and own no sockets.

import { CELL_H, chunkOf, columnIndex, DIR4, E, keyX, keyY, keyZ, S, SEA_Y, type Chunk } from '@/core/grid';
import { KINDS, type Kind } from '@/core/kinds';
import { compose, rotationY, translation } from '@/core/mat4';
import { hashCombine, hashString } from '@/core/rand';
import { defineLayer } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import type { ShapePlan, Support } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE, RAMPS } from '@/style/palette';
import { drawColumn } from '@/gen/pillar/column';
import { profileSlab } from '@/parts/monuments/slab';

type Vec3 = [number, number, number];

const byChunk = new WeakMap<ShapePlan, Map<number, Support[]>>();
function supportsIn(chunk: Chunk, plan: ShapePlan): Support[] {
  let index = byChunk.get(plan);
  if (!index) {
    index = new Map();
    for (const s of plan.supports) {
      const c = chunkOf(keyX(s.carries), keyZ(s.carries));
      const k = c.cx * 64 + c.cz;
      const list = index.get(k);
      if (list) list.push(s);
      else index.set(k, [s]);
    }
    byChunk.set(plan, index);
  }
  return index.get(chunk.cx * 64 + chunk.cz) ?? [];
}

/** Timber for what is built of timber, stone for the rest. */
function timbered(kind: Kind | undefined): boolean {
  return kind === 'house' || kind === 'windmill' || kind === 'stall' || kind === 'tree' || kind === 'fence' || kind === 'dock';
}

/**
 * One console bracket. Drawn in a frame whose +Z points at the wall: the
 * wall is at z = `wall`, the block's underside is y = 0. `thick` along x.
 */
function consoleBracket(b: MeshBuilder, x: number, wall: number, reach: number, drop: number, thick: number): void {
  // Outline in (z, y): along the underside, then a concave sweep back down to the wall.
  const pts: [number, number][] = [
    [wall, 0],
    [wall - reach, 0],
    [wall - reach, -0.06],
  ];
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push([wall - 0.1 - (reach - 0.1) * Math.cos(a), -0.06 - (drop - 0.12) * Math.sin(a)]);
  }
  pts.push([wall - 0.1, -drop], [wall, -drop]);
  const x0 = x - thick / 2, x1 = x + thick / 2;
  b.polygon([...pts].reverse().map(([z, y]): Vec3 => [x1, y, z]));
  b.polygon(pts.map(([z, y]): Vec3 => [x0, y, z]));
  for (let i = 1; i + 1 < pts.length; i++) {
    const p = pts[i]!, q = pts[i + 1]!;
    b.quad([x1, p[1], p[0]], [x1, q[1], q[0]], [x0, q[1], q[0]], [x0, p[1], p[0]]);
  }
}

/** A timber bracket: a joist under the floor, a post down the wall and a brace between them. */
function timberBracket(b: MeshBuilder, x: number, wall: number, reach: number, drop: number): void {
  const w = 0.075;
  b.box([x - w / 2, -w, wall - reach], [x + w / 2, 0, wall], { skip: ['top'] }); // joist
  b.box([x - w / 2, -drop, wall - w], [x + w / 2, -w, wall], { skip: ['top'] }); // wall post
  // The brace: a slanted bar from the foot of the post to the joist.
  const z0 = wall - w, y0 = -drop + 0.03, z1 = wall - reach + 0.1, y1 = -w;
  const len = Math.hypot(z1 - z0, y1 - y0);
  const nz = (-(y1 - y0) / len) * (w * 0.45), ny = ((z1 - z0) / len) * (w * 0.45);
  const a: Vec3 = [x, y0 - ny, z0 - nz], c: Vec3 = [x, y1 - ny, z1 - nz], d: Vec3 = [x, y1 + ny, z1 + nz], e: Vec3 = [x, y0 + ny, z0 + nz];
  const at = (p: Vec3, dx: number): Vec3 => [p[0] + dx, p[1], p[2]];
  const h = w * 0.4;
  b.quad(at(e, h), at(d, h), at(c, h), at(a, h));
  b.quad(at(a, -h), at(c, -h), at(d, -h), at(e, -h));
  b.quad(at(a, -h), at(a, h), at(c, h), at(c, -h));
  b.quad(at(e, h), at(e, -h), at(d, -h), at(d, h));
}

export const supportsLayer = defineLayer({
  layer: 'supports',
  hash(chunk, plan) {
    let h = hashCombine(0x5e, chunk.cx, chunk.cz);
    for (const s of supportsIn(chunk, plan)) {
      const block = plan.world.blocks.get(s.carries);
      h = hashCombine(h, hashString(s.type), s.carries, s.bottomY, s.against ?? -1);
      for (const d of s.arcadeTo ?? []) h = hashCombine(h, d);
      h = hashCombine(h, hashString(plan.kinds.get(s.carries) ?? ''), block?.color ?? 0, plan.terrain.height[columnIndex(keyX(s.carries), keyZ(s.carries))]!);
    }
    return h;
  },
  build(chunk, plan) {
    // One ink namespace for the whole layer, so an arcade reads as one wall across chunks.
    const b = new MeshBuilder({ ink: 'supports' });
    const stone = RAMPS.stone[1]!;
    for (const s of supportsIn(chunk, plan)) {
      const x = keyX(s.carries), y = keyY(s.carries), z = keyZ(s.carries);
      const kind = plan.kinds.get(s.carries);
      const wood = timbered(kind);
      const id = s.carries;
      const top = y * CELL_H;
      const inWater = s.bottomY === 0 && plan.terrain.height[columnIndex(x, z)] === 0;
      const length = (y - s.bottomY) * CELL_H;

      if (s.type === 'bracket') {
        const [dx, dz] = DIR4[s.against ?? 0]!;
        const needsShelf = kind !== undefined && !KINDS[kind].solid;
        b.at(compose(translation(x + 0.5, top, z + 0.5), rotationY(Math.atan2(dx, dz))), () => {
          const wall = 0.58; // a little past the cell's side, into the wall that carries it
          if (wood) {
            b.with({ color: PALETTE.wood, pattern: PATTERN.none, ink: `br${id}` }, () => {
              for (const bx of [-0.27, 0.27]) timberBracket(b, bx, wall, 0.86, 0.5);
              if (needsShelf) b.box([-0.44, -0.05, -0.44], [0.44, 0, 0.5], { skip: ['bottom'] });
            });
          } else {
            b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: `br${id}` }, () => {
              for (const bx of [-0.27, 0.27]) consoleBracket(b, bx, wall, 0.8, 0.5, 0.15);
              if (needsShelf) b.box([-0.46, -0.06, -0.46], [0.46, 0, 0.5], { skip: ['bottom'] });
            });
          }
        });
        continue;
      }

      if (s.type === 'stilts') {
        const w = MONUMENTS.stiltWidth, o = 0.37;
        b.at(translation(x + 0.5, top, z + 0.5), () =>
          b.with({ color: PALETTE.wood, pattern: PATTERN.none, ink: `st${id}` }, () => {
            for (const [sx, sz] of [[-o, -o], [o, -o], [o, o], [-o, o]] as const) b.boxAt([sx, -length, sz], [w, length, w], { skip: ['bottom', 'top'] });
            // A ring beam under the block, and a tie half-way down a long drop.
            const ties = length > 1.3 ? [0, -length * 0.5] : [0];
            for (const ty of ties) {
              const h = ty === 0 ? w : w * 0.75;
              b.box([-o, ty - h, o - w / 2], [o, ty, o + w / 2], { skip: ['top'] });
              b.box([-o, ty - h, -o - w / 2], [o, ty, -o + w / 2], { skip: ['top'] });
              b.box([o - w / 2, ty - h, -o], [o + w / 2, ty, o], { skip: ['top'] });
              b.box([-o - w / 2, ty - h, -o], [-o + w / 2, ty, o], { skip: ['top'] });
            }
          }),
        );
        continue;
      }

      // pillar and platform
      const arcade = s.type === 'pillar' && (s.arcadeTo?.length ?? 0) > 0;
      const springDrop = Math.min(0.86, length - 0.7); // from the block's underside down to the imposts: deep, so the arches show under the block
      b.at(translation(x + 0.5, s.bottomY * CELL_H, z + 0.5), () => {
        drawColumn(b, {
          height: arcade ? length - springDrop : length,
          radius: MONUMENTS.supportRadius,
          swell: 0.012 + 0.008 * Math.min(y - s.bottomY, 4),
          base: 0.52,
          capital: arcade ? 'impost' : s.type === 'platform' ? 'platform' : 'flared',
          flare: 0.72,
          footing: inWater ? SEA_Y + MONUMENTS.footingRise : 0,
          color: stone,
          shade: PALETTE.stoneShade,
          pattern: PATTERN.stone,
          ink: `p${id}-`,
          segments: 14,
        });
        if (!arcade) return;
        // Above the impost the pillar becomes a square pier that the arches grow out of.
        const half = 0.17, thick = 0.16;
        b.with({ color: stone, pattern: PATTERN.stone, ink: 'arcade' }, () => {
          b.box([-half, length - springDrop, -half], [half, length, half], { skip: ['top', 'bottom'] });
          for (const d of s.arcadeTo ?? []) {
            if (d !== E && d !== S) continue; // each arch is drawn once, from its west or north pillar
            b.at(d === E ? translation(0, 0, 0) : rotationY(-Math.PI / 2), () =>
              profileSlab(b, {
                u0: half, u1: 1 - half, v0: length - springDrop, v1: length, z0: -thick, z1: thick,
                openings: [{ lo: half, hi: 1 - half, spring: springDrop - 0.33 - 0.33, rise: 0.33 }],
                segments: 12,
              }),
            );
          }
        });
      });
    }
    return { mesh: b.build(), anchors: {} };
  },
});
