// Door leaves (animation polish, 2026-11-19: "doors that open"). The leaf of
// every door look, drawn in one place so the still door and the moving one
// are the same drawing:
//
//   - the door feature part (door.part.ts) and the monuments' tower door
//     (src/parts/monuments/openings.ts) draw the leaf into the baked wall when
//     nothing animates it;
//   - when the 'door-leaf' actor part exists (src/parts/actors/doors/), they
//     draw a dark doorway instead, and the actor draws the leaf as its own
//     instance, hinged at one side, which life swings open
//     (src/life/doors/door-leaf.behaviour.ts).
//
// Frame: the door's wall plane (see lib.ts): origin on the wall surface at
// the foot of the door, +X to the viewer's right, +Y up, +Z out of the wall.
// Doors open OUTWARD: the house has no inside to swing into, and a leaf laid
// back against the outside wall reads at once.

import { rotationX, translation, type Mat4 } from '@/core/mat4';
import { PATTERN, type ColorInput, type MeshBuilder } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { archPts, bar, bead, face, rectPts, shrink, slab, type P2 } from './lib';

/** Every kind of leaf. 'tower' is the monuments' round-headed plank door; 'hatch' a trapdoor in a terrace floor. */
export type LeafKind = 'plain' | 'deck' | 'shop' | 'double' | 'tower' | 'hatch';

/** The house door looks (Personality.door). */
export type DoorLook = 'plank' | 'panel' | 'arched' | 'glazed';

/** The colour of the dark inside behind an open door: a warm near-black, a step lighter than the ink. */
export const INTERIOR = '#4a3d37';

/** How far out from the wall the closed leaf's face stands, and how thick a leaf is. */
const LEAF_Z = 0.049;
const LEAF_T = 0.012;

/**
 * One leaf's hinge. Closed, the leaf runs from x = `hinge` toward `dir` for `width`. It swings out (toward
 * +Z) about the vertical line (hinge, z), by up to `swing` radians.
 */
export interface Hinge {
  hinge: number;
  z: number;
  width: number;
  dir: 1 | -1;
  swing: number;
}

const DEG = Math.PI / 180;

/** The leaves of a door kind (one, or two for a double door). A hatch has none: see HATCH. */
export function hingesOf(kind: LeafKind): readonly Hinge[] {
  switch (kind) {
    case 'shop':
      return [{ hinge: -0.36, z: 0.045, width: 0.2, dir: 1, swing: 110 * DEG }];
    case 'double':
      // Clear of the chapel porch's posts (x = ±0.3, 0.21 out).
      return [
        { hinge: -0.2, z: 0.05, width: 0.2, dir: 1, swing: 100 * DEG },
        { hinge: 0.2, z: 0.05, width: 0.2, dir: -1, swing: 100 * DEG },
      ];
    case 'tower':
      return [{ hinge: -0.115, z: 0.045, width: 0.23, dir: 1, swing: 105 * DEG }];
    case 'hatch':
      return [];
    default:
      // 110°: past square, so the open leaf leans back toward the wall, clear of the doorstep's pots, barrel
      // and lantern (x = -0.25, -0.36, -0.215) and of anyone walking up to the door.
      return [{ hinge: -0.13, z: 0.045, width: 0.26, dir: 1, swing: 110 * DEG }];
  }
}

/** The trapdoor: hinged along the top of its far edge (z = -0.17), it flops right over onto the terrace beyond (up to `lift` radians), so nobody walks into a lid standing up. */
export const HATCH = { hinge: -0.17, y: 0.05, size: 0.34, lift: 172 * DEG } as const;

/**
 * The world-from-socket offset of a door's wall frame: the 'door' socket is the threshold on the ground
 * outside (door.part.ts, openings.ts), the leaves are drawn on the wall. Returns the wall frame in the
 * socket's frame.
 */
export function wallInSocket(kind: LeafKind, steps: number): Mat4 {
  const rise = 0.16, out = 0.17 + steps * 0.1;
  switch (kind) {
    case 'deck':
      return translation(0, 0, -0.3);
    case 'shop':
      return translation(0.26, steps * rise, -(out + 0.2));
    case 'tower':
      return translation(0, 0, -0.24);
    case 'hatch':
      return translation(0, -0.05, 0);
    default:
      return translation(0, steps * rise, -(out + 0.2));
  }
}

