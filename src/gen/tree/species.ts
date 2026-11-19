// The plants (R-P01). Each function draws one plant standing on the local
// origin, from a seeded `r`, into ink groups 'trunk' and 'crown' (plus a few
// of its own). Not a generator file: tree.gen.ts picks the species from the
// structure's role and places it; gardens borrow the bushes.
//
// How a crown is drawn (docs/swarm/ART.md and src/parts/ground/kit.ts):
// a crown is a few lumps, each ONE flat tone. The lumps facing the sun share
// the lit tone, so they melt into one light mass with a scalloped outline;
// the lumps underneath and on the far side share the shade tone, which the
// renderer hatches. So a tree reads as a pen outline, a light mass and a
// scribbled shadow, the way the reference illustrations draw them, and not
// as a pile of shaded balls. All lumps must be emitted in world axes
// (translation and uniform scale only): the tones are world directions.

import type { Vec3 } from '@/core/mat4';
import { PATTERN, type MeshBuilder, type SwayInput } from '@/gen/mesh';
import { dab, lump, mixColor, mound, SHADE_SIDE, SUN, TONE, tube, tuft, vary, type Rgb, type Rng } from '@/parts/ground/kit';
import { TREE } from '@/style/ground';
import { PALETTE } from '@/style/palette';

/** Wind weight rising from 0 at the foot to TREE.sway at `top` (the trunk bends, the crown rides it). */
function swayTo(top: number): SwayInput {
  return (_x, y) => {
    const t = Math.max(0, Math.min(1, y / top));
    return t * t * TREE.sway;
  };
}

function trunk(b: MeshBuilder, r: Rng, points: readonly Vec3[], radius: number, sway: SwayInput, color: Rgb = vary(PALETTE.trunk, r('trunk'), 0.6)): void {
  const radii = points.map((_p, i) => radius * (1 - (i / (points.length - 1)) * 0.3));
  // A leaning trunk's foot ring is tilted: sink it a little so no edge of it lifts off the ground.
  const rooted = points.map((p, i): Vec3 => (i === 0 ? [p[0], p[1] - 0.025, p[2]] : p));
  b.with({ color, pattern: PATTERN.bark, ink: 'trunk', sway }, () => tube(b, rooted, radii, { seg: 6 }));
}

interface CloudOptions {
  x: number;
  y: number;
  z: number;
  /** Radius of the core, and its height as a share of it. */
  R: number;
  squash: number;
  color: Rgb;
  sway: SwayInput;
  /** Scallop lumps on the lit side. */
  lumps?: number;
  ink?: string;
}

/**
 * A crown: a light mass with a scalloped outline, a hatched shadow under it,
 * and darker scallops round its lower flanks (half tone to the south, shade
 * to the east, north and west), so every quarter of the orbit sees some.
 */
