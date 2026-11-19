// Paths (J21). A path region is one worn ribbon: 0.7 wide, with rounded ends,
// rounded outer corners, a small fillet in every inner corner, and an edge
// that wanders a little (seeded, smooth, so it never changes between runs).
// Where four cells make a block the path fills it. It lies on whatever it was
// placed on and follows it: beaten earth on the ground, boards along the run
// on a dock, cobbles on a bridge deck or any other block.
//
// What it meets (floor-link features, from J21): at a plaza the path runs to
// the edge and ends in a flush stone kerb; at a door it widens into a
// doorstep; at a garden, a stair or a deck it runs to the edge. Between two
// terrace levels it runs to the edge on both and the carved steps (J17, the
// terrain-steps part) join them.
//
// Reads: the region's cells, the block under each, terrain heights of its
// own and side columns, and its features. Nothing else.

import { below, CELL_H, columnIndex, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { Kind } from '@/core/kinds';
import { styleVersion } from '@/core/style';
import type { Mat4Like } from '@/core/mat4';
import { MAT } from '@/core/world';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { mergeMeshes, MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { groundNoise, lump, mixColor, mound, rngOf, TONE } from '@/parts/ground/kit';
import { FLOOR } from '@/style/ground';
import { PALETTE } from '@/style/palette';
import { DIRS, fan, linksOf, onTerrain, SIDE, stepNeighbour, type LinkVariant } from './sheet';

type Pt = readonly [number, number];

interface Look {
  color: string | [number, number, number];
  pattern: number;
  ink: string;
}

export default defineGenerator({
  kind: 'path',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const cells = new Set(s.cells);
    const links = linksOf(s, plan);
    const seed = plan.world.seed;
    // Each cell is drawn by itself (drawCell reads only what its key below names), so a cell
    // whose key is unchanged since the last build of this region reuses its mesh: an edit
    // beside a long street redraws a cell or two, not the street.
    const version = styleVersion();
    if (version !== cacheStyle) {
      cellCache.clear();
      cacheStyle = version;
    }
    let mine = cellCache.get(s.id);
    if (!mine) {
      if (cellCache.size >= 256) cellCache.delete(cellCache.keys().next().value!);
      cellCache.set(s.id, (mine = { builds: 0, meshes: new Map() }));
    }
    const build = ++mine.builds;
    const meshes: MeshData[] = [];
    for (const cell of s.cells) {
      const link = links.get(cell);
      const same = DIRS.map((d) => cells.has(neighbor(cell, d)));
      const stepped = DIRS.map((d) => stepNeighbour(plan, cells, cell, d, 1) !== NO_CELL || stepNeighbour(plan, cells, cell, d, -1) !== NO_CELL);
      const linked = DIRS.map((d): LinkVariant | undefined => link?.get(d));
      const diag = DIRS.map((A) => {
        const nA = neighbor(cell, A);
        return nA !== NO_CELL && cells.has(neighbor(nA, ((A + 1) % 4) as Dir4));
      });
      const under = plan.kinds.get(below(cell));
      const grass = onTerrain(plan, cell) && plan.terrain.material[columnIndex(keyX(cell), keyZ(cell))] === MAT.grass;
      let bits = 0;
      for (let d = 0; d < 4; d++) bits |= (same[d]! ? 1 : 0) << d | (stepped[d]! ? 1 : 0) << (d + 4) | (diag[d]! ? 1 : 0) << (d + 8);
      const key = `${seed}|${cell}|${bits}|${linked.join(',')}|${under ?? ''}|${grass ? 1 : 0}`;
      let hit = mine.meshes.get(key);
      if (!hit) {
        const b = new MeshBuilder({ ink: s.id });
        drawCell(b, { cell, seed, same, stepped, linked, under, grass, cells });
        mine.meshes.set(key, (hit = { mesh: b.build(), used: build }));
      }
      hit.used = build;
      meshes.push(hit.mesh);
    }
    // Keep what this build and the one before used (a ghost preview builds in between).
    for (const [k, e] of mine.meshes) if (e.used < build - 1) mine.meshes.delete(k);

    // Carved steps, railings and whatever else rules pinned on the region; the links are ours to draw.
    const b = new MeshBuilder({ ink: s.id });
    placeFeatures(b, anchors, s, plan, parts, (f) => (f.type === 'floor-link' ? null : undefined));
    meshes.push(b.build());
    return { mesh: mergeMeshes(meshes), anchors };
  },
});

/** Per path region (by id): its cells' meshes by key, and when each was last used. */
const cellCache = new Map<number, { builds: number; meshes: Map<string, { mesh: MeshData; used: number }> }>();
let cacheStyle = -1;
/** Forgets every remembered cell mesh (tests compare a warm build with a cold one). */
export function forgetPathCells(): void {
  cellCache.clear();
}

interface CellInput {
  cell: CellKey;
  seed: number;
  same: readonly boolean[];
  stepped: readonly boolean[];
  linked: readonly (LinkVariant | undefined)[];
  under: Kind | undefined;
  /** On the terrain top of a grass column. */
  grass: boolean;
  cells: ReadonlySet<CellKey>;
}

/** One cell of a path region: reads only its CellInput (the cells set for its four diagonal neighbours). */
function drawCell(b: MeshBuilder, { cell, seed, same, stepped, linked, under, grass, cells }: CellInput): void {
  const w = 0.5 - FLOOR.pathMargin;
  const R = Math.min(FLOOR.pathRound, w), F = Math.min(FLOOR.pathFillet, FLOOR.pathMargin);
  const wob = FLOOR.pathWobble;
  const warp = (x: number, z: number): Pt => [
    x + (groundNoise(seed ^ 0x3a1, x * 1.7, z * 1.7) - 0.5) * 2 * wob,
    z + (groundNoise(seed ^ 0x7c5, x * 1.7, z * 1.7) - 0.5) * 2 * wob,
  ];
  const x = keyX(cell), z = keyZ(cell);
  const y = keyY(cell) * CELL_H + FLOOR.pathLift;
  const cx = x + 0.5, cz = z + 0.5;
  const open = DIRS.map((d) => same[d]! || stepped[d]! || linked[d] !== undefined);

  // What it lies on decides what it is made of.
  const alongX = (open[1]! || open[3]!) && !(open[0]! || open[2]!);
  const look: Look =
    under === undefined
      ? { color: PALETTE.path, pattern: PATTERN.dirt, ink: 'dirt' }
      : under === 'dock'
        ? { color: mixColor(PALETTE.wood, PALETTE.path, 0.45), pattern: alongX || !(open[0]! || open[2]!) ? PATTERN.planks : PATTERN.planksAcross, ink: 'boards' }
        : { color: PALETTE.stoneShade, pattern: PATTERN.cobbles, ink: 'cobbles' };

  b.with({ color: look.color, pattern: look.pattern, ink: look.ink }, () => {
    // Four quarters, one per corner. In a quarter, u runs from the centre toward side A and v toward side B.
    for (let k = 0; k < 4; k++) {
      const A = k as Dir4, B = ((k + 1) % 4) as Dir4;
      const [ax, az] = SIDE[A]!, [bx, bz] = SIDE[B]!;
      const at = (u: number, v: number, wander: boolean): Pt => {
        const px = cx + ax * u + bx * v, pz = cz + az * u + bz * v;
        return wander ? warp(px, pz) : [px, pz];
      };
      const oA = open[A]!, oB = open[B]!;
      const pts: Pt[] = [];
      if (!oA && !oB) {
        // A rounded outer corner.
        pts.push(at(w, 0, true));
        for (let i = 0; i <= 5; i++) {
          const a = (i / 5) * Math.PI * 0.5;
          pts.push(at(w - R + Math.cos(a) * R, w - R + Math.sin(a) * R, true));
        }
        pts.push(at(0, w, true));
      } else if (oA && !oB) {
        pts.push(at(0.5, 0, false), at(0.5, w, true), at(0.25, w, true), at(0, w, true));
      } else if (!oA && oB) {
        pts.push(at(w, 0, true), at(w, 0.25, true), at(w, 0.5, true), at(0, 0.5, false));
      } else {
        const nA = neighbor(cell, A);
        const diag = nA === NO_CELL ? NO_CELL : neighbor(nA, B);
        if (same[A]! && same[B]! && cells.has(diag)) {
          // Four cells in a block: the path fills the corner.
          pts.push(at(0.5, 0, false), at(0.5, 0.5, false), at(0, 0.5, false));
        } else {
          // An inner corner, with a fillet so the junction reads as one poured path.
          pts.push(at(0.5, 0, false), at(0.5, w, true));
          for (let i = 0; i <= 3; i++) {
            const a = (i / 3) * Math.PI * 0.5;
            pts.push(at(w + F - Math.sin(a) * F, w + F - Math.cos(a) * F, true));
          }
          pts.push(at(w, 0.5, true), at(0, 0.5, false));
        }
      }
      fan(b, [cx, cz], pts, y);
    }

    // A doorstep: the path widens to nearly the whole cell just before the door.
    for (const d of DIRS) {
      if (linked[d] !== 'door') continue;
      const [dx, dz] = SIDE[d]!;
      const tx = -dz, tz = dx;
      const wd = 0.5 - FLOOR.doorMargin, depth = 0.26;
      const p = (along: number, across: number): Pt => [cx + dx * along + tx * across, cz + dz * along + tz * across];
      const apron: Pt[] = [p(0.5, -wd), p(0.5, wd), warp(...p(0.5 - depth * 0.6, wd)), warp(...p(0.5 - depth, wd - 0.1)), warp(...p(0.5 - depth, -wd + 0.1)), warp(...p(0.5 - depth * 0.6, -wd))];
      fan(b, p(0.5 - depth * 0.4, 0), apron, y, true);
    }
  });

  // A flush kerb where the path meets a plaza.
  for (const d of DIRS) {
    if (linked[d] !== 'plaza') continue;
    const [dx, dz] = SIDE[d]!;
    const k = FLOOR.kerb, half = w + 0.06;
    const mx = cx + dx * (0.5 - k / 2), mz = cz + dz * (0.5 - k / 2);
    const ex = Math.abs(dz) * half + Math.abs(dx) * (k / 2), ez = Math.abs(dx) * half + Math.abs(dz) * (k / 2);
    b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'kerb' }, () =>
      b.box([mx - ex, y - FLOOR.pathLift, mz - ez], [mx + ex, keyY(cell) * CELL_H + FLOOR.plazaLift + 0.004, mz + ez], { skip: ['bottom'] }),
    );
  }

  // Grass grows up to a worn path: here and there along its closed sides a clump of grass, a stone or
  // a few flowers. On grass only. Bold little shapes: single blades turn to ink at playing zoom.
  if (under === undefined && grass) {
    const r = rngOf(seed ^ (cell * 2654435761));
    const y0 = keyY(cell) * CELL_H;
    for (const d of DIRS) {
      if (open[d]! || r('verge?', d) > FLOOR.verge) continue;
      const [dx, dz] = SIDE[d]!;
      const along = (r('va', d) - 0.5) * 0.6;
      const vx = cx + dx * (w + 0.085) - dz * along, vz = cz + dz * (w + 0.085) + dx * along;
      const what = r('what', d);
      if (what < 0.55) {
        const size = 0.05 + r('vs', d) * 0.025;
        b.with({ color: mixColor(PALETTE.grassSide, PALETTE.leafDark, 0.45), pattern: PATTERN.none, ink: `verge${cell}:${d}` }, () => {
          mound(b, vx, y0, vz, size, size * 1.1, size, { seg: 6, rings: 2, normal: TONE.lit, twist: along * 9 });
          mound(b, vx + size * 0.9, y0, vz + size * 0.5, size * 0.7, size * 0.8, size * 0.7, { seg: 5, rings: 2, normal: TONE.mid });
        });
      } else if (what < 0.75) {
        b.with({ color: PALETTE.rock, pattern: PATTERN.none, ink: `verge${cell}:${d}` }, () => mound(b, vx, y0, vz, 0.05, 0.035, 0.04, { seg: 5, rings: 2, twist: along * 7 }));
      } else {
        const bloom = [PALETTE.white, PALETTE.yellow, PALETTE.pink][Math.floor(r('vc', d) * 3)]!;
        b.with({ color: mixColor(PALETTE.grassSide, PALETTE.leafDark, 0.45), pattern: PATTERN.none, ink: `verge${cell}:${d}` }, () => mound(b, vx, y0, vz, 0.055, 0.04, 0.055, { seg: 6, rings: 2, normal: TONE.mid }));
        b.with({ color: bloom, pattern: PATTERN.none, ink: `verge${cell}:${d}` }, () => {
          for (let i = 0; i < 3; i++) lump(b, vx + (r('fx', d, i) - 0.5) * 0.08, y0 + 0.045, vz + (r('fz', d, i) - 0.5) * 0.08, 0.022, 0.02, 0.022, { seg: 5, rings: 3, normal: TONE.lit });
        });
      }
    }
  }
}
