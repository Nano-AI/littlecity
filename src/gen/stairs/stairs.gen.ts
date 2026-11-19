// Stairs (J18). `Block.rot` is the direction a flight climbs toward (0 N,
// 1 E, 2 S, 3 W); one stairs cell rises one storey over one cell.
//
// A structure is a whole flight: cells side by side are one wide flight (no
// faces and no seams between them), cells continuing one up and one forward
// are one long flight. Each cell is drawn from what surrounds it:
//
//   treads     stone risers, each under a proud tread slab of lighter stone
//              (the nosing); every tread slab of the flight is in ONE ink
//              group. No two treads are quite the same height, and about
//              one in six is worn a tone darker (seeded per row of the
//              flight, so a wide flight's treads run straight through)
//   open side  a stone cheek wall following the slope, standing a little in
//              from the cell edge, with a newel block at the foot and the
//              head of the flight and at each landing
//   a wall or higher ground beside it: no cheek; the treads run a little way
//              into it (a house wall stands 0.07 inside its cell) and their
//              ends are closed, so no slot of daylight shows beside a wall,
//              a round tower or a rounded bank
//   landing    (a `stair-landing` feature) a deep first tread
//   handrail   (a `railing` feature on a stairs cell and one of its sides)
//              a sloped rail on the cheek wall, in the feature's style
//
// The body is solid down to the floor of its cell, so nothing shows through
// under a flight. Reads: the structure, its features, each cell's rot and
// six neighbours and the side columns' terrain. Triangles: about 70 a cell
// bare, up to 150 with cheeks and newels, 400 with handrails on both sides.

import { above, below, CELL_H, DIR4, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, turn, type CellKey, type Dir4 } from '@/core/grid';
import { frame, identity, scaling, type Mat4Like } from '@/core/mat4';
import { hash } from '@/core/rand';
import { defineGenerator, placeFeatures } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { drawSpan } from '@/parts/ground/edge-draw';
import { mixColor, rngOf } from '@/parts/ground/kit';
import type { Feature } from '@/resolve/plan';
import { firm, ROLE_OF_RAIL, type RailVariant } from '@/rules/joinery/edges-lib';
import { FENCE, STAIRS } from '@/style/edges';
import { PALETTE, rampColor } from '@/style/palette';

type Side = 'merged' | 'wall' | 'open';

