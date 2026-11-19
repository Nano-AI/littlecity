// Flags (D13). Cloth on a staff; the cloth moves with the wind through its
// per-vertex sway weight (0 at the hoist, most at the fly), so no behaviour
// is needed to make it flutter.
//
//   pennant   a long tapering streamer on a short staff: tower caps, a
//             lighthouse gallery, a pier's end
//   banner    a swallow-tailed standard on a stouter staff: castle turrets
//   pole      a free-standing flagpole on a stone foot, with a ball on top
//             and a bold flag: the middle of a square
//   wall      a staff raked out from a wall, the flag hanging from it
//
// A flag is two colours: the field (`flag.color`, an index into the cloth
// colours) and a device in a contrasting one, chosen by `flag.look`.
//
// Frame: the mount (a socket, or a floor slot); the staff rises from the
// origin and the cloth flies toward +X.

import { compose, rotationX, rotationY, rotationZ, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PROP } from '@/style/dressing';
import { PALETTE } from '@/style/palette';
import { clothColors } from './kit';

/**
 * A flag in the builder's XY plane, hoisted along x = 0 from y0 up to y0 +
 * hoist, flying to +X. `top` and `bottom` give the outline's y (0–1 of the
 * hoist) at a distance t (0–1) along the fly: a rectangle, a taper, a
 * swallow tail. It is cut into strips so the cloth can ripple; each strip is
 * pushed a little out of plane to bake in a fold.
 */
function flagCloth(b: MeshBuilder, y0: number, hoist: number, fly: number, strips: number, top: (t: number) => number, bottom: (t: number) => number, ripple: number, band: (t: number, v: number) => string | null | false, field: string): void {
  const sway = PROP.flagSway;
  const pt = (i: number, v: number, side: number): Vec3 => {
    const t = i / strips;
    const yy = bottom(t) + (top(t) - bottom(t)) * v;
    // The fly droops a little, and the cloth is baked into one soft fold.
    return [t * fly, y0 + yy * hoist - t * t * hoist * 0.12, Math.sin(t * Math.PI * 2.2) * ripple * t + side * 0.004];
  };
  const rows = 3;
  b.setSway((x) => Math.min(1, Math.max(0, x / fly)) * sway);
  for (let i = 0; i < strips; i++) {
    for (let r = 0; r < rows; r++) {
      const v0 = r / rows, v1 = (r + 1) / rows;
      const col = band((i + 0.5) / strips, (r + 0.5) / rows);
      if (col === false) continue;
      b.with({ color: col ?? field }, () => {
        b.quad(pt(i, v0, 1), pt(i + 1, v0, 1), pt(i + 1, v1, 1), pt(i, v1, 1));
        b.quad(pt(i, v1, -1), pt(i + 1, v1, -1), pt(i + 1, v0, -1), pt(i, v0, -1));
      });
    }
  }
  b.setSway(0);
}

/** The device on a flag: which strips and rows take the second colour. */
function device(look: number, second: string): (t: number, v: number) => string | null {
  switch (look % 5) {
    case 0:
      return (_t, v) => (v > 0.34 && v < 0.67 ? second : null); // a bar along the fly
    case 1:
      return (t) => (t < 0.4 ? second : null); // a pale at the hoist
    case 2:
      return (t, v) => ((t > 0.2 && t < 0.4) || (v > 0.34 && v < 0.67) ? second : null); // a cross
    case 3:
      return (_t, v) => (v > 0.67 ? second : null); // a chief
    default:
      return (t, v) => ((Math.floor(t * 5) + Math.floor(v * 3)) % 2 === 0 ? null : second); // chequers
  }
}

export default definePart({
  prop: 'flag',
  build(item, ctx) {
    const b = ctx.mesh();
    const variant = item.variant ?? 'pennant';
    const cloths = clothColors();
    const field = cloths[(((item.params?.color ?? 0) % cloths.length) + cloths.length) % cloths.length]!;
    const look = item.params?.look ?? Math.floor(ctx.rand('look') * 100);
    // The second colour: white on a strong field, red on a pale one.
    const second = field === PALETTE.white || field === PALETTE.yellow ? PALETTE.red : PALETTE.white;
    const staff = (r: number, h: number, ball = true): void => {
      b.with({ color: variant === 'pole' ? PALETTE.white : PALETTE.trunk, pattern: PATTERN.none, ink: 'staff' }, () => {
        b.lathe([[r, 0], [r * 0.7, h]], { segments: 5, capTop: true });
      });
      if (ball) b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'staff' }, () => b.lathe([[0, h], [r * 1.9, h + r * 1.6], [0, h + r * 3.4]], { segments: 6 }));
    };
    b.setPattern(PATTERN.cloth).setInk('cloth');
    if (variant === 'pole') {
      const h = PROP.flagPole * (0.96 + ctx.rand('h') * 0.08);
      // A pole at the middle of an even square stands out on the corner of its cell; its slot's
      // frame is turned 45°, so turn it back to fly square to the town.
      const back = item.params?.back ?? 0;
      if (back) b.transform(compose(translation(0, 0, -back), rotationY(Math.PI / 4)));
      b.with({ color: PALETTE.stoneShade, pattern: PATTERN.stone, ink: 'foot' }, () => {
        b.boxAt([0, 0, 0], [0.26, 0.06, 0.26], { skip: ['bottom'] });
        b.boxAt([0, 0.06, 0], [0.16, 0.07, 0.16], { skip: ['bottom'] });
      });
      b.at(compose(translation(0, 0.13, 0), rotationZ((ctx.rand('lean') - 0.5) * 0.02)), () => {
        staff(0.026, h - 0.13);
        flagCloth(b, h - 0.13 - 0.36, 0.33, 0.52, 5, () => 1, () => 0, 0.035, device(look, second), field);
      });
    } else if (variant === 'banner') {
      const h = 0.62;
      staff(0.018, h);
      // A swallow tail: the middle of the fly is cut away.
      const dev = device(look, second);
      flagCloth(b, h - 0.3, 0.27, 0.46, 5, () => 1, () => 0, 0.03, (t, v) => (t > 0.8 && v > 0.34 && v < 0.67 ? false : dev(t, v)), field);
    } else if (variant === 'wall') {
      // Raked out from the wall (+Z), the cloth hanging below the staff.
      b.at(compose(rotationX(0.95)), () => {
        staff(0.016, 0.5);
      });
      b.at(compose(translation(0, 0.29, 0.4), rotationZ(-Math.PI / 2)), () => {
        flagCloth(b, -0.15, 0.3, 0.36, 4, () => 1, () => 0, 0.02, device(look, second), field);
      });
    } else {
      const h = item.params?.staff ?? 0.52;
      staff(h > 0.7 ? 0.02 : 0.015, h, h > 0.7);
      // A streamer tapering to a point.
      flagCloth(b, h - 0.215, 0.2, 0.6, 5, (t) => 1 - t * 0.42, (t) => t * 0.42, 0.035, (t) => (t < 0.22 ? second : null), field);
    }
    return { mesh: b.build() };
  },
});
