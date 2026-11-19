// How a length of fence is drawn in each of the four styles of R-E01: white
// picket, rope and post, iron railing, stone balustrade. Shared by the fence
// generator (runs), the railing part (J19) and the stairs generator (sloped
// handrails, J18). Not a part file.
//
// Everything is drawn in a LOCAL frame: the span runs along +X from 0 to
// `length` on the line z = 0, standing on y = 0 (rising by `rise` over its
// length when it is a stair rail). The caller sets the ink group and places
// the frame; this file sets colours and patterns only. Normals are true
// normals, so the frame may be rotated.
//
// Design for the zoom the player sees (a cell is about 55 pixels): a few
// bold members, all in the caller's ONE ink group, so a fence is drawn as
// its outline and not as sixteen little boxes.

import { compose, rotationZ, translation, type Vec3 } from '@/core/mat4';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { FENCE } from '@/style/edges';
import { PALETTE } from '@/style/palette';
import { lump, mixColor, tube, type Rng } from './kit';

export type FenceStyle = 'picket-fence' | 'rope-fence' | 'iron-railing' | 'stone-balustrade';

export interface SpanOptions {
  length: number;
  /** How much the span climbs over its length (stair rails). Default 0. */
  rise?: number;
  /** Height multiplier. Default 1. */
  scale?: number;
  /** Local x of the posts to draw with the span. */
  posts?: readonly number[];
  /** Local x of posts somebody else draws: pickets and balusters keep clear of them. */
  clear?: readonly number[];
  /** The world coordinate of local x = 0 along the run, so pickets keep one rhythm across spans. */
  phase?: number;
  /** Seeded chance for this span. */
  r: Rng;
  /** The stone of a balustrade (default PALETTE.stone). */
  stone?: ColorInput;
}

export interface PostOptions {
  r: Rng;
  scale?: number;
  /** Extra height (gate posts). */
  tall?: number;
  stone?: ColorInput;
}

/**
 * One normal for a whole small member: it is drawn in a single flat tone with
 * no crease lines inside it, so it reads as a clean white shape in an
 * outline. Straight up is the same direction in every frame a run uses.
 */
const FLAT: Vec3 = [0, 1, 0];
const FLAT4 = { normals: [FLAT, FLAT, FLAT, FLAT] as const };

/**
 * A bar from (x0, y0) to (x1, y1): `w` across (z), `h` tall, with upright
 * ends. No underside. With `flat` it is drawn in one tone (see FLAT).
 */
export function beam(b: MeshBuilder, x0: number, y0: number, x1: number, y1: number, zc: number, w: number, h: number, caps: { start?: boolean; end?: boolean; flat?: boolean } = {}): void {
  const za = zc - w / 2, zb = zc + w / 2;
  const o = caps.flat ? FLAT4 : undefined;
  b.quad([x0, y0 + h, zb], [x1, y1 + h, zb], [x1, y1 + h, za], [x0, y0 + h, za], o);
  b.quad([x0, y0, zb], [x1, y1, zb], [x1, y1 + h, zb], [x0, y0 + h, zb], o);
  b.quad([x1, y1, za], [x0, y0, za], [x0, y0 + h, za], [x1, y1 + h, za], o);
  if (caps.start) b.quad([x0, y0, za], [x0, y0, zb], [x0, y0 + h, zb], [x0, y0 + h, za], o);
  if (caps.end) b.quad([x1, y1, zb], [x1, y1, za], [x1, y1 + h, za], [x1, y1 + h, zb], o);
}

/** A flat board with a pointed top, standing at x, in one flat tone. */
function picket(b: MeshBuilder, x: number, y: number, w: number, t: number, h: number, tip: number): void {
  const xa = x - w / 2, xb = x + w / 2, za = -t / 2, zb = t / 2, yh = y + h - tip, yt = y + h;
  const five = { normals: [FLAT, FLAT, FLAT, FLAT, FLAT] };
  b.polygon([[xa, y, zb], [xb, y, zb], [xb, yh, zb], [x, yt, zb], [xa, yh, zb]], five);
  b.polygon([[xb, y, za], [xa, y, za], [xa, yh, za], [x, yt, za], [xb, yh, za]], five);
  b.quad([xb, y, zb], [xb, y, za], [xb, yh, za], [xb, yh, zb], FLAT4);
  b.quad([xa, y, za], [xa, y, zb], [xa, yh, zb], [xa, yh, za], FLAT4);
  b.quad([xb, yh, zb], [xb, yh, za], [x, yt, za], [x, yt, zb], FLAT4);
  b.quad([xa, yh, za], [xa, yh, zb], [x, yt, zb], [x, yt, za], FLAT4);
}

/** An upright square bar with no ends, in one flat tone: thin iron is a line, not a shaded box. */
function bar(b: MeshBuilder, x: number, y0: number, y1: number, w: number): void {
  const s = w / 2;
  b.quad([x - s, y0, s], [x + s, y0, s], [x + s, y1, s], [x - s, y1, s], FLAT4);
  b.quad([x + s, y0, -s], [x - s, y0, -s], [x - s, y1, -s], [x + s, y1, -s], FLAT4);
  b.quad([x + s, y0, s], [x + s, y0, -s], [x + s, y1, -s], [x + s, y1, s], FLAT4);
  b.quad([x - s, y0, -s], [x - s, y0, s], [x - s, y1, s], [x - s, y1, -s], FLAT4);
}

