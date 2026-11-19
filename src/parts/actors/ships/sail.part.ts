// A big ship's sail (L38–L41), in two instances the harbour system moves:
//
//   yard   the yard with the sail furled along it: always shown
//   cloth  the sail itself, hanging from the yard. Scaled down toward the
//          yard to furl it (local Y), and across by how full it is
//
// A SQUARE sail hangs from a yard across the ship: frame at the middle of
// the yard, +X along it to starboard, the cloth hanging down −Y and bellying
// forward +Z (a square sail always fills from aft). The system braces the
// yard round the mast.
//
// A LATEEN sail is fore-and-aft, on a long slanting yard: frame where the
// yard crosses the mast, +Z along the yard toward its forward end, the cloth
// below it (−Y), bellying to +X or −X (`side`): like the sailboat's sails,
// two cloth instances, one bellying each way, and the system shows the one
// on the lee side (lateenFrame says how the yard lies).
//
// The cloth is one ink group with flat normals each side: it shades as one
// tone, like a drawn sail. Emblems (a cross, stripes, a band) are panels of
// colour inside it, so they read by colour and add no line.

import type { Mat4, Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import type { ColorInput, MeshBuilder } from '@/gen/mesh';
import { face } from '../boats/hull';
import { ball } from '../kit';
import { shipPaint } from './paint';
import { rigOf, shipOfIndex, type SailDef } from './rig';

const GAP = 0.004;

/** The rotation that takes a lateen sail's own frame (+Z along the yard, forward) into the ship's. */
export function lateenFrame(sail: SailDef): Mat4 {
  const f = sail.yardFore!, a = sail.yardAft!;
  const dz = f[2] - a[2], dy = f[1] - a[1];
  const len = Math.hypot(dz, dy) || 1;
  // Local Z along the yard, local Y square to it in the ship's YZ plane (up and forward), X across.
  const zy = dy / len, zz = dz / len;
  return [1, 0, 0, 0, 0, zz, -zy, 0, 0, zy, zz, 0, 0, 0, 0, 1];
}

/** A ship-frame point (relative to the sail's `at`) in the lateen's own frame. */
function intoLateen(sail: SailDef, p: Vec3): Vec3 {
  const m = lateenFrame(sail);
  // The inverse of a rotation is its transpose.
  return [p[0], m[4]! * p[0] + m[5]! * p[1] + m[6]! * p[2], m[8]! * p[0] + m[9]! * p[1] + m[10]! * p[2]];
}

/** Lofts a sheet of cloth: `at(u, v)` the flat sail, bellying along `out` by `belly(u, v)`; both faces. */
function cloth(b: MeshBuilder, nu: number, nv: number, at: (u: number, v: number) => Vec3, out: Vec3, belly: (u: number, v: number) => number, colorOf: (i: number, j: number) => ColorInput): void {
  for (const sheet of [1, -1]) {
    const n: Vec3 = [out[0] * sheet, out[1] * sheet, out[2] * sheet];
    const p = (i: number, j: number): Vec3 => {
      const u = i / nu, v = j / nv;
      const q = at(u, v), d = belly(u, v) + sheet * GAP;
      return [q[0] + out[0] * d, q[1] + out[1] * d, q[2] + out[2] * d];
    };
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        b.setColor(colorOf(i, j));
        face(b, [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], [n, n, n, n]);
      }
    }
  }
}

/** The colour of panel (i across, j down) of a sail with `nu` × `nv` panels. */
function panels(mark: number, big: boolean, nu: number, nv: number, plain: ColorInput, emblem: ColorInput): (i: number, j: number) => ColorInput {
  return (i, j) => {
    if (mark === 1 && big) return i === Math.floor(nu / 2) || j === Math.floor(nv / 2) - (nv > 3 ? 1 : 0) ? emblem : plain;
    if (mark === 2) return i % 2 === 1 ? emblem : plain;
    if (mark === 3) return j === 1 ? emblem : plain;
    return plain;
  };
}

