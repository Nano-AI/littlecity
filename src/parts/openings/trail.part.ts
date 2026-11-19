// Trail (Houses owner; J08). One cell of a worn dirt trail from a door
// toward a floor. It is a mark on the ground, not an object: it shares the
// lawn's own ink group (so no pen line is drawn round it), its edges are
// ragged and fade into the grass colour, its width wanders between 0.25 and
// 0.4, it bends a little on the way, and it thins out at both ends.
//
// Frame: the centre of the ground cell's floor, world axes. `dir` is the way
// the trail runs (away from the door).

import { DIR4, keyX, keyY, keyZ, neighbor, NO_CELL, opposite, type Dir4 } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import { rand } from '@/core/rand';
import { definePart } from '@/gen/api';
import { MeshBuilder, PATTERN } from '@/gen/mesh';
import { mixColor } from '@/style/houses';
import { PALETTE } from '@/style/palette';
import { terraceGrass } from '@/style/terrain';

/** Steps along one cell. */
const N = 6;

export default definePart({
  feature: 'trail',
  build(item, ctx) {
    // The terrain layer's namespace and group for the lawn at this level: the trail is part of that surface.
    const cell = item.cell ?? 0;
    const b = new MeshBuilder({ ink: 'terrain' });
    b.setInk(`ground${keyY(cell)}`).setPattern(PATTERN.dirt);
    const seed = ctx.structure?.seed ?? ctx.seed;
    const dir = (item.dir ?? 2) as Dir4;
    const [ax, az] = DIR4[dir]!;
    // Where this cell is along the whole trail: `before` cells toward the door, `after` toward the floor.
    const mine = new Set<number>();
    for (const f of ctx.plan.featuresByStructure.get(item.structure) ?? []) if (f.type === 'trail' && f.dir === dir && f.cell !== undefined) mine.add(f.cell);
    let before = 0, after = 0;
    for (let c = neighbor(cell, opposite(dir)); c !== NO_CELL && mine.has(c); c = neighbor(c, opposite(dir))) before++;
    for (let c = neighbor(cell, dir); c !== NO_CELL && mine.has(c); c = neighbor(c, dir)) after++;
    const total = before + 1 + after;

    const grass = terraceGrass(keyY(cell));
    const hex = (c: readonly number[]): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    const worn = mixColor(PALETTE.dirt, hex(grass), 0.12);
    const soft = mixColor(PALETTE.dirt, hex(grass), 0.62);
    const faint = mixColor(PALETTE.dirt, hex(grass), 0.86);
    const blend = (c: readonly number[], d: readonly number[], t: number): [number, number, number] => [0, 1, 2].map((i) => Math.round(c[i]! + (d[i]! - c[i]!) * t)) as [number, number, number];

    // Everything is a function of u, the distance from the door end in cells, keyed by the world
    // position of each step so that neighbouring trail cells agree exactly where they meet.
    const bend = (rand(seed, 'trail-bend') < 0.5 ? -1 : 1) * (0.05 + rand(seed, 'trail-bend-amp') * 0.05);
    const cross = ax !== 0 ? keyZ(cell) : keyX(cell);
    const along0 = (ax !== 0 ? keyX(cell) : keyZ(cell)) * N;
    const sign = ax + az; // +1 when the trail runs toward higher coordinates
    const at = (i: number): { mid: number; l: number; r: number; fade: number } => {
      const u = before + i / N;
      const g = along0 + (sign > 0 ? i : N - i); // the world step index
      const wide = 0.125 + 0.075 * (0.5 + 0.5 * Math.sin(g * 0.9 + rand(seed, 'trail-wave', cross) * 6.28));
      const end = Math.min(1, 0.45 + u * 1.6, 0.3 + (total - u) * 1.5); // thinner at the door and where it meets the floor
      const rag = (side: number): number => (rand(seed, 'trail-rag', g, cross, side) - 0.5) * 0.05;
      return {
        mid: bend * Math.sin((Math.PI * u) / total),
        l: wide * end + rag(0),
        r: wide * end + rag(1),
        fade: Math.max(0, Math.min(1, 1 - Math.min(u * 2.2, (total - u) * 2.2))), // 1 right at an end
      };
    };
    const y = 0.005; // under any floor it runs into, so the floor wins cleanly where they overlap
    // A point `s` along the cell (−0.5 … 0.5 from its centre) and `lat` to the left of the direction of travel.
    const P = (s: number, lat: number): Vec3 => [ax * s + az * lat, y, az * s - ax * lat];
    const quad = (p: Vec3, q: Vec3, r: Vec3, t: Vec3, colors: readonly (readonly [number, number, number])[]): void => {
      // Counter-clockwise seen from above, whichever way the trail runs.
      const up = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]);
      if (up > 0) b.quad(p, q, r, t, { colors });
      else b.quad(t, r, q, p, { colors: [colors[3]!, colors[2]!, colors[1]!, colors[0]!] });
    };
    for (let i = 0; i < N; i++) {
      const a = at(i), c = at(i + 1);
      const s0 = -0.5 + i / N, s1 = -0.5 + (i + 1) / N;
      const core0 = blend(worn, soft, a.fade), core1 = blend(worn, soft, c.fade);
      const edge0 = blend(soft, faint, a.fade), edge1 = blend(soft, faint, c.fade);
      // Three strips across: a soft edge, the worn middle, a soft edge.
      quad(P(s0, a.mid + a.l), P(s1, c.mid + c.l), P(s1, c.mid + c.l * 0.5), P(s0, a.mid + a.l * 0.5), [edge0, edge1, core1, core0]);
      quad(P(s0, a.mid + a.l * 0.5), P(s1, c.mid + c.l * 0.5), P(s1, c.mid - c.r * 0.5), P(s0, a.mid - a.r * 0.5), [core0, core1, core1, core0]);
      quad(P(s0, a.mid - a.r * 0.5), P(s1, c.mid - c.r * 0.5), P(s1, c.mid - c.r), P(s0, a.mid - a.r), [core0, core1, edge1, edge0]);
    }
    return { mesh: b.build() };
  },
});