/** The local matrix (in the wall frame) of one leaf swung open by `angle` radians. */
export function leafSwing(h: Hinge, angle: number): Mat4 {
  // About +Y by φ: (x, z) → (x cos φ + z sin φ, −x sin φ + z cos φ). Out toward +Z is φ = −dir·angle.
  const phi = -h.dir * angle;
  const c = Math.cos(phi), s = Math.sin(phi);
  const hx = h.hinge, hz = h.z;
  // T(h) · Ry(φ) · T(−h)
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, hx - c * hx - s * hz, 0, hz + s * hx - c * hz, 1];
}

/** The local matrix (in the hatch's frame) of the trapdoor lifted by `angle` radians about its far edge. */
export function hatchLift(angle: number): Mat4 {
  // About +X through (y, z) = (HATCH.y, HATCH.hinge); positive angle lifts the near edge (+Z) up.
  const r = rotationX(-angle);
  const y = HATCH.y, z = HATCH.hinge;
  const c = Math.cos(-angle), s = Math.sin(-angle);
  r[13] = y - c * y + s * z;
  r[14] = z - s * y - c * z;
  return r;
}

/** Where one leaf lies at an angle, in the wall frame's x–z plane: its hinge end and its free end. */
export function leafLine(h: Hinge, angle: number): [x0: number, z0: number, x1: number, z1: number] {
  return [h.hinge, h.z, h.hinge + h.dir * h.width * Math.cos(angle), h.z + h.width * Math.sin(angle)];
}

// ── drawing ─────────────────────────────────────────────────────────────

function knob(b: MeshBuilder, x: number, y: number, z: number): void {
  b.with({ color: PALETTE.yellow, ink: 'knob' }, () => bead(b, x, y, z, 0.02));
}

/** The outline of a house door's leaf (plain and deck doors). */
export function houseLeafOutline(look: DoorLook): P2[] {
  return look === 'arched' ? archPts(0.26, 0.37, 0.0) : rectPts(0.26, 0.505, 0);
}

/** A house door's leaf as the still door draws it: the painted face, its glass or panels, the knob. */
export function houseLeaf(b: MeshBuilder, look: DoorLook, accent: ColorInput): void {
  const leaf = houseLeafOutline(look);
  b.with({ color: accent, pattern: look === 'plank' ? PATTERN.planksAcross : PATTERN.none, ink: 'leaf' }, () => face(b, leaf, LEAF_Z));
  if (look === 'glazed') {
    b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'leaf' }, () => face(b, rectPts(0.17, 0.2, 0.26), 0.052));
    b.with({ ink: 'leaf' }, () => bar(b, 0, 0.26, 0, 0.46, 0.02, 0.055));
  } else if (look === 'panel') {
    // Two raised panels: the same paint, so they read by their edges alone.
    b.with({ color: accent, ink: 'leaf' }, () => {
      slab(b, -0.085, 0.085, 0.3, 0.45, 0.049, 0.062);
      slab(b, -0.085, 0.085, 0.07, 0.24, 0.049, 0.062);
    });
  } else if (look === 'plank') {
    // A small diamond light.
    b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'leaf' }, () =>
      face(b, [[0, 0.33], [0.045, 0.385], [0, 0.44], [-0.045, 0.385]], 0.052));
  } else {
    // arched: a fanlight in the round head
    b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'leaf' }, () => face(b, archPts(0.2, 0, 0.39, 0, 6), 0.052));
    b.with({ ink: 'leaf' }, () => bar(b, 0, 0.39, 0, 0.485, 0.018, 0.055));
  }
  knob(b, 0.085, 0.24, 0.058);
}

/** The outline of a shop's glazed door. */
export const shopLeafOutline = (): P2[] => rectPts(0.2, 0.46, 0.02, -0.26);

/** A shop's door: painted, with a tall pane and a knob. */
export function shopLeaf(b: MeshBuilder, accent: ColorInput): void {
  b.with({ color: accent, ink: 'leaf' }, () => face(b, shopLeafOutline(), LEAF_Z));
  b.with({ color: PALETTE.glass, pattern: PATTERN.glass, ink: 'leaf' }, () => face(b, rectPts(0.13, 0.22, 0.21, -0.26), 0.052));
  knob(b, -0.19, 0.2, 0.056);
}

