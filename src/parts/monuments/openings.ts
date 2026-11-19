// Things set into a monument's wall: the small tower window, the tower
// door, arrow slits, clock faces and dove holes. Each is drawn in a wall
// frame: origin on the wall face, +Z out of the wall, +X to the viewer's
// right, +Y up.

import { translation, type Mat4Like } from '@/core/mat4';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { rand } from '@/core/rand';
import { PALETTE } from '@/style/palette';
import { INTERIOR } from '../openings/door-leaf';
import { ball, TAU } from './kit';

type Vec3 = [number, number, number];

/** An upright rectangle with a round head, as a polygon facing +Z at depth z. `n` segments in the head. */
function roundHead(w: number, h: number, z: number, x0 = 0, y0 = 0, n = 6): Vec3[] {
  const r = w / 2;
  const pts: Vec3[] = [
    [x0 - r, y0, z],
    [x0 + r, y0, z],
  ];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([x0 + r * Math.cos(a), y0 + h - r + r * Math.sin(a), z]);
  }
  return pts;
}

/** A round-headed block standing `depth` proud of the wall: its face and its rim. */
function roundHeadBlock(b: MeshBuilder, w: number, h: number, depth: number, x0 = 0, y0 = 0, n = 6): void {
  const face = roundHead(w, h, depth, x0, y0, n);
  b.polygon(face);
  for (let i = 0; i < face.length; i++) {
    const p = face[i]!, q = face[(i + 1) % face.length]!;
    if (i === 0 && y0 === 0) continue; // the foot stands on the ground or a sill
    b.quad([p[0], p[1], 0], [q[0], q[1], 0], q, p);
  }
}

/**
 * The small tower window (J13): a round-headed stone surround with a dark
 * pane that lights at dusk, and a sill. Origin: the sill's centre on the wall.
 */
export function slitWindow(b: MeshBuilder, id: string, stone: ColorInput, scale = 1): Record<string, Mat4Like> {
  const w = 0.17 * scale, h = 0.3 * scale;
  b.with({ color: stone, pattern: PATTERN.none, ink: `${id}-frame` }, () => {
    roundHeadBlock(b, w, h, 0.035, 0, 0.001);
    b.box([-w / 2 - 0.025, -0.035, 0], [w / 2 + 0.025, 0, 0.07]); // the sill
  });
  b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: `${id}-pane` }, () => {
    b.polygon(roundHead(w - 0.075 * scale, h - 0.055 * scale, 0.04, 0, 0.012, 5));
  });
  return { window: translation(0, 0, 0.07) };
}

/** A narrow arrow slit (R-T02, R-M03): a dark slot in a splayed stone surround. */
export function arrowSlit(b: MeshBuilder, id: string, stone: ColorInput): void {
  b.with({ color: stone, pattern: PATTERN.none, ink: `${id}-frame` }, () => b.box([-0.055, 0, 0], [0.055, 0.34, 0.03], { skip: ['n'] }));
  b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: `${id}-slot` }, () => {
    b.quad([-0.018, 0.03, 0.034], [0.018, 0.03, 0.034], [0.018, 0.31, 0.034], [-0.018, 0.31, 0.034]);
    b.quad([-0.05, 0.19, 0.034], [0.05, 0.19, 0.034], [0.05, 0.225, 0.034], [-0.05, 0.225, 0.034]);
  });
}

/**
 * The tower door: a round-headed plank door in a stone surround, with a
 * step. Origin: on the ground at the foot of the wall.
 */
export function towerDoor(b: MeshBuilder, stone: ColorInput, leaf: ColorInput, steps = 0, moving = false): Record<string, Mat4Like> {
  b.with({ color: stone, pattern: PATTERN.none, ink: 'door-frame' }, () => roundHeadBlock(b, 0.34, 0.5, 0.045, 0, 0, 8));
  // `moving`: the leaf is the 'door-leaf' actor's (it swings open); the wall shows a dark doorway.
  if (moving) b.with({ color: INTERIOR, pattern: PATTERN.none, ink: 'doorway' }, () => b.polygon(roundHead(0.23, 0.435, 0.046, 0, 0, 7)));
  else towerLeaf(b, leaf);
  b.with({ color: PALETTE.stoneShade, pattern: PATTERN.none, ink: 'door-step' }, () => {
    b.boxAt([0, 0, 0.09], [0.42, 0.05, 0.18], { skip: ['bottom'] });
    for (let i = 1; i <= steps; i++) b.boxAt([0, -i * 0.1, 0.09 + i * 0.07], [0.42, 0.1, 0.18 + i * 0.14], { skip: ['bottom'] });
  });
  return { door: translation(0, 0, 0.24) };
}

/** The colours a tower's door leaf is painted (by the tower's seed: towerLeafColor). */
const TOWER_DOORS = [PALETTE.redDark, PALETTE.wood, PALETTE.glass, PALETTE.leafDark];