function cloud(b: MeshBuilder, r: Rng, o: CloudOptions): void {
  const { x, y, z, R } = o;
  const ry = R * o.squash;
  const n = o.lumps ?? TREE.lumps;
  const ink = o.ink ?? 'crown';
  const shadeColor = mixColor(o.color, PALETTE.leafDark, TREE.shadeMix);
  const twist = r('tw') * 6;
  const scallop = (a: number, d: number, cy: number, rr: number, tone: Vec3, key: string): void => {
    const dx = Math.cos(a), dz = Math.sin(a);
    const out = Math.hypot(d, cy - y) || 1;
    lump(b, x + dx * d, cy, z + dz * d, rr, rr * 0.85, rr, { seg: 8, rings: 4, normal: tone, twist: r(key) * 6, facing: [(dx * d) / out, (cy - y) / out, (dz * d) / out], cut: -0.3 });
  };
  b.with({ color: o.color, pattern: PATTERN.leaves, ink, sway: o.sway }, () => {
    lump(b, x, y, z, R, ry, R, { seg: 12, rings: 6, normal: TONE.lit, twist, facing: [0, 1, 0], cut: -0.62 });
    const a0 = r('a0') * 6.28;
    for (let j = 0; j < n; j++) {
      const a = a0 + (j * 6.28) / n + (r('ja', j) - 0.5) * 0.9;
      scallop(a, R * (0.5 + r('jd', j) * 0.25), y + ry * (0.25 + r('jy', j) * 0.45), R * (0.48 + r('jr', j) * 0.2), TONE.lit, `jt${j}`);
    }
    // The south flank: a half-tone scallop, low.
    scallop(1.7 + (r('ma') - 0.5) * 0.9, R * 0.62, y - ry * (0.2 + r('my') * 0.2), R * (0.44 + r('mr') * 0.12), TONE.mid, 'mt');
  });
  b.with({ color: shadeColor, pattern: PATTERN.leaves, ink, sway: o.sway }, () => {
    // The shadow under the crown: a belly that swells out of the core's lower half, a little toward the
    // shade side, so it shows as a dark rim below and a crescent on the far flank. It meets the core at
    // a steep angle and shares its facets, which keeps the line between light and shade an even curve.
    lump(b, x + SHADE_SIDE[0] * R * 0.12, y - ry * 0.5, z + SHADE_SIDE[1] * R * 0.12, R * 0.84, ry * 0.62, R * 0.84, { seg: 12, rings: 5, normal: TONE.shade, twist, facing: [0, -1, 0], cut: -0.2 });
    // East, north and west flanks.
    const flanks = [-0.15, -1.75, 3.2];
    for (let k = 0; k < flanks.length; k++) {
      if (k === 2 && r('west') < 0.35) continue;
      scallop(flanks[k]! + (r('sa', k) - 0.5) * 0.8, R * (0.58 + r('sd', k) * 0.16), y - ry * (0.18 + r('sy', k) * 0.3), R * (0.42 + r('sr', k) * 0.14), TONE.shade, `st${k}`);
    }
  });
}

/** Fruit, blossom or flowers scattered on the sunny side of a crown: dabs of colour with no outline. */
function speckle(b: MeshBuilder, r: Rng, x: number, y: number, z: number, R: number, ry: number, color: Rgb | string, count: number, size: number, sway: SwayInput, ink = 'crown'): void {
  b.with({ color, pattern: PATTERN.none, ink, sway }, () => {
    for (let i = 0; i < count; i++) {
      // A point on the crown's lit half, pushed just proud of the surface.
      const a = Math.atan2(SUN[1], SUN[0]) + (r('fa', i) - 0.5) * 3.4;
      const up = -0.25 + r('fu', i) * 1.05;
      const s = Math.sqrt(Math.max(0, 1 - up * up));
      lump(b, x + Math.cos(a) * s * R * 1.02, y + up * ry * 1.02, z + Math.sin(a) * s * R * 1.02, size, size, size, { seg: 6, rings: 2, normal: TONE.lit });
    }
  });
}

export interface RoundOptions {
  /** Trunk height multiplier. */
  tall?: number;
  /** Crown size multiplier. */
  size?: number;
  color?: Rgb;
  /** Colour of fruit or blossom dabs, and how many. */
  fruit?: Rgb | string;
  fruitCount?: number;
}

/** The plain broadleaf: a leaning trunk and a cloud of a crown. Returns its height. */
export function roundTree(b: MeshBuilder, r: Rng, o: RoundOptions = {}): number {
  const th = (0.3 + r('th') * 0.14) * (o.tall ?? 1);
  const R = (0.27 + r('R') * 0.06) * (o.size ?? 1);
  const squash = 0.8 + r('sq') * 0.14;
  const lean = (r('lean') - 0.5) * 2 * TREE.lean;
  const tx = lean * th * 1.6, tz = (r('lz') - 0.5) * 0.05;
  const cy = th + R * squash * 0.72;
  const top = cy + R * squash;
  const sway = swayTo(top);
  trunk(b, r, [[0, 0, 0], [tx * 0.35, th * 0.55, tz * 0.5], [tx, th + R * 0.25, tz]], 0.05 + r('tr') * 0.016, sway);
  const color = o.color ?? vary(PALETTE.leaf, r('leaf'));
  cloud(b, r, { x: tx, y: cy, z: tz, R, squash, color, sway });
  if (o.fruit) speckle(b, r, tx, cy, tz, R, R * squash, o.fruit, o.fruitCount ?? 6, 0.04, sway);
  return top;
}

