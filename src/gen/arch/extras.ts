// Role features built onto an arch cell, drawn in the cell's local frame
// (u along the span, t across it from 0 to 1, +Y up from the cell's foot):
// the end posts of a stone bridge and, from tier 2, the portcullis of a
// gatehouse, a sky bridge's covered gallery, a buttress pinnacle and a
// loggia's balustrade.

import { CELL_H, neighbor, NO_CELL, type CellKey } from '@/core/grid';
import { rand } from '@/core/rand';
import { compose, rotationY, translation, type Mat4Like } from '@/core/mat4';
import { MeshBuilder, PATTERN, type ColorInput } from '@/gen/mesh';
import type { Feature, ShapePlan } from '@/resolve/plan';
import { MONUMENTS } from '@/style/monuments';
import { PALETTE, RAMPS } from '@/style/palette';
import { ownSockets } from '@/parts/monuments/kit';
import { openingHeight } from '@/parts/monuments/slab';
import type { ArchCellShape } from './arch.gen';
import { rakeAt } from './rake';

export interface ExtrasEnv {
  plan: ShapePlan;
  stone: ColorInput;
  humped: boolean;
  cells: ReadonlyMap<CellKey, ArchCellShape>;
  /** The structure is a buttress with no pier: a raking half arch. */
  raking: boolean;
}

/** A parapet end post with a little cap. Origin: its foot on the deck. */
function endPost(b: MeshBuilder, stone: ColorInput, height: number): void {
  b.with({ color: stone, pattern: PATTERN.stone, ink: 'post' }, () => b.boxAt([0, -0.1, 0], [0.18, height + 0.1, 0.18], { skip: ['bottom', 'top'] }));
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'post-cap' }, () => {
    b.boxAt([0, height, 0], [0.23, 0.04, 0.23]);
    b.at(compose(translation(0, height + 0.04, 0), rotationY(Math.PI / 4)), () => b.lathe([[0.14, 0], [0, 0.07]], { segments: 4, smooth: false }));
  });
}