/** The chapel door's round-headed opening, both leaves together. */
export function doubleOutline(): P2[] {
  return shrink(archPts(0.5, 0.38, 0), 0.05).map(([x, y]) => [x, Math.max(y, 0.0)] as const);
}

/** A convex outline cut to the side x ≤ 0 (`side` −1) or x ≥ 0 (`side` 1). */
function half(pts: readonly P2[], side: -1 | 1): P2[] {
  const out: P2[] = [];
  const inside = (p: P2): boolean => p[0] * side >= -1e-9;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = a[0] / (a[0] - b[0]);
      out.push([0, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** One leaf (or both) of the chapel's double door: boards, iron straps, the knob. */
export function doubleLeaf(b: MeshBuilder, which: 'both' | 'left' | 'right'): void {
  const sides: (-1 | 1)[] = which === 'both' ? [-1, 1] : which === 'left' ? [-1] : [1];
  const outline = which === 'both' ? doubleOutline() : half(doubleOutline(), which === 'left' ? -1 : 1);
  b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'leaf' }, () => face(b, outline, 0.054));
  b.with({ color: PALETTE.metal, ink: 'leaf' }, () => {
    // The strap down the meeting stiles: whole on the still door, half on each moving leaf.
    if (which === 'both') bar(b, 0, 0.02, 0, 0.55, 0.014, 0.058);
    else bar(b, sides[0]! * 0.0035, 0.02, sides[0]! * 0.0035, 0.55, 0.007, 0.058);
    for (const side of sides) for (const y of [0.14, 0.34]) bar(b, side * 0.19, y, side * 0.05, y, 0.022, 0.058);
  });
  for (const side of sides) knob(b, side * 0.035, 0.25, 0.062);
}

/** The double door's outline for one leaf. */
export const doubleLeafOutline = (side: -1 | 1): P2[] => half(doubleOutline(), side);

/** The monuments' tower door: a round-headed plank leaf (towerDoor in src/parts/monuments/openings.ts). */
export function towerLeafOutline(): P2[] {
  const w = 0.23, h = 0.435, r = w / 2, n = 7;
  const pts: P2[] = [[-r, 0], [r, 0]];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([r * Math.cos(a), h - r + r * Math.sin(a)]);
  }
  return pts;
}

/** The dark doorway left when the leaf is drawn by the actor: the leaf's outline, a hair behind it. */
export function doorway(b: MeshBuilder, outline: readonly P2[], z = 0.046): void {
  b.with({ color: INTERIOR, pattern: PATTERN.none, ink: 'doorway' }, () => face(b, outline, z));
}

/**
 * The back and the edges of a leaf, so it still reads once it has swung round: its outline extruded from
 * the face back by the leaf's thickness, and a back face.
 */
export function leafBody(b: MeshBuilder, outline: readonly P2[], color: ColorInput, front = LEAF_Z): void {
  const back = front - LEAF_T;
  b.with({ color, pattern: PATTERN.none, ink: 'leaf' }, () => {
    b.at(rotationX(Math.PI / 2), () => b.extrude(outline.map(([x, y]) => [x, -y] as const), back, front - 0.0005, { cap: 'none' }));
    face(b, [...outline].reverse(), back);
  });
}

/** The trapdoor's lid (the hatch frame stays in the floor). In the hatch frame: the cell's floor centre. */
export function hatchLid(b: MeshBuilder): void {
  b.with({ color: PALETTE.wood, pattern: PATTERN.planks, ink: 'hatch' }, () => b.boxAt([0, 0.035, 0], [0.34, 0.015, 0.34]));
  b.with({ color: PALETTE.metal, ink: 'hatch-ring' }, () => b.boxAt([0.1, 0.05, 0], [0.05, 0.012, 0.09], { skip: ['bottom'] }));
}

/** The hatch's frame, and (when the lid is the actor's) the dark hole under the lid. */
export function hatchFrame(b: MeshBuilder, trim: ColorInput, hole: boolean): void {
  b.with({ color: trim, ink: 'hatch-frame' }, () => b.boxAt([0, 0, 0], [0.42, 0.035, 0.42], { skip: ['bottom'] }));
  if (hole) b.with({ color: INTERIOR, pattern: PATTERN.none, ink: 'doorway' }, () => b.boxAt([0, 0.0352, 0], [0.34, 0.0005, 0.34], { skip: ['bottom'] }));
}