/** The leaf colour of a monument's door: a tower's by its seed, a lighthouse's glass blue, a keep's wood. */
export function towerLeafColor(kind: string, seed: number): ColorInput {
  if (kind === 'lighthouse') return PALETTE.glass;
  if (kind === 'marble') return PALETTE.wood;
  return TOWER_DOORS[Math.floor(rand(seed, 'door') * TOWER_DOORS.length)]!;
}

/** The tower door's leaf alone: round-headed planks and a knob (the 'door-leaf' actor draws it when it moves). */
export function towerLeaf(b: MeshBuilder, leaf: ColorInput): void {
  b.with({ color: leaf, pattern: PATTERN.planksAcross, ink: 'door-leaf' }, () => b.polygon(roundHead(0.23, 0.435, 0.05, 0, 0, 7)));
  b.with({ color: PALETTE.yellow, pattern: PATTERN.none, ink: 'door-knob' }, () => ball(b, 0.06, 0.2, 0.058, 0.02, 0.02, 6));
}

/** Height of a belfry's bell pivot (under its beam) over the belfry storey's floor: sill 0.14 + 0.3. */
export const BELL_PIVOT = 0.44;

/** A bell hanging from its pivot at the origin (it reaches 0.25 down), mouth down. Colour and ink are the caller's. */
export function bellShape(b: MeshBuilder): void {
  b.lathe([[0.15, -0.25], [0.135, -0.225], [0.1, -0.16], [0.085, -0.06], [0.045, -0.01], [0, 0]], { segments: 10, capBottom: true });
}

/** The two hands of a clock, in the dial's plane at z = 0.05, at an hour (0–12, fractional). Ink and colour are the caller's. */
export function clockHands(b: MeshBuilder, radius: number, hour: number, which: 'both' | 'hour' | 'minute' = 'both'): void {
  const hand = (angle: number, len: number, w: number): void => {
    const c = Math.sin(angle), s = Math.cos(angle); // 0 = twelve o'clock, clockwise
    const px = s * w, py = -c * w;
    b.quad([-px, -py, 0.05], [px, py, 0.05], [c * len + px, s * len + py, 0.05], [c * len - px, s * len - py, 0.05]);
  };
  if (which !== 'minute') hand((hour / 12) * TAU, radius * 0.45, 0.016);
  if (which !== 'hour') hand((((hour * 12) % 12) / 12) * TAU, radius * 0.68, 0.012);
}

/** A clock (R-T03): a white dial in a dark rim, with hour ticks and two hands (still ones unless `hands` is false: L29 then draws moving ones at the 'clock-hands' socket). */
export function clockFace(b: MeshBuilder, id: string, radius: number, hour: number, hands = true): Record<string, Mat4Like> {
  const disc = (r: number, z: number, n = 16): Vec3[] => {
    const pts: Vec3[] = [];
    for (let i = 0; i < n; i++) pts.push([r * Math.cos((i / n) * TAU), r * Math.sin((i / n) * TAU), z]);
    return pts;
  };
  b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: `${id}-rim` }, () => {
    const rim = disc(radius, 0.04);
    b.polygon(rim);
    for (let i = 0; i < rim.length; i++) {
      const p = rim[i]!, q = rim[(i + 1) % rim.length]!;
      b.quad([p[0], p[1], 0], [q[0], q[1], 0], q, p);
    }
  });
  // The dial, its ticks and its hands share one group: they read by colour.
  b.setInk(`${id}-dial`);
  // The dial is lit from behind after dark.
  b.with({ color: PALETTE.white, pattern: PATTERN.glow }, () => b.polygon(disc(radius - 0.035, 0.045)));
  b.with({ color: PALETTE.metal, pattern: PATTERN.none }, () => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const c = Math.sin(a), s = Math.cos(a), r0 = radius - 0.075, r1 = radius - 0.045;
      b.quad([c * r0 - s * 0.012, s * r0 + c * 0.012, 0.048], [c * r0 + s * 0.012, s * r0 - c * 0.012, 0.048], [c * r1 + s * 0.012, s * r1 - c * 0.012, 0.048], [c * r1 - s * 0.012, s * r1 + c * 0.012, 0.048]);
    }
    if (hands) clockHands(b, radius, hour);
  });
  return { 'clock-hands': translation(0, 0, 0.05) };
}

/** Dove holes (R-T05): two rows of little arched holes over a perching ledge. */
export function doveHoles(b: MeshBuilder, id: string, stone: ColorInput): Record<string, Mat4Like> {
  b.with({ color: stone, pattern: PATTERN.none, ink: `${id}-ledge` }, () => {
    b.box([-0.2, 0.12, 0], [0.2, 0.15, 0.075]);
    b.box([-0.14, 0.36, 0], [0.14, 0.39, 0.065]);
  });
  b.with({ color: PALETTE.metal, pattern: PATTERN.none, ink: `${id}-holes` }, () => {
    for (const [x, y] of [[-0.11, 0.15], [0, 0.15], [0.11, 0.15], [-0.055, 0.39], [0.055, 0.39]] as const) {
      b.polygon(roundHead(0.065, 0.1, 0.012, x, y, 4));
    }
  });
  return { perch: translation(0, 0.15, 0.06) };
}