/** A cypress: a tall dark flame with a crescent of shade down its far side. */
export function cypress(b: MeshBuilder, r: Rng): number {
  const h = 1.0 + r('h') * 0.4, rad = 0.15 + r('rad') * 0.04;
  const y0 = 0.13;
  const top = y0 + h;
  const sway = swayTo(top);
  trunk(b, r, [[0, 0, 0], [0, 0.22, 0]], 0.045, sway);
  const color = vary(PALETTE.leafDark, r('leaf'));
  const twist = r('tw') * 6;
  b.with({ color, pattern: PATTERN.leaves, ink: 'crown', sway }, () => {
    lump(b, 0, y0 + h * 0.46, 0, rad, h * 0.46, rad, { seg: 8, rings: 6, normal: TONE.lit, twist });
    // The tip, a little off the axis, and a shoulder or two so the outline is not an ellipse.
    lump(b, (r('tx') - 0.5) * 0.05, y0 + h * 0.82, (r('tz') - 0.5) * 0.05, rad * 0.6, h * 0.2, rad * 0.6, { seg: 6, rings: 4, normal: TONE.lit });
    for (let j = 0; j < 2; j++) {
      const a = r('ba', j) * 6.28;
      lump(b, Math.cos(a) * rad * 0.42, y0 + h * (0.22 + r('by', j) * 0.3), Math.sin(a) * rad * 0.42, rad * 0.78, h * 0.2, rad * 0.78, { seg: 6, rings: 4, normal: TONE.lit });
    }
  });
  b.with({ color: mixColor(color, PALETTE.leafDark, TREE.shadeMix), pattern: PATTERN.leaves, ink: 'crown', sway }, () =>
    lump(b, SHADE_SIDE[0] * rad * 0.4, y0 + h * 0.42, SHADE_SIDE[1] * rad * 0.4, rad * 0.96, h * 0.42, rad * 0.96, { seg: 8, rings: 6, normal: TONE.shade, twist }),
  );
  return top;
}

const FLOWERS = [PALETTE.red, PALETTE.pink, PALETTE.yellow, PALETTE.white] as const;

/** A shrub: a low heap of leaf, lit on top and shaded under, sometimes in flower. `size` 1 is about 0.4 across. */
export function bush(b: MeshBuilder, r: Rng, size = 1, x = 0, z = 0, ink = 'bush', flowers: boolean | string = r('flower') < 0.5): void {
  const color = vary(PALETTE.bush, r('bc'), 0.8);
  const R = 0.15 * size;
  // A bush is rooted along its whole foot: it only stirs toward the top.
  const sway: SwayInput = (_x, y) => Math.max(0, Math.min(1, y / (R * 1.8))) * TREE.sway * 0.3;
  b.with({ color: mixColor(color, PALETTE.leafDark, TREE.shadeMix), pattern: PATTERN.leaves, ink, sway }, () =>
    mound(b, x + SHADE_SIDE[0] * R * 0.3, 0, z + SHADE_SIDE[1] * R * 0.3, R * 1.25, R * 0.95, R * 1.25, { seg: 7, rings: 2, normal: TONE.shade }),
  );
  b.with({ color, pattern: PATTERN.leaves, ink, sway }, () => {
    lump(b, x, R * 0.75, z, R, R * 0.85, R, { seg: 7, rings: 4, normal: TONE.lit, twist: r('bt') * 6 });
    const n = 1 + Math.floor(r('bn') * 2);
    for (let j = 0; j < n; j++) {
      const a = r('ba', j) * 6.28, d = R * (0.7 + r('bd', j) * 0.3), rr = R * (0.6 + r('br', j) * 0.2);
      lump(b, x + Math.cos(a) * d, rr * 0.8, z + Math.sin(a) * d, rr, rr * 0.85, rr, { seg: 6, rings: 3, normal: TONE.lit, twist: r('bw', j) * 6 });
    }
  });
  if (flowers) {
    const fc = typeof flowers === 'string' ? flowers : FLOWERS[Math.floor(r('fc') * FLOWERS.length)]!;
    b.with({ color: fc, pattern: PATTERN.none, ink, sway }, () => {
      for (let i = 0; i < 4; i++) {
        const a = Math.atan2(SUN[1], SUN[0]) + (r('fa', i) - 0.5) * 3.6, up = 0.15 + r('fu', i) * 0.7;
        const s = Math.sqrt(1 - up * up);
        lump(b, x + Math.cos(a) * s * R, R * 0.75 + up * R * 0.85, z + Math.sin(a) * s * R, 0.036 * size, 0.036 * size, 0.036 * size, { seg: 5, rings: 2, normal: TONE.lit });
      }
    });
  }
}

