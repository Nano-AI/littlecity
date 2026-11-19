// Windows (Houses owner; catalogue J09). One window per facade cell, bold
// enough to read at the zoom the player sees: a trim frame standing proud of
// the wall with its sill, and the pane with its glazing bars. Frame, sill,
// pane and bars are ONE ink group, so a window is outlined once and the bars
// read by colour; that is what keeps a street of windows from turning into
// ink blots when the view zooms out (ART.md section 4).
//
// Frame: the wall plane (see lib.ts). The storey's floor is y = 0 and the
// cell is 1 wide; the 'window' socket is the centre of the sill.

import { CELL_H } from '@/core/grid';
import { translation, type Mat4Like } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { archPts, bar, circlePts, face, personaOf, plate, pointedPts, rectPts, shrink, slab, type P2 } from './lib';

const DEPTH = 0.04;

function glass(b: MeshBuilder, pts: readonly P2[], z: number): void {
  b.with({ color: PALETTE.glass, pattern: PATTERN.glass }, () => face(b, pts, z));
}

export default definePart({
  feature: 'window',
  build(item, ctx) {
    const b = ctx.mesh();
    const p = personaOf(ctx);
    const variant = item.variant ?? 'square';
    // Nothing a person draws is ruler-level: each window sits a hair high or low.
    const y = (item.params?.lift ?? 0) + (ctx.rand('lift') - 0.5) * 0.018;
    const zp = DEPTH + 0.004; // the pane lies just proud of its frame plate
    const zb = zp + 0.003; // and the glazing bars just proud of the pane
    let sill: [number, number, number] = [0, 0.26 + y, 0.08];
    const anchors: Record<string, Mat4Like> = {};
    b.setColor(p.trim).setInk('window');

    const framed = (outline: P2[], border: number, bars: (x0: number, x1: number, y0: number, y1: number) => void): void => {
      plate(b, outline, 0, DEPTH);
      const pane = shrink(outline, border);
      glass(b, pane, zp);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [px, py] of pane) {
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
      bars(x0, x1, y0, y1);
    };
    const sillAt = (w: number, y0: number, out = 0.075): void => {
      slab(b, -w / 2, w / 2, y0 - 0.035, y0, 0, out);
      sill = [0, y0, out];
    };

    if (variant === 'tall') {
      const y0 = 0.2 + y;
      framed(rectPts(0.27, 0.46, y0), 0.04, (x0, x1, a, c) => bar(b, x0, a + (c - a) * 0.52, x1, a + (c - a) * 0.52, 0.022, zb));
      sillAt(0.34, y0);
      slab(b, -0.165, 0.165, y0 + 0.46, y0 + 0.495, 0, 0.06); // a little hood
    } else if (variant === 'arched') {
      const y0 = 0.22 + y;
      framed(archPts(0.3, 0.27, y0), 0.042, (x0, x1, a, c) => {
        bar(b, 0, a, 0, c - 0.004, 0.022, zb);
        bar(b, x0, a + 0.21, x1, a + 0.21, 0.022, zb);
      });
      sillAt(0.37, y0);
    } else if (variant === 'shuttered') {
      const y0 = 0.25 + y;
      framed(rectPts(0.26, 0.37, y0), 0.04, (x0, x1, a, c) => {
        bar(b, 0, a, 0, c, 0.022, zb);
        bar(b, x0, (a + c) / 2, x1, (a + c) / 2, 0.022, zb);
      });
      sillAt(0.3, y0);
      // Shutters: painted boards either side, one hanging a touch askew.
      const droop = (ctx.rand('droop') - 0.5) * 0.02;
      b.with({ color: p.accent, pattern: PATTERN.planks, ink: 'shutters' }, () => {
        slab(b, -0.265, -0.14, y0 + 0.005, y0 + 0.365, 0, 0.026);
        slab(b, 0.14, 0.265, y0 + 0.005 + droop, y0 + 0.365 + droop, 0, 0.026);
      });
    } else if (variant === 'pointed') {
      const y0 = 0.17 + y;
      framed(pointedPts(0.22, 0.3, 0.2, y0), 0.038, (x0, x1, a) => bar(b, x0, a + 0.26, x1, a + 0.26, 0.02, zb));
      sillAt(0.28, y0, 0.06);
    } else if (variant === 'rose' || variant === 'round') {
      // Centred half-way up the storey; the generator moves that point into the gable.
      const r = variant === 'rose' ? 0.135 : 0.105;
      const cy = CELL_H / 2;
      plate(b, circlePts(r, 0, cy, 16), 0, DEPTH);
      const rp = r - (variant === 'rose' ? 0.035 : 0.034);
      glass(b, circlePts(rp, 0, cy, 16), zp);
      const spokes = variant === 'rose' ? 4 : 2;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI + (variant === 'rose' ? Math.PI / 8 : 0);
        bar(b, -Math.cos(a) * rp, cy - Math.sin(a) * rp, Math.cos(a) * rp, cy + Math.sin(a) * rp, 0.018, zb);
      }
      if (variant === 'rose') face(b, circlePts(0.03, 0, cy, 8), zb + 0.002);
      sill = [0, cy - r, DEPTH];
    } else if (variant === 'shopfront') {
      // A wide display window on a panelled stall riser, with a signboard over it.
      const y0 = 0.07 + y * 0.3;
      b.with({ color: p.accent, ink: 'riser' }, () => slab(b, -0.37, 0.37, y0, y0 + 0.13, 0, 0.05));
      framed(rectPts(0.74, 0.39, y0 + 0.13), 0.04, (x0, x1, a, c) => {
        bar(b, x0 + (x1 - x0) / 3, a, x0 + (x1 - x0) / 3, c, 0.022, zb);
        bar(b, x0 + ((x1 - x0) * 2) / 3, a, x0 + ((x1 - x0) * 2) / 3, c, 0.022, zb);
      });
      b.with({ color: p.accent, ink: 'board' }, () => slab(b, -0.4, 0.4, y0 + 0.52, y0 + 0.61, 0, 0.055));
      sill = [0, y0 + 0.13, 0.05];
      anchors['awning-mount'] = translation(0, y0 + 0.61, 0.055);
    } else if (variant === 'bay') {
      // A bay standing out from the wall on a tapered corbel, with its own little roof.
      const y0 = 0.2 + y, w = 0.5, hgt = 0.42, out = 0.13;
      b.with({ ink: 'bay' }, () => {
        slab(b, -w / 2, w / 2, y0, y0 + hgt, 0, out, ['n', 'top']);
        // corbel
        b.quad([-w / 2, y0, out], [-w / 2 + 0.07, y0 - 0.09, 0], [w / 2 - 0.07, y0 - 0.09, 0], [w / 2, y0, out]);
        b.tri([-w / 2, y0, 0], [-w / 2 + 0.07, y0 - 0.09, 0], [-w / 2, y0, out]);
        b.tri([w / 2, y0, out], [w / 2 - 0.07, y0 - 0.09, 0], [w / 2, y0, 0]);
        const zf = out + 0.004;
        glass(b, rectPts(w - 0.09, hgt - 0.1, y0 + 0.05), zf);
        bar(b, -0.075, y0 + 0.05, -0.075, y0 + hgt - 0.05, 0.022, zf + 0.003);
        bar(b, 0.075, y0 + 0.05, 0.075, y0 + hgt - 0.05, 0.022, zf + 0.003);
        // side lights
        b.with({ color: PALETTE.glass, pattern: PATTERN.glass }, () => {
          b.quad([w / 2 + 0.004, y0 + 0.05, out - 0.03], [w / 2 + 0.004, y0 + 0.05, 0.03], [w / 2 + 0.004, y0 + hgt - 0.05, 0.03], [w / 2 + 0.004, y0 + hgt - 0.05, out - 0.03]);
          b.quad([-w / 2 - 0.004, y0 + 0.05, 0.03], [-w / 2 - 0.004, y0 + 0.05, out - 0.03], [-w / 2 - 0.004, y0 + hgt - 0.05, out - 0.03], [-w / 2 - 0.004, y0 + hgt - 0.05, 0.03]);
        });
      });
      b.with({ color: p.roofColor, pattern: PATTERN.shingles, ink: 'bay-roof' }, () => {
        const t = y0 + hgt, e = 0.035;
        b.quad([-w / 2 - e, t, out + e], [w / 2 + e, t, out + e], [w / 2 + e, t + 0.11, 0], [-w / 2 - e, t + 0.11, 0]);
        b.tri([w / 2 + e, t, out + e], [w / 2 + e, t, 0], [w / 2 + e, t + 0.11, 0]);
        b.tri([-w / 2 - e, t, 0], [-w / 2 - e, t, out + e], [-w / 2 - e, t + 0.11, 0]);
      });
      sill = [0, y0, out];
    } else if (variant === 'slit') {
      const y0 = 0.24 + y;
      b.with({ color: PALETTE.stoneShade }, () => plate(b, rectPts(0.12, 0.34, y0), 0, 0.03));
      b.with({ color: PALETTE.metal }, () => face(b, rectPts(0.05, 0.27, y0 + 0.035), 0.034));
      sill = [0, y0, 0.03];
    } else {
      // square: the plain casement with a cross of glazing bars
      const y0 = 0.25 + y;
      framed(rectPts(0.33, 0.37, y0), 0.042, (x0, x1, a, c) => {
        bar(b, 0, a, 0, c, 0.022, zb);
        bar(b, x0, (a + c) / 2, x1, (a + c) / 2, 0.022, zb);
      });
      sillAt(0.4, y0);
    }
    anchors.window = translation(...sill);
    return { mesh: b.build(), anchors };
  },
});
