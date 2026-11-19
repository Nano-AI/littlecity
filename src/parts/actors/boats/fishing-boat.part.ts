// The fishing boat (for L18): a chunky little working boat. A bluff, high
// bow with a short forecastle deck, bulwarks round a working deck, a
// wheelhouse with windows that light at dusk, a stove-pipe funnel, a stubby
// mast with a lantern, and on the after deck a heap of net with its floats
// and a couple of fish boxes. Tyre fenders hang along the sides.
//
// Frame: afloat. +Z is the bow, y = 0 the waterline (see hull.ts).

import { compose, rotationZ, translation, type Vec3 } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { BOATS } from '@/style/boats';
import { PALETTE, RAMPS } from '@/style/palette';
import { ball } from '../kit';
import { deck, drawHull, flat, spar, type HullSpec } from './hull';
import { boatPaint } from './paint';

export function fishingBoatSpec(): HullSpec {
  return {
    length: BOATS.fishLength,
    beam: BOATS.fishBeam,
    freeboard: 0.135,
    bowRise: 0.115,
    sternRise: 0.03,
    draft: 0.11,
    widest: 0.45,
    transom: 0.78,
    bowPoint: 0.82,
    stemRake: 0.32,
    transomRake: 0.1,
    round: 0.32,
    vee: 0.75,
    skin: 0.028,
    strake: 0.05,
    boot: 0.026,
    // The "sole" of this hull is its working deck: the sides stand above it as bulwarks.
    sole: 0.088,
    stations: 10,
  };
}

/** A tyre: a ring about the X axis at (x, y, z). */
function tyre(b: MeshBuilder, x: number, y: number, z: number, R: number, r: number): void {
  const profile: [number, number][] = [];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * Math.PI * 2;
    profile.push([R + r * Math.cos(a), r * Math.sin(a)]);
  }
  b.at(compose(translation(x, y, z), rotationZ(Math.PI / 2)), () => b.lathe(profile, { segments: 8 }));
}

export default definePart({
  actor: 'fishing-boat',
  build(item, ctx) {
    const b = ctx.mesh();
    const paint = boatPaint(item.params?.look);
    const spec = fishingBoatSpec();
    const hull = drawHull(b, spec, { ...paint, inside: paint.topsides, sole: paint.seat });
    const deckY = spec.sole;

    // The forecastle: a short raised deck in the bow.
    b.with({ color: paint.seat, ink: 'forecastle' }, () => deck(b, hull, 0.8, 1, 0.014, 0.014, 4));

    // The wheelhouse.
    const z0 = hull.z(0.47, deckY), z1 = hull.z(0.68, deckY);
    const w = 0.105, top = deckY + 0.205;
    b.with({ color: PALETTE.white, ink: 'house' }, () => {
      b.box([-w, deckY, z0], [w, top, z1], { skip: ['bottom', 'top'] });
      // Windows: two ahead, one each side, a port in the door aft. Panes and door read by colour.
      b.with({ color: PALETTE.glass, pattern: PATTERN.glass }, () => {
        const y0 = deckY + 0.105, y1 = top - 0.03, e = 0.004;
        for (const side of [-1, 1]) {
          const xa = side * 0.012, xb = side * (w - 0.018);
          flat(b, [[xa, y0, z1 + e], [xb, y0, z1 + e], [xb, y1, z1 + e], [xa, y1, z1 + e]], [0, 0, 1]);
          const x = side * (w + e);
          flat(b, [[x, y0, z0 + 0.05], [x, y0, z1 - 0.022], [x, y1, z1 - 0.022], [x, y1, z0 + 0.05]], [side, 0, 0]);
        }
      });
      b.with({ color: paint.accent }, () => flat(b, [[-0.04, deckY + 0.004, z0 - 0.004], [0.04, deckY + 0.004, z0 - 0.004], [0.04, top - 0.035, z0 - 0.004], [-0.04, top - 0.035, z0 - 0.004]], [0, 0, -1]));
    });
    b.with({ color: paint.accent, ink: 'roof' }, () => b.box([-w - 0.028, top, z0 - 0.035], [w + 0.028, top + 0.03, z1 + 0.04]));
    // The funnel, a little off the middle, with a dark band at its lip.
    b.with({ ink: 'funnel' }, () => {
      const fx = 0.035, fz = z0 + 0.055;
      b.at(translation(fx, 0, fz), () => {
        b.setColor(RAMPS.roof[0]!);
        b.lathe([[0.034, top + 0.03], [0.032, top + 0.115]], { segments: 8 });
        b.setColor(PALETTE.metal);
        b.lathe([[0.037, top + 0.115], [0.037, top + 0.145]], { segments: 8, capTop: true });
      });
    });

    // The mast, on the break of the forecastle, with its lantern.
    const mz = hull.z(0.79, deckY);
    b.with({ color: paint.spar, ink: 'mast' }, () => spar(b, 0, mz, deckY, 0.6, 0.018, 0.012));
    b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: 'lantern' }, () => ball(b, 0, 0.625, mz, 0.03, 0.034, 0.03, 6, 4));

    // The after deck: a heap of net with floats, and fish boxes.
    const netZ = hull.z(0.17, deckY);
    b.with({ color: RAMPS.roof[3]!, ink: 'net' }, () => {
      ball(b, -0.045, deckY + 0.012, netZ, 0.085, 0.045, 0.075, 8, 4);
      ball(b, 0.025, deckY + 0.01, netZ - 0.04, 0.06, 0.036, 0.055, 6, 4);
      b.setColor(PALETTE.yellow);
      const floats: Vec3[] = [[-0.075, deckY + 0.052, netZ + 0.03], [-0.02, deckY + 0.058, netZ - 0.01], [0.04, deckY + 0.044, netZ - 0.05]];
      for (const [x, y, z] of floats) ball(b, x, y, z, 0.02, 0.02, 0.02, 5, 3);
    });
    b.with({ color: RAMPS.wood[2]!, ink: 'boxes' }, () => {
      const bz = hull.z(0.33, deckY);
      b.boxAt([0.085, deckY, bz], [0.1, 0.06, 0.085], { skip: ['bottom'] });
      b.at(compose(translation(0.07, deckY + 0.06, bz + 0.012), [0.97, 0, -0.24, 0, 0, 1, 0, 0, 0.24, 0, 0.97, 0, 0, 0, 0, 1]), () => b.boxAt([0, 0, 0], [0.085, 0.05, 0.075], { skip: ['bottom'] }));
    });

    // Tyre fenders along the sides: one group.
    b.with({ color: PALETTE.metal, ink: 'fenders' }, () => {
      for (const side of [-1, 1]) {
        for (const t of [0.3, 0.58]) {
          const y = 0.072;
          tyre(b, side * (hull.outer(t, y) + 0.014), y, hull.z(t, y), 0.034, 0.016);
        }
      }
    });
    return { mesh: b.build(), animated: true };
  },
});