/** The 'bush' species as a whole tree block: a big flowering shrub with a smaller one against it. */
export function shrubbery(b: MeshBuilder, r: Rng): number {
  const a = r('a') * 6.28;
  bush(b, (...p) => r('big', ...p), 1.55, 0, 0, 'crown', true);
  bush(b, (...p) => r('small', ...p), 0.95, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 'crown2');
  return 0.5;
}

/** A palm: a curved, ringed trunk and a head of drooping fronds, with coconuts. */
export function palm(b: MeshBuilder, r: Rng): number {
  const h = 0.95 + r('h') * 0.3;
  const a = r('lean') * 6.28, reach = 0.08 + r('reach') * 0.12;
  const lx = Math.cos(a) * reach, lz = Math.sin(a) * reach;
  const top = h + 0.22;
  const sway = swayTo(top);
  // The trunk bows: it leaves the ground leaning and straightens toward the head.
  const pts: Vec3[] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const bow = 1 - (1 - t) * (1 - t);
    pts.push([lx * bow, h * t, lz * bow]);
  }
  trunk(b, r, pts, 0.062, sway, mixColor(PALETTE.trunk, PALETTE.dirt, 0.4));
  const hx = lx, hz = lz;
  const color = vary(PALETTE.leafDark, r('leaf'), 0.7);
  const fronds = 7;
  const a0 = r('fa') * 6.28;
  b.with({ color, pattern: PATTERN.none, ink: 'crown', sway }, () => {
    for (let f = 0; f < fronds; f++) {
      const fa = a0 + (f / fronds) * 6.28 + (r('fj', f) - 0.5) * 0.35;
      const len = 0.4 + r('fl', f) * 0.12, rise = 0.1 + r('fr', f) * 0.1, droop = 0.34 + r('fd', f) * 0.14;
      const dx = Math.cos(fa), dz = Math.sin(fa);
      const spine: Vec3[] = [], widths = [0.03, 0.085, 0.09, 0.065, 0.012];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        spine.push([hx + dx * len * t, h + rise * Math.sin(t * 2.2) - droop * t * t, hz + dz * len * t]);
      }
      // Two halves folded along the midrib: one in the light tone, one in the half tone, so the fold reads.
      for (let i = 0; i < 4; i++) {
        const p = spine[i]!, q = spine[i + 1]!, w0 = widths[i]!, w1 = widths[i + 1]!;
        const sx = -dz, sz = dx;
        const fold = 0.03;
        const pl: Vec3 = [p[0] - sx * w0, p[1] - fold * (w0 / 0.09), p[2] - sz * w0], pr: Vec3 = [p[0] + sx * w0, p[1] - fold * (w0 / 0.09), p[2] + sz * w0];
        const ql: Vec3 = [q[0] - sx * w1, q[1] - fold * (w1 / 0.09), q[2] - sz * w1], qr: Vec3 = [q[0] + sx * w1, q[1] - fold * (w1 / 0.09), q[2] + sz * w1];
        const lit = [TONE.lit, TONE.lit, TONE.lit, TONE.lit] as const, mid = [TONE.mid, TONE.mid, TONE.mid, TONE.mid] as const, under = [TONE.shade, TONE.shade, TONE.shade, TONE.shade] as const;
        b.quad(pl, p, q, ql, { normals: lit });
        b.quad(p, pr, qr, q, { normals: mid });
        const d = 0.012;
        b.quad([ql[0], ql[1] - d, ql[2]], [qr[0], qr[1] - d, qr[2]], [pr[0], pr[1] - d, pr[2]], [pl[0], pl[1] - d, pl[2]], { normals: under });
      }
    }
    // The heart of the head, so the fronds spring from something.
    lump(b, hx, h + 0.02, hz, 0.075, 0.06, 0.075, { seg: 6, rings: 3, normal: TONE.lit });
  });
  b.with({ color: mixColor(PALETTE.trunk, PALETTE.brick, 0.3), ink: 'nuts', sway }, () => {
    const n = 2 + Math.floor(r('nuts') * 2);
    for (let i = 0; i < n; i++) {
      const na = a0 + i * 2.2;
      lump(b, hx + Math.cos(na) * 0.07, h - 0.07, hz + Math.sin(na) * 0.07, 0.045, 0.045, 0.045, { seg: 5, rings: 3 });
    }
  });
  return top;
}

