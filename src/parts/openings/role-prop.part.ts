// Role props (Houses owner; R-H99.role-props): the few things that tell a
// house's trade from outside. A boathouse's slipway and drying net, an inn's
// lantern, a mill house's flour sacks and hand cart, a lookout cottage's
// telescope. Each is a handful of bold shapes in two or three ink groups.
//
// Frames: slipway and lantern sit at the house's 'door' socket (the
// threshold outside, +Z out); the others at a floor slot, +Z as the rule
// faced them (the net: away from the wall it hangs on).

import { compose, rotationX, rotationY, rotationZ, scaling, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { bead } from './lib';

const BALL: [number, number][] = [[0, -1], [0.6, -0.8], [0.95, -0.3], [0.95, 0.3], [0.6, 0.8], [0, 1]];
/** A soft lump: a ball squashed to (rx, ry, rz). */
function lump(b: MeshBuilder, x: number, y: number, z: number, rx: number, ry: number, rz: number, turn = 0): void {
  b.at(compose(translation(x, y, z), rotationY(turn), scaling(rx, ry, rz)), () => b.lathe(BALL, { segments: 8 }));
}
/** A wheel: a short cylinder on its side, its axle along X. */
function wheel(b: MeshBuilder, x: number, y: number, z: number, r: number, w: number): void {
  b.at(compose(translation(x, y, z), rotationZ(Math.PI / 2)), () => b.lathe([[r, -w / 2], [r, w / 2]], { segments: 10, capTop: true, capBottom: true }));
}

export default definePart({
  prop: 'role-prop',
  build(item, ctx) {
    const b = ctx.mesh();
    switch (item.variant) {
      case 'slipway': {
        // Planks from the boat doors down into the water, on two stringers and a pair of posts.
        const hw = 0.3, z0 = -0.3, z1 = 0.78, y0 = 0.02, y1 = -0.5;
        b.with({ color: PALETTE.wood, pattern: PATTERN.planksAcross, ink: 'ramp' }, () => {
          b.quad([-hw, y0, z0], [-hw, y1, z1], [hw, y1, z1], [hw, y0, z0]);
          b.quad([hw, y0 - 0.04, z0], [hw, y1 - 0.04, z1], [-hw, y1 - 0.04, z1], [-hw, y0 - 0.04, z0]);
          b.quad([hw, y0 - 0.04, z0], [hw, y0, z0], [hw, y1, z1], [hw, y1 - 0.04, z1]);
          b.quad([-hw, y0, z0], [-hw, y0 - 0.04, z0], [-hw, y1 - 0.04, z1], [-hw, y1, z1]);
        });
        b.with({ color: PALETTE.trunk, ink: 'frame' }, () => {
          for (const x of [-hw + 0.03, hw - 0.03]) {
            b.quad([x + 0.025, y0 - 0.04, z0], [x + 0.025, y0 - 0.1, z0], [x + 0.025, y1 - 0.1, z1], [x + 0.025, y1 - 0.04, z1]);
            b.quad([x - 0.025, y0 - 0.1, z0], [x - 0.025, y0 - 0.04, z0], [x - 0.025, y1 - 0.04, z1], [x - 0.025, y1 - 0.1, z1]);
            b.boxAt([x, -0.62, 0.36], [0.05, 0.36, 0.05], { skip: ['bottom', 'top'] });
          }
        });
        break;
      }
      case 'net': {
        // A net hung to dry: draped between two pegs on the wall behind (z < 0), floats along its foot.
        const z = -0.2, pegs = [-0.27, 0.27], top = 0.56;
        b.with({ color: PALETTE.trunk, ink: 'pegs' }, () => {
          for (const x of pegs) b.box([x - 0.015, top - 0.015, z - 0.02], [x + 0.015, top + 0.015, z + 0.05]);
        });
        b.with({ color: PALETTE.sand, pattern: PATTERN.cloth, ink: 'net' }, () => {
          const n = 6;
          for (let i = 0; i < n; i++) {
            const t0 = i / n, t1 = (i + 1) / n;
            const x0 = pegs[0]! + (pegs[1]! - pegs[0]!) * t0, x1 = pegs[0]! + (pegs[1]! - pegs[0]!) * t1;
            const sag = (t: number): number => top - 0.09 * Math.sin(Math.PI * t);
            const foot = (t: number): number => 0.17 + 0.05 * Math.cos(Math.PI * 4 * t) + ctx.rand('foot', Math.round(t * n)) * 0.03;
            b.quad([x0, foot(t0), z + 0.03], [x1, foot(t1), z + 0.03], [x1, sag(t1), z + 0.03], [x0, sag(t0), z + 0.03]);
          }
        });
        b.with({ color: PALETTE.red, ink: 'floats' }, () => {
          for (let i = 0; i < 4; i++) bead(b, -0.2 + i * 0.133, 0.19 + (i % 2) * 0.03, z + 0.05, 0.026);
        });
        break;
      }
      case 'lantern': {
        // An iron bracket on the wall beside the door, a lantern hanging from it.
        const back = item.params?.back ?? 0.37, up = item.params?.up ?? 0;
        b.at(translation(-0.29, up + 0.52, -back), () => {
          b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'bracket' }, () => {
            b.box([-0.012, 0.1, 0], [0.012, 0.124, 0.15]);
            b.quad([-0.01, 0.02, 0], [0.01, 0.02, 0], [0.01, 0.1, 0.1], [-0.01, 0.1, 0.1]);
            b.box([-0.045, 0.03, 0.075], [0.045, 0.055, 0.165]);
            b.box([-0.045, -0.075, 0.075], [0.045, -0.055, 0.165]);
            b.box([-0.006, 0.055, 0.114], [0.006, 0.1, 0.126]);
          });
          b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink: 'lamp' }, () => b.box([-0.035, -0.055, 0.085], [0.035, 0.03, 0.155], { skip: ['top', 'bottom'] }));
        });
        break;
      }
      case 'sacks': {
        // Three flour sacks: two on the ground, one slumped across them.
        b.with({ color: PALETTE.white, pattern: PATTERN.cloth, ink: 'sacks' }, () => {
          lump(b, -0.08, 0.07, 0, 0.1, 0.075, 0.075, 0.3);
          lump(b, 0.09, 0.07, 0.03, 0.1, 0.075, 0.075, -0.5);
          lump(b, 0.0, 0.185, 0.01, 0.1, 0.065, 0.075, 0.1 + ctx.rand('turn') * 0.6);
        });
        b.with({ color: PALETTE.trunk, ink: 'ties' }, () => {
          bead(b, -0.185, 0.085, 0.03, 0.022);
          bead(b, 0.195, 0.085, -0.015, 0.022);
        });
        break;
      }
      case 'cart': {
        // A two-wheeled hand cart, tipped onto its handles, a sack in it.
        b.at(rotationY((ctx.rand('turn') - 0.5) * 0.7), () => {
          b.at(compose(translation(0, 0.13, 0), rotationX(-0.16)), () => {
            b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'bed' }, () => {
              b.box([-0.15, 0, -0.2], [0.15, 0.03, 0.2]);
              b.box([-0.15, 0.03, -0.2], [-0.125, 0.12, 0.2], { skip: ['bottom'] });
              b.box([0.125, 0.03, -0.2], [0.15, 0.12, 0.2], { skip: ['bottom'] });
              b.box([-0.125, 0.03, -0.2], [0.125, 0.12, -0.175], { skip: ['bottom', 'e', 'w'] });
              // the handles
              for (const x of [-0.138, 0.138]) b.box([x - 0.012, 0.0, 0.2], [x + 0.012, 0.024, 0.43]);
            });
            b.with({ color: PALETTE.white, pattern: PATTERN.cloth, ink: 'load' }, () => lump(b, 0, 0.1, -0.03, 0.11, 0.07, 0.085, 0.4));
          });
          b.with({ color: PALETTE.trunk, ink: 'wheels' }, () => {
            wheel(b, -0.175, 0.11, -0.03, 0.11, 0.03);
            wheel(b, 0.175, 0.11, -0.03, 0.11, 0.03);
          });
        });
        break;
      }
      case 'telescope': {
        // A brass telescope on a wooden tripod, pointed out to sea.
        const head = 0.34;
        b.with({ color: PALETTE.trunk, ink: 'tripod' }, () => {
          for (let k = 0; k < 3; k++) {
            b.at(compose(translation(0, head, 0), rotationY((k * Math.PI * 2) / 3 + 0.5), rotationZ(0.33)), () => b.box([-0.012, -head / Math.cos(0.33), -0.012], [0.012, 0, 0.012], { skip: ['top'] }));
          }
          b.boxAt([0, head - 0.01, 0], [0.05, 0.035, 0.05]);
        });
        b.with({ color: PALETTE.yellow, pattern: PATTERN.metal, ink: 'tube' }, () => {
          b.at(compose(translation(0, head + 0.05, 0), rotationX(Math.PI / 2 - 0.35), translation(0, -0.13, 0)), () => {
            b.lathe([[0.034, 0], [0.034, 0.2], [0.026, 0.2], [0.026, 0.33]], { segments: 8, capTop: true, capBottom: true });
          });
        });
        break;
      }
      default:
        break;
    }
    return { mesh: b.build() };
  },
});