export default definePart({
  actor: 'ship-sail',
  build(item, ctx) {
    const kind = shipOfIndex(item.params?.ship ?? 0);
    const look = Math.abs(Math.round(item.params?.look ?? 0));
    const rig = rigOf(kind, look);
    const sail = rig.sails[Math.max(0, Math.min(rig.sails.length - 1, Math.round(item.params?.sail ?? 0)))]!;
    const paint = shipPaint(look, kind);
    const b = ctx.mesh();
    const furled = item.variant === 'yard';
    if (sail.kind === 'square') {
      const yard = sail.head / 2 + 0.14;
      if (furled) {
        b.with({ color: paint.spar, ink: 'yard' }, () => {
          // A spar tapering to both yardarms.
          b.at([0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], () => {
            b.lathe([[0, -yard - 0.02], [0.022, -yard], [0.042, 0], [0.022, yard], [0, yard + 0.02]], { segments: 6 });
          });
        });
        if (kind === 'barge') {
          // A barge's short mast comes down with its yard to pass under a bridge: it is drawn here.
          const m = rig.masts[sail.mast]!;
          b.with({ color: paint.spar, ink: 'mast' }, () => b.lathe([[m.r0, m.foot - sail.at[1] - 0.02], [m.r1, m.head - sail.at[1]], [0, m.head - sail.at[1] + 0.02]], { segments: 7 }));
        }
        // The sail furled along it: a soft roll under the yard, not quite to its ends.
        b.with({ color: paint.cloth, ink: 'furl' }, () => ball(b, 0, -0.06, 0.012, sail.head / 2 - 0.02, 0.055, 0.065, 10, 4));
      } else {
        const nu = 6, nv = 4;
        const big = sail.drop > 1.1 || kind !== 'galleon';
        cloth(
          b, nu, nv,
          (u, v) => {
            const w = sail.head + (sail.foot - sail.head) * v;
            // The foot rises a little in the middle (it is sheeted at its corners).
            const y = -0.05 - v * sail.drop + v * v * 0.1 * Math.sin(Math.PI * u);
            return [(u - 0.5) * w, y, 0];
          },
          [0, 0, 1],
          (u, v) => sail.belly * Math.sin(Math.PI * u) ** 0.7 * Math.sin(Math.PI * Math.min(1, 0.1 + v * 0.8)) ** 0.6,
          panels(paint.mark, big, nu, nv, paint.cloth, paint.emblem),
        );
      }
    } else {
      const f = intoLateen(sail, sail.yardFore!), a = intoLateen(sail, sail.yardAft!);
      const lenF = f[2], lenA = -a[2];
      if (furled) {
        b.with({ color: paint.spar, ink: 'yard' }, () => {
          b.at([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1], () => b.lathe([[0, -lenF - 0.02], [0.024, -lenF], [0.04, 0], [0.02, lenA], [0, lenA + 0.02]], { segments: 6 }));
        });
        b.with({ color: paint.cloth, ink: 'furl' }, () => ball(b, 0, -0.05, (lenF - lenA) / 2, 0.05, 0.05, (lenF + lenA) / 2 - 0.1, 5, 8));
      } else {
        const side = (item.params?.side ?? 1) < 0 ? -1 : 1;
        // The clew: low and aft, near the stern rail (in the ship's frame, relative to `at`).
        const clew = intoLateen(sail, [0, -sail.at[1] + rig.hull.rail(0.05) + 0.25, sail.yardAft![2] * 0.55]);
        cloth(
          b, 5, 4,
          (u, v) => {
            // u along the yard from its fore end aft; v down from the yard toward the clew.
            const top: Vec3 = [0, 0, lenF + (-lenA - lenF) * u];
            const bot: Vec3 = [0, clew[1], clew[2]];
            return [0, top[1] + (bot[1] - top[1]) * v - 0.04, top[2] + (bot[2] - top[2]) * v];
          },
          [side, 0, 0],
          (u, v) => sail.belly * Math.sin(Math.PI * u) ** 0.8 * Math.sin(Math.PI * Math.min(1, 0.12 + v * 0.75)) ** 0.7,
          panels(paint.mark === 1 ? 0 : paint.mark, false, 5, 4, paint.cloth, paint.emblem),
        );
      }
    }
    return { mesh: b.build(), animated: true };
  },
});
