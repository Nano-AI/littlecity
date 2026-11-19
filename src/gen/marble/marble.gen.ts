// Marble (J16): a merged mass draws only the faces that border something
// else, as one seamless surface with soft veins. Where it stands on the
// ground it has a low base course; under every top edge runs a cornice; a
// walkable top is paved inside a marble coping (R-M07, the terrace).
//
// By role: a keep's top edges carry battlements and its walls arrow slits
// (R-M03); a temple has a frieze, pediments with a roof between them, and
// steps at the foot of its pillars (R-M01); a quay wall has bollards, rings
// and stairs to the water (R-M05); a plinth is a pedestal (R-M06).

import { above, below, CELL_H, columnIndex, DIR4, inColumnBounds, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { compose, rotationY, translation, type Mat4Like } from '@/core/mat4';
import { rand } from '@/core/rand';
import { defineGenerator, placeFeature } from '@/gen/api';
import { faceFrame, featureFrame } from '@/gen/frames';
import { MeshBuilder, PATTERN, type BoxFace } from '@/gen/mesh';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE, RAMPS, rampColor } from '@/style/palette';
import { ownSockets } from '@/parts/monuments/kit';
import { bollard, pedestal, pediment, quayStair } from '@/parts/monuments/marble-parts';
import { arrowSlit } from '@/parts/monuments/openings';

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
export function marbleCells(s: Structure, plan: ShapePlan, carved: ReadonlyMap<CellKey, Dir4> = new Map()): MarbleCell[] {
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
      // A neighbour cut into steps leaves this side showing above them, unless this cell is the block
      // the flight climbs to (it is hidden behind the top step) or part of the same flight.
      const steps = n === NO_CELL ? undefined : carved.get(n);
      const beside = steps !== undefined && steps !== d && carved.get(cell) !== steps;
      open.push(n === NO_CELL || !mine.has(n) || beside);
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
    const role = plan.roles.get(s.id)?.role;
    const paved = plan.tags.get(s.id)?.has('top:paved') ?? false;
    const features = plan.featuresByStructure.get(s.id) ?? [];

    if (role === 'plinth' && s.cells.length === 1) {
      const c = s.cells[0]!;
      b.at(translation(keyX(c) + 0.5, keyY(c) * CELL_H, keyZ(c) + 0.5), () => pedestal(b, stone));
      for (const sock of plan.sockets) {
        if (sock.structure === s.id && sock.owner === undefined && sock.type === 'statue-base') anchors[sock.id] = translation(keyX(c) + 0.5, (keyY(c) + 1) * CELL_H, keyZ(c) + 0.5);
      }
      for (const f of features) {
        const at = featureFrame(f);
        if (at) placeFeature(b, anchors, f, at, { plan, structure: s, parts });
      }
      return { mesh: b.build(), anchors };
    }

    const carved = new Map<CellKey, Dir4>();
    for (const f of features) if (f.type === 'broad-steps' && f.cell !== undefined && f.dir !== undefined) carved.set(f.cell, f.dir as Dir4);
    const cells = marbleCells(s, plan, carved);
    const byCell = new Map(cells.map((c) => [c.cell, c] as const));
    const battlements = new Set<number>();
    const stylobates = new Map<CellKey, number>();
    for (const f of features) {
      if (f.type === 'battlement' && f.cell !== undefined && f.dir !== undefined) battlements.add(f.cell * 4 + f.dir);
      if (f.type === 'stylobate' && f.cell !== undefined) stylobates.set(f.cell, (f.params as { depth?: number } | undefined)?.depth ?? 1);
    }
    const temple = role === 'temple';
    const besideSteps = (cell: CellKey, d: number): boolean => {
      const n = neighbor(cell, d as Dir4);
      return n !== NO_CELL && carved.has(n);
    };

    b.setColor(stone).setPattern(PATTERN.marble).setInk('mass');
    for (const c of cells) {
      const x = keyX(c.cell), y = keyY(c.cell) * CELL_H, z = keyZ(c.cell);
      const down = carved.get(c.cell);
      if (down !== undefined) {
        // Broad steps (R-M04): four to the cell, climbing away from `down`. Drawn facing downhill (+z).
        const n = 4, rise = CELL_H / n, run = 1 / n;
        const left = ((down + 3) & 3) as Dir4, right = ((down + 1) & 3) as Dir4;
        const sameFlight = (side: Dir4): boolean => {
          const o = neighbor(c.cell, side);
          return o !== NO_CELL && carved.get(o) === down;
        };
        b.at(compose(translation(x + 0.5, y, z + 0.5), rotationY(Math.atan2(DIR4[down]![0], DIR4[down]![1]))), () => {
          for (let i = 0; i < n; i++) {
            const z1 = 0.5 - i * run, z0 = z1 - run, y0 = i * rise, y1 = y0 + rise;
            b.quad([-0.5, y0, z1], [0.5, y0, z1], [0.5, y1, z1], [-0.5, y1, z1]); // riser
            b.quad([-0.5, y1, z1], [0.5, y1, z1], [0.5, y1, z0], [-0.5, y1, z0]); // tread
          }
          // The cheeks, where the flight's side is open. (In this frame the cell's left side is at +x.)
          const profile: [number, number][] = [[0.5, 0]];
          for (let i = 0; i < n; i++) profile.push([0.5 - i * run, (i + 1) * rise], [0.5 - (i + 1) * run, (i + 1) * rise]);
          profile.push([-0.5, 0]);
          if (c.open[left] && !sameFlight(left)) b.polygon(profile.map(([pz, py]): [number, number, number] => [0.5, py, pz]).reverse());
          if (c.open[right] && !sameFlight(right)) b.polygon(profile.map(([pz, py]): [number, number, number] => [-0.5, py, pz]));
        });
        continue;
      }
      const sides = FACE.filter((_, d) => c.open[d]);
      if (sides.length) b.box([x, y, z], [x + 1, y + CELL_H, z + 1], { only: sides, bevelTop: c.topOpen && MONUMENTS.marbleCornice <= 0 });
      if (!c.topOpen) continue;
      const top = y + CELL_H;
      if (!(paved && c.walkable)) {
        b.box([x, y, z], [x + 1, top, z + 1], { only: ['top'] });
        continue;
      }
      // A paved top inside a marble coping along every edge that drops away.
      const edge = (d: number): boolean => c.open[d]! && !c.flush[d] && !besideSteps(c.cell, d);
      const x0 = x + (edge(3) ? COPING : 0), x1 = x + 1 - (edge(1) ? COPING : 0);
      const z0 = z + (edge(0) ? COPING : 0), z1 = z + 1 - (edge(2) ? COPING : 0);
      b.with({ pattern: PATTERN.paving, color: PALETTE.plaza }, () => b.quad([x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0]));
      if (edge(0)) b.quad([x, top, z0], [x + 1, top, z0], [x + 1, top, z], [x, top, z]);
      if (edge(2)) b.quad([x, top, z + 1], [x + 1, top, z + 1], [x + 1, top, z1], [x, top, z1]);
      if (edge(3)) b.quad([x, top, z1], [x0, top, z1], [x0, top, z0], [x, top, z0]);
      if (edge(1)) b.quad([x1, top, z1], [x + 1, top, z1], [x + 1, top, z0], [x1, top, z0]);
    }

    // A band that runs round the mass through every cell side `has` names, turning outer corners and
    // stopping cleanly at inner ones. `reach` > 0 stands it out from the wall (base course, cornice);
    // `inset` > 0 sets it back on top of the wall instead (a parapet), where its back shows too.
    const band = (has: (c: MarbleCell, d: number) => boolean, y0: (c: MarbleCell) => number, h: number, reach: number, inset = 0): void => {
      const at = (cell: CellKey, d: number): boolean => {
        const c = byCell.get(cell);
        return c !== undefined && has(c, d);
      };
      for (const c of cells) {
        const x = keyX(c.cell), y = keyY(c.cell) * CELL_H, z = keyZ(c.cell);
        for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
          if (!has(c, d)) continue;
          const left = ((d + 3) & 3) as Dir4, right = ((d + 1) & 3) as Dir4;
          // Along the band: does it carry on into the next cell, turn the corner, or run into a wall?
          const end = (side: Dir4): { reach: number; face: boolean } => {
            if (has(c, side)) return { reach, face: inset === 0 }; // an outer corner: this band covers it
            const along = neighbor(c.cell, side);
            if (along !== NO_CELL && mine.has(along)) {
              const ahead = neighbor(along, d);
              return { reach: 0, face: !(at(along, d) || (ahead !== NO_CELL && mine.has(ahead) && inset === 0)) };
            }
            return { reach: 0, face: true };
          };
          const l = end(left), r = end(right);
          // Built facing south (+z), where the band's left end (side d − 1) is at +x; then turned to side d.
          const skip: BoxFace[] = inset > 0 ? ['bottom'] : ['bottom', 'n'];
          if (!l.face) skip.push('e');
          if (!r.face) skip.push('w');
          const yy = y0(c);
          b.at(compose(translation(x + 0.5, y, z + 0.5), rotationY(Math.atan2(DIR4[d]![0], DIR4[d]![1]))), () =>
            b.box([-0.5 - r.reach, yy, 0.5 - inset], [0.5 + l.reach, yy + h, 0.5 + reach], { skip }),
          );
        }
      }
    };
    const out = MONUMENTS.marbleBaseOut, baseH = MONUMENTS.marbleBase;
    if (baseH > 0 && out > 0) {
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'base' }, () => band((c, d) => c.grounded[d]! && !carved.has(c.cell), () => 0, baseH, out));
    }
    const corniceH = MONUMENTS.marbleCornice * (temple ? 1.5 : 1);
    if (corniceH > 0) {
      // A temple's is deeper and darker: its frieze.
      b.with({ color: temple ? PALETTE.stoneShade : stone, pattern: PATTERN.none, ink: 'cornice' }, () =>
        band((c, d) => c.topOpen && c.open[d]! && !c.flush[d] && !carved.has(c.cell) && !besideSteps(c.cell, d), () => CELL_H - corniceH, corniceH, MONUMENTS.marbleCorniceOut),
      );
    }
    if (battlements.size) {
      const wall = 0.11, low = 0.11, merlon = 0.14;
      const has = (c: MarbleCell, d: number): boolean => battlements.has(c.cell * 4 + d);
      b.with({ color: stone, pattern: PATTERN.none, ink: 'battlements' }, () => {
        band(has, () => CELL_H, low, 0, wall);
        // Two merlons to a cell, in step all the way round.
        for (const c of cells) {
          for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
            if (!has(c, d)) continue;
            b.at(compose(translation(keyX(c.cell) + 0.5, (keyY(c.cell) + 1) * CELL_H + low, keyZ(c.cell) + 0.5), rotationY(Math.atan2(DIR4[d]![0], DIR4[d]![1]))), () => {
              for (const mx of [-0.25, 0.25]) b.box([mx - 0.13, 0, 0.5 - wall], [mx + 0.13, merlon, 0.5], { skip: ['bottom'] });
            });
          }
        }
      });
    }
    if (stylobates.size) {
      // Steps at the foot of a temple's pillars: a slab under the whole footprint and a wider tread round it.
      const has = (c: MarbleCell, d: number): boolean => {
        if (!stylobates.has(c.cell)) return false;
        const n = neighbor(c.cell, d as Dir4);
        return n === NO_CELL || !stylobates.has(n);
      };
      const foot = (c: MarbleCell): number => -(stylobates.get(c.cell) ?? 0) * CELL_H;
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'stylobate' }, () => {
        for (const c of cells) {
          if (!stylobates.has(c.cell)) continue;
          const x = keyX(c.cell), z = keyZ(c.cell), y = keyY(c.cell) * CELL_H + foot(c) + 0.11;
          b.quad([x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z]);
        }
        band(has, foot, 0.11, 0.0001);
        band(has, foot, 0.055, 0.14);
      });
    }

    // ── features ──
    const roof = RAMPS.roof[Math.floor(rand(s.seed, 'roof') * RAMPS.roof.length)]!;
    for (const f of features) {
      if (f.type === 'battlement' || f.type === 'stylobate') continue;
      if (f.type === 'broad-steps') {
        // People sit on the second step, facing downhill.
        if (f.cell !== undefined && f.dir !== undefined) ownSockets(plan, anchors, f.id, faceFrame(f.cell, f.dir as Dir4, CELL_H / 2), { seat: translation(0, 0, -0.38) });
        continue;
      }
      const face = f.cell !== undefined && f.dir !== undefined;
      const sub = (): MeshBuilder => new MeshBuilder({ ink: f.id });
      if (f.type === 'arrow-slit' && face) {
        const mb = sub();
        arrowSlit(mb, 'a', PALETTE.stoneShade);
        b.add(mb, faceFrame(f.cell!, f.dir as Dir4, 0.24));
      } else if (f.type === 'pediment' && face) {
        const p = (f.params ?? {}) as { width?: number; offset?: number; depth?: number };
        // The two halves of one temple's roof share their ink groups, so the ridge has no seam in the middle.
        b.at(faceFrame(f.cell!, f.dir as Dir4, CELL_H), () => pediment(b, stone, roof, p.width ?? 1, p.offset ?? 0, p.depth ?? 1));
      } else if (f.type === 'bollard' && face) {
        const mb = sub();
        const at = faceFrame(f.cell!, f.dir as Dir4, CELL_H);
        ownSockets(plan, anchors, f.id, at, bollard(mb));
        b.add(mb, at);
      } else if (f.type === 'quay-stair' && face) {
        const mb = sub();
        quayStair(mb, keyY(f.cell!));
        b.add(mb, faceFrame(f.cell!, f.dir as Dir4));
      } else {
        const at = featureFrame(f);
        if (at) placeFeature(b, anchors, f, at, { plan, structure: s, parts });
      }
    }
    return { mesh: b.build(), anchors };
  },
});