/** Draws `f` if it is one of the arch's own features. Returns false for anything else. */
export function archExtras(b: MeshBuilder, anchors: Record<string, Mat4Like>, f: Feature, c: ArchCellShape, env: ExtrasEnv): boolean {
  const H = CELL_H;
  const sub = (name: string): MeshBuilder => new MeshBuilder({ ink: `${f.id}/${name}` });
  switch (f.type) {
    case 'bridge-end': {
      const lo = f.dir === c.dir.lo;
      const u = lo ? 0.09 : 0.91;
      const tall = MONUMENTS.parapet + 0.11;
      const sockets: Record<string, Mat4Like> = {};
      for (const front of [true, false]) {
        const t = front ? 1 - MONUMENTS.parapetThick / 2 + 0.01 : MONUMENTS.parapetThick / 2 - 0.01;
        const mb = sub(front ? 'f' : 'b');
        endPost(mb, env.stone, tall);
        const at = compose(c.frame, translation(u, H, t));
        b.add(mb, at);
        // The lamp stands on the left post at one end and the right at the other.
        if (front === lo) sockets['bridge-end'] = translation(u, H + tall + 0.11, t);
      }
      ownSockets(env.plan, anchors, f.id, c.frame, sockets);
      return true;
    }
    case 'portcullis': {
      const o = c.openings[0];
      if (!o) return true;
      const mb = sub('grille');
      // Bars and cross-bars are one object, hanging in the middle of the passage with their spikes clear of the ground.
      mb.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'grille' }, () => {
        const w = 0.032, foot = 0.2;
        const n = Math.max(2, Math.round((o.hi - o.lo) / 0.115));
        for (let i = 1; i < n; i++) {
          const u = o.lo + ((o.hi - o.lo) * i) / n;
          const top = openingHeight([o], u) - 0.005;
          if (top > foot + 0.05) mb.box([u - w / 2, foot, 0.5 - w / 2], [u + w / 2, top, 0.5 + w / 2], { skip: ['top'] });
        }
        for (const y of [foot + 0.07, foot + 0.27]) {
          if (y > o.spring + o.rise - 0.06) continue;
          // As wide as the opening is at this height.
          const a = (o.hi - o.lo) / 2, cx = (o.lo + o.hi) / 2;
          const half = y <= o.spring ? a : a * Math.sqrt(Math.max(0, 1 - ((y - o.spring) / o.rise) ** 2));
          mb.box([cx - half + 0.01, y - w / 2, 0.5 - w / 2 - 0.004], [cx + half - 0.01, y + w / 2, 0.5 + w / 2 + 0.004]);
        }
      });
      b.add(mb, c.frame);
      // A lantern either side of the opening, on both faces of the gate.
      for (const [t, sgn, name] of [[1, 1, 'f'], [0, -1, 'b']] as const) {
        for (const [u, side] of [[o.lo - 0.1, 'l'], [o.hi + 0.1, 'r']] as const) {
          const lb = sub(`lamp-${name}${side}`);
          lb.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: 'iron' }, () => {
            lb.box([-0.012, 0.1, 0], [0.012, 0.125, 0.07]);
            lb.box([-0.045, 0.085, 0.03], [0.045, 0.1, 0.12], { skip: ['bottom'] });
          });
          lb.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: 'glass' }, () => lb.box([-0.035, 0, 0.04], [0.035, 0.085, 0.11]));
          b.add(lb, compose(c.frame, translation(u, 0.44, t), rotationY(sgn > 0 ? 0 : Math.PI)));
        }
      }
      return true;
    }
    case 'covered-gallery': {
      // A timber gallery along the deck: two walls with a window each, and a little gabled roof.
      const color = RAMPS.wall[((f.params as { color?: number } | undefined)?.color ?? 0) % RAMPS.wall.length]!;
      const seed = env.plan.structures.get(f.structure)?.seed ?? 0;
      const roof = RAMPS.roof[Math.floor(rand(seed, 'roof') * RAMPS.roof.length)]!;
      const covered = (side: 'lo' | 'hi'): boolean => {
        const n = neighbor(c.cell, c.dir[side]);
        return n !== NO_CELL && env.cells.get(n)?.deck === 'covered';
      };
      // Where the gallery meets a house it runs on into the wall; where it joins the next bay there is no end.
      const u0 = covered('lo') ? 0 : -0.1, u1 = covered('hi') ? 1 : 1.1;
      const wallH = 0.46, in0 = 0.07, thick = 0.06, eave = 0.03, rise = 0.3;
      const mb = new MeshBuilder({ ink: f.structure });
      mb.with({ color, pattern: PATTERN.planks, ink: 'gallery' }, () => {
        mb.box([u0, H, 1 - in0 - thick], [u1, H + wallH, 1 - in0], { skip: ['bottom', 'top', 'w', 'e'] });
        mb.box([u0, H, in0], [u1, H + wallH, in0 + thick], { skip: ['bottom', 'top', 'w', 'e'] });
      });
      mb.with({ color: roof, pattern: PATTERN.shingles, ink: 'gallery-roof' }, () => {
        const y0 = H + wallH - 0.02, y1 = H + wallH + rise;
        mb.quad([u0, y0, 1 - eave], [u1, y0, 1 - eave], [u1, y1, 0.5], [u0, y1, 0.5]);
        mb.quad([u1, y0, eave], [u0, y0, eave], [u0, y1, 0.5], [u1, y1, 0.5]);
      });
      b.add(mb, c.frame);
      // One window a side, each its own object so it lights by itself at dusk.
      for (const [t, turn, name] of [[1 - in0, 0, 'f'], [in0, Math.PI, 'b']] as const) {
        const wb = sub(`win-${name}`);
        wb.with({ color: PALETTE.white, pattern: PATTERN.none, ink: 'frame' }, () => wb.box([-0.17, 0, 0], [0.17, 0.27, 0.025], { skip: ['n'] }));
        wb.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'pane' }, () => wb.quad([-0.13, 0.035, 0.03], [0.13, 0.035, 0.03], [0.13, 0.235, 0.03], [-0.13, 0.235, 0.03]));
        b.add(wb, compose(c.frame, translation(0.5, H + 0.11, t), rotationY(turn)));
      }
      return true;
    }
    case 'pinnacle': {
      const mb = sub('pinnacle');
      if (env.raking && c.rake) {
        // On a raking buttress the pinnacle clasps the tip: a pendant hangs below it and a spire stands above.
        const rk = c.rake;
        const u = rk.dir > 0 ? 0.84 : 0.16;
        const at = rakeAt(rk.from + rk.dir * u, rk.len);
        const w = 0.5, foot = at.bottom - 0.1, head = at.top + 0.16;
        mb.with({ color: env.stone, pattern: PATTERN.stone, ink: 'shaft' }, () => mb.boxAt([0, foot, 0], [w, head - foot, w], { skip: ['bottom', 'top'] }));
        mb.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'cap' }, () => {
          mb.boxAt([0, head, 0], [w + 0.07, 0.05, w + 0.07]);
          mb.at(compose(translation(0, head + 0.05, 0), rotationY(Math.PI / 4)), () => mb.lathe([[(w / 2 + 0.01) * Math.SQRT2, 0], [0.09, 0.3], [0, 0.44]], { segments: 4, smooth: false }));
        });
        mb.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'pendant' }, () => {
          mb.boxAt([0, foot - 0.045, 0], [w + 0.06, 0.045, w + 0.06], { skip: ['top'] });
          mb.at(compose(translation(0, foot - 0.045, 0), rotationY(Math.PI / 4)), () => mb.lathe([[0, -0.26], [0.07, -0.2], [(w / 2 - 0.02) * Math.SQRT2, 0]], { segments: 4, smooth: false }));
        });
        b.add(mb, compose(c.frame, translation(u, 0, 0.5)));
        return true;
      }
      // A little spire standing on the rib over its outer end (which rests on a pier).
      const o = c.openings.find((op) => op.hi > 1.001 || op.lo < -0.001);
      const outerHi = o ? o.hi > 1.001 && (o.lo + o.hi) / 2 >= 1 - 1e-6 : true;
      const u = outerHi ? 0.82 : 0.18;
      mb.with({ color: env.stone, pattern: PATTERN.stone, ink: 'shaft' }, () => mb.boxAt([0, 0, 0], [0.3, 0.3, 0.3], { skip: ['bottom', 'top'] }));
      mb.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'cap' }, () => {
        mb.boxAt([0, 0.3, 0], [0.37, 0.05, 0.37]);
        mb.at(compose(translation(0, 0.35, 0), rotationY(Math.PI / 4)), () => mb.lathe([[0.2, 0], [0.07, 0.3], [0, 0.42]], { segments: 4, smooth: false }));
      });
      b.add(mb, compose(c.frame, translation(u, H, 0.5)));
      return true;
    }
    case 'loggia-rail':
      return true; // the balustrade is drawn with the deck's top course
    default:
      return false;
  }
}
