// Retaining wall (U07): a coursed stone wall facing a terrain bank beside a
// street or a square, with a coping stone along its top. One piece per cell
// of bank; neighbouring pieces share their ink ids, so a wall is ONE surface
// from end to end with no line at each cell joint.
//
// The terrain rounds the corners of its terraces. A piece therefore follows
// the terrace's outline: straight along the cell line, and at an end that
// turns a corner it bends with the terrain's own radius (`r0`, `r1`), half
// of the bend if the next wall takes the other half, all of it if the wall
// stops there. A wall that stops ends in a pier.
//
// Now and then a piece has a drain hole near its foot, or a creeper hanging
// over the coping.
//
// Frame: an edge slot of the LOW cell on the side the bank is on, +Z away
// from the bank (anchor `face`), +X along it. The cell line is at z = −0.15
// (the slot stands SLOT_INSET from the cell's middle); the wall's face
// stands PROP.wallProud in front of that, on the low ground at y = 0.

import { CELL_H, type Dir4 } from '@/core/grid';
import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { SLOT_INSET } from '@/gen/frames';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PROP } from '@/style/dressing';
import { PALETTE } from '@/style/palette';
import { localTone, lump, mixColor, rngOf, vary } from './kit';

/** Raw ink ids shared by every retaining wall in a town, so adjoining pieces are one surface. */
const INK_WALL = 61001, INK_COPING = 61002, INK_PIER = 61003;

interface Pt {
  /** A point of the terrace outline, and the unit normal toward the low side, in the piece's XZ plane. */
  x: number;
  z: number;
  nx: number;
  nz: number;
}

const ARC = 4;

/**
 * The outline one end contributes, from the end's far point in to where the
 * straight run starts. `side` is −1 for the −X end, +1 for the +X end;
 * `line` is the z of the cell line.
 */
function endOutline(code: number, r: number, side: number, line: number): { pts: Pt[]; pier: boolean } {
  const corner = side * 0.5;
  if (code === 0) return { pts: [{ x: corner, z: line, nx: 0, nz: 1 }], pier: false };
  if (code === 1) return { pts: [{ x: corner, z: line, nx: 0, nz: 1 }], pier: true };
  const out = code === 2 || code === 4;
  const full = code === 4 || code === 5;
  const sweep = (full ? 1 : 0.5) * (Math.PI / 2);
  const cx = corner - side * r, cz = out ? line - r : line + r;
  const pts: Pt[] = [];
  for (let i = ARC; i >= 0; i--) {
    const phi = (i / ARC) * sweep;
    if (out) {
      // Round the outside of the high cell's corner: the normal turns outward with the bend.
      pts.push({ x: cx + side * r * Math.sin(phi), z: cz + r * Math.cos(phi), nx: side * Math.sin(phi), nz: Math.cos(phi) });
    } else {
      // Inside a fillet: the outline bends toward the low cell; the normal points at the arc's centre.
      pts.push({ x: cx + side * r * Math.sin(phi), z: cz - r * Math.cos(phi), nx: -side * Math.sin(phi), nz: Math.cos(phi) });
    }
  }
  return { pts, pier: full };
}

/** A pier at an outline point: a squat stone post standing proud of the wall, with a cap. */
function pier(b: MeshBuilder, p: Pt, h: number, proud: number): void {
  const w = 0.085, d = proud + 0.035, back = 0.05;
  // Its own little frame: t along the wall, n out of it.
  const tx = p.nz, tz = -p.nx;
  const at = (t: number, n: number, y: number): Vec3 => [p.x + tx * t + p.nx * n, y, p.z + tz * t + p.nz * n];
  const box = (t0: number, t1: number, n0: number, n1: number, y0: number, y1: number): void => {
    b.quad(at(t0, n1, y0), at(t1, n1, y0), at(t1, n1, y1), at(t0, n1, y1)); // front
    b.quad(at(t1, n1, y0), at(t1, n0, y0), at(t1, n0, y1), at(t1, n1, y1)); // +t side
    b.quad(at(t0, n0, y0), at(t0, n1, y0), at(t0, n1, y1), at(t0, n0, y1)); // −t side
    b.quad(at(t1, n0, y0), at(t0, n0, y0), at(t0, n0, y1), at(t1, n0, y1)); // back
    b.quad(at(t0, n1, y1), at(t1, n1, y1), at(t1, n0, y1), at(t0, n0, y1)); // top
  };
  box(-w, w, -back, d, 0, h + 0.07);
  box(-w - 0.02, w + 0.02, -back - 0.02, d + 0.02, h + 0.07, h + 0.11);
}