export default defineGenerator({
  kind: 'stairs',
  build(s, plan, parts) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    const mine = new Set(s.cells);
    const stone = rampColor('stairs', s.color);
    // The tread slabs and their nosings: a lighter stone than the risers.
    const light = mixColor(stone, PALETTE.white, 0.6);
    const landings = new Set<CellKey>();
    const rails = new Map<string, Feature>();
    for (const f of plan.featuresByStructure.get(s.id) ?? []) {
      if (f.cell === undefined || !mine.has(f.cell)) continue;
      if (f.type === 'stair-landing') landings.add(f.cell);
      else if (f.type === 'railing' && f.dir !== undefined) rails.set(`${f.cell}:${f.dir}`, f);
    }
    const sideOf = (cell: CellKey, d: Dir4): Side => {
      const n = neighbor(cell, d);
      if (n !== NO_CELL && mine.has(n)) return 'merged';
      return firm(plan, n) ? 'wall' : 'open';
    };
    const n = Math.max(2, Math.round(STAIRS.steps));
    const riser = CELL_H / n;

    for (const cell of s.cells) {
      const rot = (plan.world.blocks.get(cell)?.rot ?? 0) as Dir4;
      const [dx, dz] = DIR4[rot]!;
      // Local frame: the flight climbs toward −Z; +X is the side turn(rot, 1).
      const local = frame([keyX(cell) + 0.5, keyY(cell) * CELL_H, keyZ(cell) + 0.5], [-dz, 0, dx], [0, 1, 0], [-dx, 0, -dz]);
      const ahead = neighbor(cell, rot);
      const solidAhead = firm(plan, ahead);
      const back = neighbor(cell, opposite(rot));
      const before = back === NO_CELL ? NO_CELL : below(back);
      const pred = before !== NO_CELL && mine.has(before) ? before : NO_CELL;
      const up = ahead === NO_CELL ? NO_CELL : above(ahead);
      const succ = up !== NO_CELL && mine.has(up) ? up : NO_CELL;
      const landing = landings.has(cell);
      const sides: [Dir4, Dir4] = [turn(rot, 3), turn(rot, 1)]; // −X, +X
      const state = sides.map((d) => sideOf(cell, d)) as [Side, Side];
      const edge = (i: 0 | 1): number => (state[i] === 'open' ? 0.5 - STAIRS.inset : 0.5);
      const tread = (i: 0 | 1): number => (state[i] === 'open' ? edge(i) - STAIRS.cheek : state[i] === 'wall' ? 0.5 + STAIRS.into : 0.5);
      // Seeded per row of the flight (its level and its place along the climb), so side-by-side cells agree.
      const tr = rngOf(hash(s.seed, 'row', keyY(cell), rot % 2 === 1 ? keyX(cell) : keyZ(cell)));
      const tops: number[] = [], fronts: number[] = [], backs: number[] = [];
      const xl = -tread(0), xr = tread(1);

      // Tread depths, front to back.
      const depths: number[] = [];
      for (let i = 0; i < n; i++) depths.push(landing ? (i === 0 ? STAIRS.landing : (1 - STAIRS.landing) / (n - 1)) : 1 / n);

      b.at(local, () => {
        let zf = 0.5, under = 0;
        for (let i = 0; i < n; i++) {
          const zb = i === n - 1 ? -0.5 : zf - depths[i]!;
          // The top tread is exact: it meets the floor above. The others are a hair out, as laid stone is.
          const h = (i + 1) * riser + (i < n - 1 ? (tr('h', i) - 0.5) * 2 * STAIRS.uneven : 0);
          const lip = Math.min(STAIRS.nosing, riser * 0.5);
          const zr = zf, low = under;
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'steps' }, () =>
            b.quad([xl, low, zr], [xr, low, zr], [xr, h - lip, zr], [xl, h - lip, zr]),
          );
          const slab = tr('worn', i) < STAIRS.worn ? mixColor(light, PALETTE.stoneShade, 0.75) : light;
          b.with({ color: slab, pattern: PATTERN.none, ink: 'nosing' }, () => {
            const zp = zr + STAIRS.proud * (0.8 + tr('p', i) * 0.4);
            b.quad([xl, h, zp], [xr, h, zp], [xr, h, zb], [xl, h, zb]);
            b.quad([xl, h - lip, zp], [xr, h - lip, zp], [xr, h, zp], [xl, h, zp]);
          });
          tops.push(h);
          fronts.push(zf);
          backs.push(zb);
          under = h;
          zf = zb;
        }
        if (!solidAhead) {
          b.with({ color: stone, pattern: PATTERN.stone, ink: 'steps' }, () => b.quad([xl, 0, -0.5], [xl, CELL_H, -0.5], [xr, CELL_H, -0.5], [xr, 0, -0.5]));
        }

        // The open sides. Drawn for +X; the −X side is its mirror image.
        for (const i of [0, 1] as const) {
          if (state[i] === 'wall') {
            // Against a wall or a bank: the ends of the treads, closed, a little way inside it.
            const xe = tread(i);
            b.at(i === 1 ? identity() : scaling(-1, 1, 1), () =>
              b.with({ color: stone, pattern: PATTERN.stone, ink: 'steps' }, () => {
                for (let k = 0; k < n; k++) b.quad([xe, 0, fronts[k]!], [xe, 0, backs[k]!], [xe, tops[k]!, backs[k]!], [xe, tops[k]!, fronts[k]!]);
              }),
            );
            continue;
          }
          if (state[i] !== 'open') continue;
          const side = sides[i];
          const xo = edge(i), xi = tread(i), xc = (xo + xi) / 2;
          const yf = riser + STAIRS.cheekRise, yb = yf + CELL_H;
          const predOpen = pred !== NO_CELL && sideOf(pred, side) === 'open';
          const succOpen = succ !== NO_CELL && sideOf(succ, side) === 'open';
          const rail = rails.get(`${cell}:${side}`);
          const style = rail ? ROLE_OF_RAIL[(rail.variant ?? 'iron') as RailVariant] ?? 'iron-railing' : undefined;
          const railH = FENCE.postHeight * STAIRS.rail;
          const footNewel = !predOpen || landing;
          const headNewel = !succOpen;
          b.at(i === 1 ? identity() : scaling(-1, 1, 1), () => {
            b.with({ color: stone, pattern: PATTERN.stone, ink: 'cheek' }, () => {
              b.quad([xo, 0, 0.5], [xo, 0, -0.5], [xo, yb, -0.5], [xo, yf, 0.5]);
              b.quad([xi, 0, 0.5], [xi, yf, 0.5], [xi, yb, -0.5], [xi, 0, -0.5]);
              b.quad([xi, yf, 0.5], [xo, yf, 0.5], [xo, yb, -0.5], [xi, yb, -0.5]);
              // Its ends are covered by a newel or by the next cell's cheek, except behind a flight left in mid-air.
              if (!solidAhead && !headNewel) b.quad([xi, 0, -0.5], [xi, CELL_H, -0.5], [xo, CELL_H, -0.5], [xo, 0, -0.5]);
            });
            const w = STAIRS.newel / 2;
            const newel = (zc: number, y0: number, y1: number): void => {
              b.with({ color: stone, pattern: PATTERN.stone, ink: 'newel' }, () => b.box([xc - w, y0, zc - w], [xc + w, y1, zc + w], { skip: ['bottom', 'top'] }));
              b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'newelcap' }, () =>
                b.box([xc - w - 0.02, y1, zc - w - 0.02], [xc + w + 0.02, y1 + 0.04, zc + w + 0.02], { skip: ['bottom'] }),
              );
            };
            if (footNewel) newel(0.5 - w, 0, yf + (style ? railH : STAIRS.newelRise));
            if (headNewel) newel(-0.5 + w, solidAhead ? CELL_H : 0, yb + (style ? railH : STAIRS.newelRise * 0.5));
            if (style) {
              const posts: number[] = [];
              const predRailed = pred !== NO_CELL && rails.has(`${pred}:${side}`);
              if (!footNewel && !predRailed) posts.push(0);
              if (!headNewel) posts.push(1);
              // The handrail climbs along −Z: its own +X.
              b.with({ ink: 'rail' }, () =>
                b.at(frame([xc, yf, 0.5], [0, 0, -1], [0, 1, 0], [1, 0, 0]), () =>
                  drawSpan(b, style, {
                    length: 1,
                    rise: CELL_H,
                    scale: STAIRS.rail,
                    posts,
                    clear: [0, 1],
                    phase: 0,
                    stone,
                    r: rngOf(hash(s.seed, 'rail', cell, side)),
                  }),
                ),
              );
            }
          });
        }
      });
    }
    // Handrails and landings are drawn above. Railings round a stair head (J19) are drawn by their part.
    placeFeatures(b, anchors, s, plan, parts, (f) =>
      f.type === 'stair-landing' || (f.type === 'railing' && f.cell !== undefined && mine.has(f.cell)) ? null : undefined,
    );
    return { mesh: b.build(), anchors };
  },
});