/** A willow: a stout trunk under a wide dome whose rim hangs in a ragged curtain nearly to the ground. */
export function willow(b: MeshBuilder, r: Rng): number {
  const th = 0.4 + r('th') * 0.1;
  const R = 0.4 + r('R') * 0.05;
  const cy = th + 0.24, top = cy + R * 0.6;
  const lean = (r('lean') - 0.5) * 0.1;
  const sway = swayTo(top);
  trunk(b, r, [[0, 0, 0], [lean * 0.5, th * 0.6, 0], [lean, cy, 0]], 0.075, sway);
  const color = vary(mixColor(PALETTE.leaf, PALETTE.yellow, 0.14), r('leaf'), 0.7);
  const shade = mixColor(color, PALETTE.leafDark, TREE.shadeMix + 0.08);
  b.with({ color, pattern: PATTERN.leaves, ink: 'crown', sway }, () =>
    lump(b, lean, cy, 0, R, R * 0.6, R, { seg: 12, rings: 6, normal: TONE.lit, twist: r('tw') * 6, facing: [0, 1, 0], cut: -0.3 }),
  );
  // The curtain: long tongues of leaf hanging from the rim, close enough to overlap, each its own length.
  // On the sunny side they alternate light and half tone (a change of tone with no line: hanging fronds);
  // on the far side they are in shade. Their tips swing more than the dome does.
  const strands = 11;
  const a0 = r('a0') * 6.28;
  for (let k = 0; k < strands; k++) {
    const a = a0 + (k / strands) * 6.28 + (r('sa', k) - 0.5) * 0.25;
    const dx = Math.cos(a), dz = Math.sin(a);
    const facing = dx * SUN[0] + dz * SUN[1];
    const shadeSide = dx * SHADE_SIDE[0] + dz * SHADE_SIDE[1] > 0.35;
    const tone = shadeSide ? TONE.shade : k % 2 === 0 && facing > -0.3 ? TONE.lit : TONE.mid;
    const len = 0.42 + r('sl', k) * 0.26;
    const d = R * (0.8 + r('sd', k) * 0.1);
    const yTop = cy + 0.05, yMid = yTop - len / 2, w = 0.11 + r('sw', k) * 0.035;
    const hang: SwayInput = (_x, y) => Math.min(1, TREE.sway * (0.3 + 0.7 * Math.max(0, Math.min(1, (yTop - y) / len))));
    b.with({ color: shadeSide ? shade : color, pattern: PATTERN.leaves, ink: 'crown', sway: hang }, () =>
      lump(b, lean + dx * d, yMid, dz * d, w, len / 2, w, { seg: 6, rings: 4, normal: tone, twist: a, facing: [dx, -0.25, dz], cut: -0.35 }),
    );
  }
  return top;
}

