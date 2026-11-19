// Marble (J16): a merged mass draws only the faces that border something
// else, as one seamless surface with soft veins and a bevel line under its
// top edges. Where it stands on the ground it has a low base course; a
// walkable top (R-M07, the terrace) is paved inside a marble coping.
//
// Role features (battlements, steps, pediments and the rest) are drawn by
// the parts in src/parts/monuments through the registry.

import { above, below, CELL_H, columnIndex, DIR4, inColumnBounds, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { Mat4Like } from '@/core/mat4';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder, PATTERN, type BoxFace } from '@/gen/mesh';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE, rampColor } from '@/style/palette';

const FACE: readonly BoxFace[] = ['n', 'e', 's', 'w'];
const COPING = 0.07;

export interface MarbleCell {
  cell: CellKey;
  /** Sides with no marble of this structure beside them. */
  open: readonly boolean[];
  /** The top is not covered by this structure. */
  topOpen: boolean;
  /** Nothing at all stands on the top: it can be walked on. */
  walkable: boolean;
  /** Sides where the ground outside is level with the cell's foot (it gets a base course). */
  grounded: readonly boolean[];
  /** Sides where the ground outside is level with the cell's top. */
  flush: readonly boolean[];
}

/** What the generator reads about each cell of a marble mass (all inside the structure hash). */
export function marbleCells(s: Structure, plan: ShapePlan): MarbleCell[] {
  const mine = new Set(s.cells);
  const height = (x: number, z: number): number => (inColumnBounds(x, z) ? plan.terrain.height[columnIndex(x, z)]! : 0);
  return s.cells.map((cell) => {
    const x = keyX(cell), y = keyY(cell), z = keyZ(cell);
    const up = above(cell);
    const down = below(cell);
    const onGround = height(x, z) === y && !mine.has(down);
    const open: boolean[] = [], grounded: boolean[] = [], flush: boolean[] = [];
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const n = neighbor(cell, d);
      const nh = n === NO_CELL ? 0 : height(keyX(n), keyZ(n));
      open.push(n === NO_CELL || !mine.has(n));
      grounded.push(onGround && n !== NO_CELL && !mine.has(n) && nh === y);
      flush.push(n !== NO_CELL && !mine.has(n) && nh === y + 1);
    }
    return { cell, open, topOpen: up === NO_CELL || !mine.has(up), walkable: up === NO_CELL || !plan.kinds.has(up), grounded, flush };
  });
}

export default defineGenerator({
  kind: 'marble',
  build(s, plan, parts) {
    const b = new MeshBuilder({ ink: s.id });
    const anchors: Record<string, Mat4Like> = {};
    const mine = new Set(s.cells);
    const stone = rampColor('marble', s.color);
    const paved = plan.tags.get(s.id)?.has('top:paved') ?? false;
    const cells = marbleCells(s, plan);
    const byCell = new Map(cells.map((c) => [c.cell, c] as const));
    const out = MONUMENTS.marbleBaseOut, baseH = MONUMENTS.marbleBase;

    b.setColor(stone).setPattern(PATTERN.marble).setInk('mass');
    for (const c of cells) {
      const x = keyX(c.cell), y = keyY(c.cell) * CELL_H, z = keyZ(c.cell);
      const sides = FACE.filter((_, d) => c.open[d]);
      if (sides.length) b.box([x, y, z], [x + 1, y + CELL_H, z + 1], { only: sides, bevelTop: c.topOpen });
      if (!c.topOpen) continue;
      const top = y + CELL_H;
      if (!(paved && c.walkable)) {
        b.box([x, y, z], [x + 1, top, z + 1], { only: ['top'] });
        continue;
      }
      // A paved top inside a marble coping along every edge that drops away.
      const edge = (d: number): boolean => c.open[d]! && !c.flush[d];
      const x0 = x + (edge(3) ? COPING : 0), x1 = x + 1 - (edge(1) ? COPING : 0);
      const z0 = z + (edge(0) ? COPING : 0), z1 = z + 1 - (edge(2) ? COPING : 0);
      b.with({ pattern: PATTERN.paving, color: PALETTE.plaza }, () => b.quad([x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0]));
      if (edge(0)) b.quad([x, top, z0], [x + 1, top, z0], [x + 1, top, z], [x, top, z]);
      if (edge(2)) b.quad([x, top, z + 1], [x + 1, top, z + 1], [x + 1, top, z1], [x, top, z1]);
      if (edge(3)) b.quad([x, top, z1], [x0, top, z1], [x0, top, z0], [x, top, z0]);
      if (edge(1)) b.quad([x1, top, z1], [x + 1, top, z1], [x + 1, top, z0], [x1, top, z0]);
    }

    // The base course: one band round the foot of the mass wherever it meets level ground.
    const banded = (cell: CellKey, d: number): boolean => byCell.get(cell)?.grounded[d] ?? false;
    if (baseH > 0 && out > 0) {
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'base' }, () => {
        for (const c of cells) {
          const x = keyX(c.cell), y = keyY(c.cell) * CELL_H, z = keyZ(c.cell);
          for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
            if (!c.grounded[d]) continue;
            const left = ((d + 3) & 3) as Dir4, right = ((d + 1) & 3) as Dir4;
            // Along the band: does it carry on into the next cell, turn the corner, or run into a wall?
            const end = (side: Dir4): { reach: number; face: boolean } => {
              if (c.grounded[side]) return { reach: out, face: true }; // an outer corner: this band covers it
              const along = neighbor(c.cell, side);
              if (along !== NO_CELL && mine.has(along)) {
                const ahead = neighbor(along, d);
                return { reach: 0, face: !(banded(along, d) || (ahead !== NO_CELL && mine.has(ahead))) };
              }
              return { reach: 0, face: true };
            };
            const l = end(left), r = end(right);
            // Built facing south (+z), where the band's left end (side d − 1) is at +x; then turned to side d.
            const skip: BoxFace[] = ['bottom', 'n'];
            if (!l.face) skip.push('e');
            if (!r.face) skip.push('w');
            b.push();
            b.translate(x + 0.5, y, z + 0.5).rotateY(Math.atan2(DIR4[d]![0], DIR4[d]![1]));
            b.box([-0.5 - r.reach, 0, 0.5], [0.5 + l.reach, baseH, 0.5 + out], { skip });
            b.pop();
          }
        }
      });
    }

    placeFeatures(b, anchors, s, plan, parts);
    return { mesh: b.build(), anchors };
  },
});

