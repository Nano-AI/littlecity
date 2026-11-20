// The watermill's parts (R-H16, RC-03): the wheel's frame on the mill wall
// (a feature, baked into the house) and the undershot wheel itself (an
// actor, turned by src/life/structures/water-wheel.behaviour.ts), in the
// pattern of the windmill's cap and sails.
//
// mill-race frame: the wall plane (house.gen's onWall), the ground storey's
// floor at y = 0, +Z out over the water. Its 'wheel-hub' anchor is the axle:
// low on the wall, so the wheel's lowest paddles dip into the stream (the
// water lies half a storey below the floor of a house on the bank).
// water-wheel frame: the 'wheel-hub' socket, +Z along the axle; the wheel
// lies in the XY plane and turns about Z.

import { CELL_H, SEA_Y } from '@/core/grid';
import { compose, rotationX, rotationZ, translation } from '@/core/mat4';
import { definePart } from '@/gen/api';
import { PATTERN, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';

/** The wheel: its radius, its width along the axle, and how far out from the wall its middle stands. */
export const WHEEL = { r: 0.36, w: 0.2, out: 0.25 };
/** The axle's height above the storey floor: the wheel dips 0.07 below the water line. */
const HUB_Y = SEA_Y - CELL_H + WHEEL.r - 0.07;

export const millRace = definePart({
  feature: 'mill-race',
  build(_item, ctx) {
    const b = ctx.mesh();
    const z1 = WHEEL.out + WHEEL.w / 2 + 0.07; // the outer frame, clear of the wheel
    const low = SEA_Y - CELL_H - 0.12; // down into the stream
    // Two posts out in the water and the bearing beam from the wall to the outer post's head.
    b.with({ color: PALETTE.trunk, pattern: PATTERN.planks, ink: 'posts' }, () => {
      for (const x of [-WHEEL.r - 0.06, WHEEL.r + 0.06]) b.box([x - 0.03, low, z1 - 0.03], [x + 0.03, 0.36, z1 + 0.03], { skip: ['bottom'] });
      b.box([-WHEEL.r - 0.09, 0.36, 0.0], [WHEEL.r + 0.09, 0.41, z1 + 0.04], { skip: ['n'] });
      b.box([-0.035, HUB_Y - 0.04, 0.0], [0.035, HUB_Y + 0.04, WHEEL.out - WHEEL.w / 2 - 0.01], { skip: ['n'] });
    });
    // A plank hood over the wheel, sloping out from the wall: it keeps the spray off the mill.
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'hood' }, () => {
      b.at(compose(translation(0, 0.5, 0), rotationX(0.3)), () => b.box([-WHEEL.r - 0.12, 0, 0], [WHEEL.r + 0.12, 0.03, z1 + 0.1], { skip: ['n'] }));
    });
    return { mesh: b.build(), anchors: { 'wheel-hub': translation(0, HUB_Y, WHEEL.out) } };
  },
});

/** A ring of boards round the wheel at z (a rim), as quads facing out and in. */
function rim(b: MeshBuilder, r0: number, r1: number, z0: number, z1: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (r: number, a: number, z: number): [number, number, number] => [Math.cos(a) * r, Math.sin(a) * r, z];
    b.quad(p(r1, a0, z1), p(r1, a0, z0), p(r1, a1, z0), p(r1, a1, z1)); // outer face
    b.quad(p(r0, a1, z1), p(r0, a1, z0), p(r0, a0, z0), p(r0, a0, z1)); // inner face
    b.quad(p(r0, a0, z1), p(r1, a0, z1), p(r1, a1, z1), p(r0, a1, z1)); // front
    b.quad(p(r1, a0, z0), p(r0, a0, z0), p(r0, a1, z0), p(r1, a1, z0)); // back
  }
}

export const waterWheel = definePart({
  actor: 'water-wheel',
  build(_item, ctx) {
    const b = ctx.mesh();
    const { r, w } = WHEEL;
    const h = w / 2;
    // The two rims.
    b.with({ color: PALETTE.trunk, pattern: PATTERN.planks, ink: 'rims' }, () => {
      rim(b, r - 0.05, r, h - 0.03, h, 14);
      rim(b, r - 0.05, r, -h, -h + 0.03, 14);
    });
    // Spokes on each face, and the hub.
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'spokes' }, () => {
      for (let k = 0; k < 6; k++) {
        for (const z of [h - 0.015, -h + 0.015]) b.at(compose(translation(0, 0, z), rotationZ((k * Math.PI) / 3)), () => b.box([-0.016, 0.04, -0.012], [0.016, r - 0.04, 0.012]));
      }
      b.lathe([[0.055, -h - 0.02], [0.055, h + 0.02]], { segments: 8, capTop: true, capBottom: true });
    });
    // The paddles across the rims: boards standing out from the wheel.
    b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'paddles' }, () => {
      for (let k = 0; k < 12; k++) {
        b.at(rotationZ((k * Math.PI) / 6 + Math.PI / 12), () => b.box([r - 0.08, -0.012, -h + 0.035], [r + 0.06, 0.012, h - 0.035]));
      }
    });
    return { mesh: b.build(), animated: true };
  },
});