/** A pine: three or four skirts of dark needles on a straight trunk, each shading the one below. */
export function pine(b: MeshBuilder, r: Rng): number {
  const tiers = 3 + (r('tiers') < 0.4 ? 1 : 0);
  const h = 1.05 + r('h') * 0.35;
  const y0 = 0.2 + r('y0') * 0.06;
  const top = y0 + h;
  const sway = swayTo(top);
  trunk(b, r, [[0, 0, 0], [0, y0 + 0.1, 0]], 0.05, sway);
  const color = vary(mixColor(PALETTE.leafDark, PALETTE.glass, 0.1), r('leaf'), 0.7);
  const seg = 11;
  const step = h / (tiers + 0.6);
  b.with({ color, pattern: PATTERN.leaves, ink: 'crown', sway }, () => {
    for (let t = 0; t < tiers; t++) {
      const yb = y0 + t * step, yt = yb + step * 1.6;
      const R = (0.36 - t * (0.24 / tiers)) * (0.94 + r('R', t) * 0.12);
      const ring: Vec3[] = [];
      const tw = r('tw', t) * 6.28;
      for (let j = 0; j < seg; j++) {
        const a = tw + (j / seg) * 6.28;
        const rr = R * (j % 2 === 0 ? 1 : 0.84) * (0.93 + r('j', t, j) * 0.14);
        ring.push([Math.cos(a) * rr, yb + (j % 2 === 0 ? -0.03 : 0.03), Math.sin(a) * rr]);
      }
      const apex: Vec3 = [0, Math.min(yt, top), 0];
      for (let j = 0; j < seg; j++) {
        const p = ring[j]!, q = ring[(j + 1) % seg]!;
        // Sunny facets take the light tone, the rest the half tone: one clean change, no line.
        const mx = p[0] + q[0], mz = p[2] + q[2];
        const sun = (mx * SUN[0] + mz * SUN[1]) / (Math.hypot(mx, mz) || 1);
        const n = sun > 0.2 ? TONE.lit : sun > -0.55 ? TONE.mid : TONE.shade;
        b.tri(apex, q, p, { normals: [n, n, n] });
        // The underside of the skirt is in shade.
        b.tri([0, yb + 0.08, 0], p, q, { normals: [TONE.shade, TONE.shade, TONE.shade] });
      }
    }
  });
  return top;
}

/** A clipped tree in a planter (beside a plaza): a stone box of earth, a straight stem, a neat ball or two. */
export function planterTree(b: MeshBuilder, r: Rng): number {
  const box = 0.5, bh = 0.2;
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'planter' }, () => {
    b.boxAt([0, 0, 0], [box, bh, box], { skip: ['bottom', 'top'] });
    // The rim, proud of the box, with the earth sunk inside it.
    b.boxAt([0, bh, 0], [box + 0.06, 0.05, box + 0.06], { skip: ['bottom'] });
  });
  b.with({ color: PALETTE.dirtDark, pattern: PATTERN.dirt, ink: 'earth' }, () => b.quad([-0.19, bh + 0.052, 0.19], [0.19, bh + 0.052, 0.19], [0.19, bh + 0.052, -0.19], [-0.19, bh + 0.052, -0.19]));
  const th = 0.4 + r('th') * 0.1;
  const R = 0.31 + r('R') * 0.04;
  const double = r('double') < 0.3;
  const cy = bh + th + R * 0.8;
  const top = double ? cy + R * 1.55 : cy + R;
  const sway = swayTo(top);
  trunk(b, r, [[0, bh, 0], [0, cy, 0]], 0.04, sway);
  const color = vary(PALETTE.leafDark, r('leaf'), 0.6);
  const ball = (y: number, rad: number): void => {
    b.with({ color, pattern: PATTERN.leaves, ink: 'crown', sway }, () => lump(b, 0, y, 0, rad, rad * 0.94, rad, { seg: 12, rings: 6, normal: TONE.lit }));
    b.with({ color: mixColor(color, PALETTE.leafDark, TREE.shadeMix), pattern: PATTERN.leaves, ink: 'crown', sway }, () =>
      lump(b, SHADE_SIDE[0] * rad * 0.14, y - rad * 0.48, SHADE_SIDE[1] * rad * 0.14, rad * 0.84, rad * 0.6, rad * 0.84, { seg: 12, rings: 5, normal: TONE.shade, facing: [0, -1, 0], cut: -0.2 }),
    );
  };
  ball(cy, R);
  if (double) ball(cy + R * 1.12, R * 0.52);
  return top;
}

