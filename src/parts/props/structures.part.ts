// Structure props (R-H98.structure-props, discovery round 1): the loose
// things that tell the new buildings' trades and uses from outside. Each is
// a handful of bold shapes in two or three ink groups, in the house style of
// the role props (src/parts/openings/role-prop.part.ts).
//
// Frames: every one stands at a floor slot, +Z as the rule faced it.

import { SEA_Y } from '@/core/grid';
import { compose, rotationX, rotationY, rotationZ, scaling, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

const BALL: [number, number][] = [[0, -1], [0.6, -0.8], [0.95, -0.3], [0.95, 0.3], [0.6, 0.8], [0, 1]];
/** A soft lump: a ball squashed to (rx, ry, rz). */
function lump(b: MeshBuilder, x: number, y: number, z: number, rx: number, ry: number, rz: number, turn = 0): void {
  b.at(compose(translation(x, y, z), rotationY(turn), scaling(rx, ry, rz)), () => b.lathe(BALL, { segments: 8 }));
}
/** A flame: a pointed glowing teardrop. */
function flame(b: MeshBuilder, x: number, y: number, z: number, r: number, h: number, ink: string): void {
  b.with({ color: PALETTE.yellow, pattern: PATTERN.glow, ink }, () =>
    b.at(translation(x, y, z), () => b.lathe([[r * 0.6, 0], [r, h * 0.25], [r * 0.7, h * 0.6], [0, h]], { segments: 7, capBottom: true })),
  );
}

export default definePart({
  prop: 'structure-prop',
  build(item, ctx) {
    const b = ctx.mesh();
    switch (item.variant) {
      case 'backdrop': {
        // R-M09: a theatre's painted backdrop: two posts, a cross beam, a painted cloth between them with an
        // arch painted on it, and the two masks (smiling gold, weeping white) on the beam. +Z faces the seats.
        const hw = 0.62, h = 0.95;
        b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'frame' }, () => {
          for (const x of [-hw, hw]) b.box([x - 0.035, 0, -0.06], [x + 0.035, h, 0.0], { skip: ['bottom'] });
          b.box([-hw - 0.07, h, -0.075], [hw + 0.07, h + 0.06, 0.015]);
        });
        b.with({ color: PALETTE.redDark, pattern: PATTERN.cloth, ink: 'cloth' }, () => {
          b.quad([-hw + 0.035, 0.1, -0.03], [hw - 0.035, 0.1, -0.03], [hw - 0.035, h, -0.03], [-hw + 0.035, h, -0.03]);
        });
        // Its back, seen from behind the stage: the bare canvas on its battens.
        b.with({ color: PALETTE.dirt, pattern: PATTERN.cloth, ink: 'canvas' }, () => {
          b.quad([hw - 0.035, 0.1, -0.036], [-hw + 0.035, 0.1, -0.036], [-hw + 0.035, h, -0.036], [hw - 0.035, h, -0.036]);
        });
        b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'battens' }, () => {
          for (const y of [0.32, 0.68]) b.box([-hw + 0.035, y - 0.025, -0.06], [hw - 0.035, y + 0.025, -0.036], { skip: ['s', 'e', 'w'] });
        });
        // A painted arch on the cloth, a hair in front of it.
        b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'paint' }, () => {
          const pts: [number, number, number][] = [];
          const r = 0.24, cy = 0.55, z = -0.026;
          pts.push([-r, 0.14, z]);
          for (let i = 0; i <= 8; i++) {
            const a = Math.PI - (i / 8) * Math.PI;
            pts.push([Math.cos(a) * r, cy + Math.sin(a) * r, z]);
          }
          pts.push([r, 0.14, z]);
          const inner = pts.map(([x, y]): [number, number, number] => [x * 0.75, 0.14 + (y - 0.14) * 0.85, z]);
          for (let i = 0; i + 1 < pts.length; i++) b.quad(inner[i]!, pts[i]!, pts[i + 1]!, inner[i + 1]!);
        });
        // The masks: two flat faces on the beam, tilted toward each other.
        const mask = (x: number, color: string, turn: number, ink: string): void => {
          b.at(compose(translation(x, h + 0.03, 0.03), rotationY(turn)), () => {
            b.with({ color, pattern: PATTERN.none, ink }, () => b.at(scaling(1, 1.15, 0.45), () => b.lathe(BALL.map(([r, y]) => [r * 0.075, y * 0.075] as [number, number]), { segments: 8 })));
            b.with({ color: PALETTE.ink, pattern: PATTERN.none, ink: `${ink}-eyes` }, () => {
              for (const ex of [-0.027, 0.027]) b.box([ex - 0.013, 0.012, 0.03], [ex + 0.013, 0.03, 0.036]);
            });
          });
        };
        mask(-0.16, PALETTE.yellow, 0.25, 'mask-a');
        mask(0.16, PALETTE.white, -0.25, 'mask-b');
        break;
      }
      case 'brazier': {
        // R-M09: an iron brazier on three legs, a fire in the bowl (it glows at dusk and night).
        b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'legs' }, () => {
          for (let k = 0; k < 3; k++) {
            b.at(compose(translation(0, 0.3, 0), rotationY((k * Math.PI * 2) / 3), rotationZ(0.22)), () => b.box([-0.012, -0.31, -0.012], [0.012, 0, 0.012], { skip: ['top'] }));
          }
        });
        b.with({ color: PALETTE.metal, pattern: PATTERN.metal, ink: 'bowl' }, () =>
          b.lathe([[0.03, 0.27], [0.11, 0.3], [0.13, 0.37]], { segments: 9, capBottom: true }),
        );
        b.with({ color: PALETTE.red, pattern: PATTERN.glow, ink: 'coals' }, () => b.box([-0.08, 0.35, -0.08], [0.08, 0.365, 0.08], { only: ['top'] }));
        flame(b, -0.02, 0.36, 0.01, 0.06, 0.2, 'flame');
        flame(b, 0.04, 0.36, -0.03, 0.04, 0.13, 'flame2');
        break;
      }
      case 'hay': {
        // R-H18: three square bales, two side by side and one on top, with a few loose wisps.
        const bale = (x: number, y: number, z: number, turn: number, ink: string): void => {
          b.at(compose(translation(x, y, z), rotationY(turn)), () => {
            b.with({ color: PALETTE.yellow, pattern: PATTERN.thatch, ink }, () => b.box([-0.1, 0, -0.065], [0.1, 0.12, 0.065], { skip: ['bottom'] }));
            b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: `${ink}-twine` }, () => {
              for (const tx of [-0.045, 0.045]) b.box([tx - 0.008, 0.001, -0.067], [tx + 0.008, 0.122, 0.067], { skip: ['bottom'] });
            });
          });
        };
        bale(-0.08, 0, 0.02, 0.1, 'bale-a');
        bale(0.13, 0, -0.04, -0.2 + ctx.rand('turn') * 0.3, 'bale-b');
        bale(0.02, 0.12, -0.01, 0.5, 'bale-c');
        b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'wisps' }, () => lump(b, -0.12, 0.01, 0.16, 0.08, 0.015, 0.05, 0.4));
        break;
      }
      case 'weir': {
        // R-H16: a timber weir across the stream: a row of stakes with a plank wall between them, its top
        // a little over the water, and a white line of foam where the water spills over on the far side.
        // From the bank (z = -0.5) straight out across `span` cells. The water lies at SEA_Y.
        const span = item.params?.span ?? 2;
        const z0 = -0.5, z1 = span - 0.5, top = SEA_Y + 0.07;
        b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'planks' }, () => b.box([-0.05, SEA_Y - 0.3, z0], [0.0, top, z1], { skip: ['bottom', 'n', 's'] }));
        b.with({ color: PALETTE.trunk, pattern: PATTERN.none, ink: 'stakes' }, () => {
          for (let z = z0 + 0.15; z < z1; z += 0.33) b.box([-0.085, SEA_Y - 0.3, z - 0.03], [-0.03, top + 0.06, z + 0.03], { skip: ['bottom'] });
        });
        b.with({ color: PALETTE.foam, pattern: PATTERN.foam, ink: 'foam' }, () => {
          b.quad([0.0, SEA_Y + 0.012, z0], [0.0, SEA_Y + 0.012, z1], [0.16, SEA_Y + 0.008, z1], [0.16, SEA_Y + 0.008, z0]);
        });
        break;
      }
      default:
        void rotationX;
        break;
    }
    return { mesh: b.build() };
  },
});