/** Wrought iron, drawn a little lighter than `metal` so a railing does not mass into black at playing zoom. */
const IRON = (): ColorInput => mixColor(PALETTE.metal, PALETTE.stoneShade, FENCE.ironLight);

const ROPE = (): ColorInput => mixColor(PALETTE.sand, PALETTE.wood, 0.45);
const ROPE_POST = (): ColorInput => mixColor(PALETTE.wood, PALETTE.trunk, 0.45);

/** One post of a style at local (x, y). */
export function drawPost(b: MeshBuilder, style: FenceStyle, x: number, y: number, o: PostOptions): void {
  const k = o.scale ?? 1;
  const tall = o.tall ?? 0;
  if (style === 'picket-fence') {
    const lean = o.r('lean?') < FENCE.leanChance ? (o.r('lean') - 0.5) * 2 * FENCE.lean : 0;
    // Drawn in one flat tone like the pickets, so the whole fence is the same white.
    const s = FENCE.post / 2, h = (FENCE.postHeight + tall) * k, tip = FENCE.post * 0.65;
    b.with({ color: PALETTE.white, pattern: PATTERN.none }, () =>
      b.at(compose(translation(x, y, 0), rotationZ(lean)), () => {
        const c: Vec3[] = [[-s, 0, s], [s, 0, s], [s, 0, -s], [-s, 0, -s]];
        for (let i = 0; i < 4; i++) {
          const p = c[i]!, q = c[(i + 1) % 4]!;
          b.quad(p, q, [q[0], h, q[2]], [p[0], h, p[2]], FLAT4);
          b.tri([p[0], h, p[2]], [q[0], h, q[2]], [0, h + tip, 0], { normals: [FLAT, FLAT, FLAT] });
        }
      }),
    );
  } else if (style === 'rope-fence') {
    const h = (FENCE.postHeight + tall) * k;
    const lean = (o.r('lean') - 0.5) * 0.06;
    b.with({ color: ROPE_POST(), pattern: PATTERN.bark }, () =>
      b.at(compose(translation(x, y, 0), rotationZ(lean)), () =>
        b.lathe([[0.055, 0], [0.047, h - 0.07], [0.06, h - 0.055], [0.06, h - 0.02], [0.03, h], [0, h]], { segments: 6 }),
      ),
    );
  } else if (style === 'iron-railing') {
    const h = (FENCE.postHeight + tall) * k;
    b.with({ color: IRON(), pattern: PATTERN.none }, () => {
      bar(b, x, y, y + h, FENCE.ironPost);
      // A small ball finial.
      lump(b, x, y + h + 0.018, 0, 0.026, 0.026, 0.026, { seg: 6, rings: 3, normal: FLAT });
    });
  } else {
    const h = (FENCE.postHeight - 0.02 + tall) * k;
    b.with({ color: o.stone ?? PALETTE.stone, pattern: PATTERN.none }, () => {
      b.boxAt([x, y, 0], [0.17, h, 0.17], { skip: ['bottom', 'top'] });
      b.boxAt([x, y + h, 0], [0.21, 0.04, 0.21]);
      if (tall > 0) lump(b, x, y + h + 0.04 + 0.05, 0, 0.065, 0.06, 0.065, { seg: 6, rings: 4 });
    });
  }
}