const FRUIT = [PALETTE.red, PALETTE.yellow, PALETTE.pink, PALETTE.brick] as const;

/** A fruit tree (on a garden): a small round tree hung with fruit or in blossom. */
export function fruitTree(b: MeshBuilder, r: Rng): number {
  const kind = Math.floor(r('fruit') * FRUIT.length);
  return roundTree(b, r, { tall: 0.85, size: 0.95, fruit: FRUIT[kind], fruitCount: kind === 2 ? 9 : 7 });
}

/** A grove tree (five or more together): taller and darker, with ferns and a toadstool at its foot. */
export function groveTree(b: MeshBuilder, r: Rng): number {
  const top = roundTree(b, r, { tall: 1.35, size: 1.08, color: vary(mixColor(PALETTE.leaf, PALETTE.leafDark, 0.45), r('leaf')) });
  // Undergrowth: a couple of low ferny mounds and a tuft, all in shade.
  const n = 2 + Math.floor(r('under') * 2);
  for (let i = 0; i < n; i++) {
    const a = r('ua', i) * 6.28, d = 0.2 + r('ud', i) * 0.16;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.09 + r('us', i) * 0.05;
    b.with({ color: vary(PALETTE.leafDark, r('uc', i), 0.8), pattern: PATTERN.leaves, ink: 'under' }, () =>
      mound(b, x, 0, z, s * 1.3, s, s * 1.3, { seg: 6, rings: 2, normal: i % 2 ? TONE.mid : TONE.shade, twist: a }),
    );
  }
  if (r('toadstool') < 0.6) {
    const a = r('ma') * 6.28;
    const x = Math.cos(a) * 0.17, z = Math.sin(a) * 0.17;
    b.with({ color: PALETTE.white, ink: 'toadstool' }, () => tube(b, [[x, 0, z], [x, 0.06, z]], 0.018, { seg: 4 }));
    b.with({ color: PALETTE.red, ink: 'toadstool' }, () => mound(b, x, 0.055, z, 0.05, 0.04, 0.05, { seg: 6, rings: 2 }));
  }
  b.with({ color: PALETTE.leafDark, ink: 'under' }, () => tuft(b, -0.2, 0, 0.14, 0.14, (...p) => r('tuft', ...p)));
  return top;
}

/** What stands at the foot of a plain tree: a small bush, or flowers in the grass. */
export function companion(b: MeshBuilder, r: Rng, x: number, z: number): void {
  if (r('what') < 0.6) {
    bush(b, (...p) => r('bush', ...p), 0.8 + r('size') * 0.3, x, z, 'companion');
    return;
  }
  b.with({ color: PALETTE.leafDark, ink: 'companion' }, () => tuft(b, x, 0, z, 0.13, (...p) => r('tuft', ...p), 4));
  b.with({ color: FLOWERS[Math.floor(r('fc') * FLOWERS.length)]!, ink: 'companion' }, () => {
    for (let i = 0; i < 3; i++) dab(b, x + (r('fx', i) - 0.5) * 0.2, 0.012, z + (r('fz', i) - 0.5) * 0.2, 0.03);
  });
}
