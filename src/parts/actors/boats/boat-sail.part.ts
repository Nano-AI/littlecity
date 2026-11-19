// A sail (L19): its own instance, so the sailboat's behaviour can swing it
// out to leeward and fill it. Two variants:
//
//   main  a three-cornered mainsail with a little roach in the leech, laced
//         to its boom (the boom is drawn here: it swings with the sail).
//         Frame: the gooseneck. The luff runs up +Y, the foot aft along −Z.
//   jib   the headsail. Frame: its tack; the luff runs up +Y (the behaviour
//         leans the frame back along the forestay), the clew is aft and low.
//
// THE BELLY. The cloth bows out to `side` (+1: toward +X, −1: toward −X) by
// its full depth. The behaviour scales the instance across X by how full the
// sail is (1 drawing hard, near 0 slack), and shows the instance built for
// the lee side: so a sail goes slack, crosses and fills on the other side,
// and its shading is never turned inside out by a mirror.
//
// The cloth has ONE flat normal each side, square to the sail: it shades as
// one tone like a drawn sail, and squeezing it flat does not skew its light.
// The two faces are a hair apart, so neither is the other's back.

import type { Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import type { ColorInput, MeshBuilder } from '@/gen/mesh';
import { PALETTE, RAMPS } from '@/style/palette';
import { face, stick } from './hull';
import { sailboatRig } from './rig';

/** How far the middle of a full sail stands off the straight line from luff to leech. */
const MAIN_DEPTH = 0.1;
const JIB_DEPTH = 0.075;
const GAP = 0.003;

/**
 * Lofts a sail: `at(u, v)` is the flat sail (u 0 at the luff to 1 at the leech, v 0 at the foot to 1
 * at the head), `belly(u, v)` how far it bows. Coloured per panel by `colorOf(row)`.
 */
function cloth(b: MeshBuilder, side: number, nu: number, nv: number, at: (u: number, v: number) => Vec3, belly: (u: number, v: number) => number, colorOf: (row: number) => ColorInput): void {
  for (const sheet of [1, -1]) {
    const n: Vec3 = [sheet, 0, 0];
    const p = (i: number, j: number): Vec3 => {
      const u = i / nu, v = j / nv;
      const q = at(u, v);
      return [side * belly(u, v) + sheet * GAP, q[1], q[2]];
    };
    for (let j = 0; j < nv; j++) {
      b.setColor(colorOf(j));
      for (let i = 0; i < nu; i++) face(b, [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], [n, n, n, n]);
    }
  }
}

/** Panel colours by look: mostly white, with a band or a head of colour. */
function panels(look: number, rows: number, jib: boolean): (row: number) => ColorInput {
  const accents = [RAMPS.roof[0]!, RAMPS.roof[1]!, PALETTE.yellow, RAMPS.roof[3]!];
  const accent = accents[look % accents.length]!;
  const style = Math.floor(look / accents.length) % 3;
  if (jib) return () => (style === 1 ? PALETTE.white : accent);
  return (row) => {
    if (style === 0) return PALETTE.white;
    if (style === 1) return row === rows - 2 || row === rows - 1 ? accent : PALETTE.white;
    return row === 1 ? accent : PALETTE.white;
  };
}

export default definePart({
  actor: 'boat-sail',
  build(item, ctx) {
    const b = ctx.mesh();
    const rig = sailboatRig();
    const side = (item.params?.side ?? 1) < 0 ? -1 : 1;
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    b.setInk('sail');
    if (item.variant === 'jib') {
      const L = rig.jibLuff * 0.96;
      const clew = rig.jibClew;
      const rows = 4;
      cloth(
        b, side, 3, rows,
        (u, v) => {
          // From the luff to the leech, which runs from the clew up to the head, hollowed a little.
          const ly = 0.03 + v * (L - 0.03);
          const ey = clew[1] + v * (L - clew[1]), ez = clew[2] * (1 - v) * (1 - 0.18 * v);
          return [0, ly + (ey - ly) * u, ez * u];
        },
        (u, v) => JIB_DEPTH * Math.sin(Math.PI * u ** 0.85) * (1 - v) ** 0.6,
        panels(look, rows, true),
      );
    } else {
      const F = rig.foot, H = rig.luff;
      const rows = 5;
      // The chord at each height: a triangle with a roach (the leech bows aft between boom and head).
      const chord = (v: number): number => F * (1 - v) * (1 + 0.5 * v * (1 - v) * 1.6);
      cloth(
        b, side, 4, rows,
        (u, v) => [0, 0.025 + v * H + u * (1 - v) * 0.035, -chord(v) * u],
        (u, v) => MAIN_DEPTH * Math.sin(Math.PI * u ** 0.8) * (1 - v) ** 0.55 * (0.35 + 0.65 * Math.min(1, v * 6 + 0.2)),
        panels(look, rows, false),
      );
      b.with({ color: RAMPS.wood[1]!, ink: 'boom' }, () => stick(b, [0, 0, 0.01], [0, 0.03, -F - 0.03], 0.024));
    }
    return { mesh: b.build(), animated: true };
  },
});