/** A length of fence. See the head of the file for the frame. */
export function drawSpan(b: MeshBuilder, style: FenceStyle, o: SpanOptions): void {
  const L = o.length;
  if (L <= 0.001) return;
  const rise = o.rise ?? 0;
  const k = o.scale ?? 1;
  const posts = [...(o.posts ?? [])].sort((p, q) => p - q);
  const keepClear = [...posts, ...(o.clear ?? [])];
  const yAt = (x: number): number => (rise * x) / L;
  const phase = o.phase ?? 0;
  const H = FENCE.height * k;
  const postHalf = style === 'picket-fence' ? FENCE.post / 2 : style === 'iron-railing' ? FENCE.ironPost / 2 : style === 'rope-fence' ? 0.055 : 0.085;
  // Members repeated along the run stand at fixed places in the world (so two spans in a line agree)
  // and keep clear of posts.
  const repeat = (perCell: number, margin: number, each: (x: number, i: number) => void): void => {
    const pitch = 1 / perCell;
    const first = Math.ceil((phase + margin) / pitch - 0.5);
    for (let i = first; ; i++) {
      const x = (i + 0.5) * pitch - phase;
      if (x > L - margin + 1e-6) break;
      if (x < margin - 1e-6) continue;
      if (keepClear.some((p) => Math.abs(p - x) < margin + postHalf)) continue;
      each(x, i);
    }
  };

  if (style === 'picket-fence') {
    b.with({ color: PALETTE.white, pattern: PATTERN.none }, () => {
      for (const ry of [0.08, 0.23]) beam(b, 0, ry * k, L, ry * k + rise, 0, 0.03, 0.05, { flat: true });
      const w = FENCE.picket;
      repeat(FENCE.perCell, w / 2, (x, i) => {
        const h = H + (o.r('h', i) - 0.5) * 2 * FENCE.uneven;
        picket(b, x + (o.r('x', i) - 0.5) * 0.02, yAt(x), w, 0.05, h, 0.065);
      });
    });
  } else if (style === 'rope-fence') {
    // Ropes hang from post to post; with no post at an end the rope runs on to the next span.
    const stops = [...new Set([0, ...posts, L])].sort((p, q) => p - q);
    b.with({ color: ROPE(), pattern: PATTERN.none }, () => {
      for (let i = 0; i + 1 < stops.length; i++) {
        const a = stops[i]!, c = stops[i + 1]!;
        if (c - a < 0.02) continue;
        const sag = FENCE.sag * Math.min(1, c - a) * (0.8 + o.r('sag', i) * 0.4);
        for (const [ry, sg] of [[0.34, sag], [0.19, sag * 0.8]] as const) {
          const pts: Vec3[] = [];
          for (let j = 0; j <= 4; j++) {
            const t = j / 4, x = a + (c - a) * t;
            pts.push([x, yAt(x) + ry * k - sg * 4 * t * (1 - t), 0]);
          }
          tube(b, pts, 0.019, { seg: 4 });
        }
      }
    });
  } else if (style === 'iron-railing') {
    // A top rail, one low rail, and thin bars between them: six to a cell.
    b.with({ color: IRON(), pattern: PATTERN.none }, () => {
      const w = FENCE.ironBar;
      beam(b, 0, H - 0.022, L, H - 0.022 + rise, 0, 0.024, 0.022, { flat: true });
      beam(b, 0, 0.06 * k, L, 0.06 * k + rise, 0, w + 0.004, w + 0.004, { flat: true });
      repeat(FENCE.ironBars, w / 2, (x) => bar(b, x, yAt(x) + 0.06 * k, yAt(x) + H - 0.022, w));
    });
  } else {
    b.with({ color: o.stone ?? PALETTE.stone, pattern: PATTERN.none }, () => {
      beam(b, 0, 0, L, rise, 0, 0.13, 0.05 * k);
      beam(b, 0, H - 0.055, L, H - 0.055 + rise, 0, 0.15, 0.055);
      const y0 = 0.05 * k, y1 = H - 0.055;
      const h = y1 - y0;
      repeat(4, 0.05, (x) =>
        b.at(translation(x, yAt(x) + y0, 0), () =>
          b.lathe([[0.04, 0], [0.054, h * 0.28], [0.03, h * 0.62], [0.042, h]], { segments: 6 }),
        ),
      );
    });
  }
  for (let i = 0; i < posts.length; i++) {
    const x = posts[i]!;
    drawPost(b, style, x, yAt(x), { r: (...p) => o.r('post', Math.round((phase + x) * 8), ...p), scale: k, stone: o.stone });
  }
}

/**
 * A gate in a fence, centred on the origin, the run along X: two taller
 * posts FENCE.gateHalf either side, and between them a leaf standing ajar
 * (picket, iron) or nothing at all (rope, balustrade: an opening between
 * two posts).
 */
export function drawGate(b: MeshBuilder, style: FenceStyle, o: PostOptions): void {
  const half = FENCE.gateHalf;
  for (const side of [-1, 1]) {
    drawPost(b, style, side * half, 0, { ...o, tall: FENCE.gatePost, r: (...p) => o.r('gatepost', side, ...p) });
  }
  if (style !== 'picket-fence' && style !== 'iron-railing') return;
  // The leaf hangs on one post and stands open by a seeded angle, to one side or the other.
  const hingeLeft = o.r('hinge') < 0.5;
  const open = (0.3 + o.r('open') * 0.45) * (o.r('way') < 0.5 ? 1 : -1);
  const postW = style === 'picket-fence' ? FENCE.post : FENCE.ironPost;
  const leaf = 2 * half - postW - 0.05;
  const hx = (hingeLeft ? -1 : 1) * (half - postW / 2 - 0.01);
  // Rotation about Y by θ turns +X toward −Z; a left-hung leaf points along +X, a right-hung one along −X.
  const turn = hingeLeft ? open : Math.PI - open;
  const c = Math.cos(turn), s = Math.sin(turn);
  b.at([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, hx, 0.03, 0, 1], () => {
    drawSpan(b, style, { length: leaf, scale: (o.scale ?? 1) * 0.92, phase: 0.02, r: (...p) => o.r('leaf', ...p) });
    if (style === 'picket-fence') {
      // The brace every garden gate has, from the low hinge corner to the high latch corner.
      b.with({ color: PALETTE.white }, () => beam(b, 0.02, 0.1, leaf - 0.02, 0.2, 0, 0.032, 0.045, { flat: true }));
    }
  });
}