export default definePart({
  prop: 'retaining-wall',
  build(item, ctx) {
    const b = ctx.mesh();
    const p = item.params ?? {};
    const r = rngOf(ctx.seed ^ ((p.look ?? 0) * 9176));
    const h = Math.max(1, p.height ?? 1) * CELL_H;
    const line = -(0.5 - SLOT_INSET);
    const proud = PROP.wallProud, cop = PROP.wallCoping, lip = PROP.wallCopingOut, back = PROP.wallBack;
    const a = endOutline(p.from ?? 0, Math.min(0.5, p.r0 ?? 0.1), -1, line);
    const z = endOutline(p.to ?? 0, Math.min(0.5, p.r1 ?? 0.1), 1, line);
    // The outline from the −X end to the +X end. A straight piece is cut in two so the stone
    // pattern and the tone have a vertex to hang on.
    const spine: Pt[] = [...a.pts, { x: 0, z: line, nx: 0, nz: 1 }, ...[...z.pts].reverse()];

    const stone = vary(PALETTE.stoneShade, 0.5 + (r('tone') - 0.5) * 0.3);
    const at = (q: Pt, n: number, y: number): Vec3 => [q.x + q.nx * n, y, q.z + q.nz * n];
    const nrm = (q: Pt): Vec3 => [q.nx, 0, q.nz];

    // The face.
    b.setColor(stone).setPattern(PATTERN.stone).setInkId(INK_WALL);
    for (let i = 0; i + 1 < spine.length; i++) {
      const s = spine[i]!, e = spine[i + 1]!;
      b.quad(at(s, proud, 0), at(e, proud, 0), at(e, proud, h), at(s, proud, h), { normals: [nrm(s), nrm(e), nrm(e), nrm(s)] });
    }
    // The coping: a slab lying on the wall and the edge of the bank, its nose standing out past the face.
    b.setColor(PALETTE.stone).setPattern(PATTERN.none).setInkId(INK_COPING);
    for (let i = 0; i + 1 < spine.length; i++) {
      const s = spine[i]!, e = spine[i + 1]!;
      const up: Vec3 = [0, 1, 0];
      b.quad(at(s, proud + lip, h + cop), at(e, proud + lip, h + cop), at(e, -back, h + cop), at(s, -back, h + cop), { normals: [up, up, up, up] });
      b.quad(at(s, proud + lip, h), at(e, proud + lip, h), at(e, proud + lip, h + cop), at(s, proud + lip, h + cop), { normals: [nrm(s), nrm(e), nrm(e), nrm(s)] });
      b.quad(at(e, proud, h), at(s, proud, h), at(s, proud + lip, h), at(e, proud + lip, h)); // the nose's underside
      const bs: Vec3 = [-s.nx, 0, -s.nz], be: Vec3 = [-e.nx, 0, -e.nz];
      b.quad(at(e, -back, h), at(s, -back, h), at(s, -back, h + cop), at(e, -back, h + cop), { normals: [be, bs, bs, be] });
    }
    // Piers where the wall stops.
    b.setColor(PALETTE.stone).setPattern(PATTERN.stone).setInkId(INK_PIER);
    if (a.pier) pier(b, spine[0]!, h, proud);
    if (z.pier) pier(b, spine[spine.length - 1]!, h, proud);

    // A drain hole: a dark slot in the bottom course, on the wall's own surface.
    if (p.drain) {
      const x = (r('dx') - 0.5) * 0.4, y0 = 0.07, w = 0.035, hh = 0.07;
      b.setColor(PALETTE.metal).setPattern(PATTERN.none).setInkId(INK_WALL);
      const zf = line + proud + 0.004;
      b.quad([x - w, y0, zf], [x + w, y0, zf], [x + w, y0 + hh, zf], [x - w, y0 + hh, zf], { normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]] });
    }
    // A creeper spilling over the coping and down the face.
    if (p.creeper) {
      const tone = localTone((p.face ?? 2) as Dir4);
      const x = (r('cx') - 0.5) * 0.5;
      const leaf = vary(PALETTE.bush, r('leaf'));
      const zf = line + proud + lip;
      b.with({ pattern: PATTERN.leaves, ink: 'creeper', sway: 0.15 }, () => {
        b.with({ color: leaf }, () => {
          lump(b, x, h + cop + 0.01, zf - 0.06, 0.16, 0.07, 0.11, { seg: 7, rings: 4, normal: tone.lit });
          lump(b, x + 0.03, h - 0.1, zf + 0.012, 0.13, 0.14, 0.05, { seg: 7, rings: 4, normal: tone.lit });
        });
        b.with({ color: mixColor(leaf, PALETTE.leafDark, 0.5) }, () => {
          lump(b, x - 0.05, h - 0.26 - r('drop') * 0.12, zf + 0.008, 0.08, 0.13, 0.045, { seg: 6, rings: 4, normal: tone.mid });
          if (r('more') < 0.5) lump(b, x + 0.12, h - 0.2, zf + 0.008, 0.06, 0.1, 0.04, { seg: 6, rings: 4, normal: tone.mid });
        });
      });
    }
    return { mesh: b.build() };
  },
});
