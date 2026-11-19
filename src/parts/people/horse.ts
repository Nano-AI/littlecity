// The rider's horse (L37). Pure: meshes and poses; the garrison system
// places them (src/life/people/garrison.system.ts).
//
// Like a person (person.ts) the horse is rigid pieces round their own
// pivots, posed with matrices, so nothing is re-meshed while it moves:
//
//   body    barrel, chest, neck and head, the saddle cloth. Origin on the
//           ground under the middle of the horse, +Y up, facing +Z.
//   legFL legFR legBL legBR   origin at the shoulder or hip, hanging down −Y
//   tail    origin at its root, hanging down and back
//
// Drawn in the game's hand at a person's scale: a clear silhouette at
// playing zoom (long back, arched neck, the head down and forward, four
// thin legs with dark hooves, a swinging tail), flat coat colour, one ink
// group for the whole animal and one for its mane and tail.

import { rotationX, rotationY, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { tube } from '@/parts/ground/kit';
import { PALETTE } from '@/style/palette';

export const HORSE_PIECES = ['body', 'legFL', 'legFR', 'legBL', 'legBR', 'tail'] as const;
export type HorsePiece = (typeof HORSE_PIECES)[number];

/** Coats: bay, chestnut, grey, black; and the darker mane and tail of each. */
const COATS: readonly [coat: string, mane: string][] = [
  ['#8e5c3d', '#3d2a22'],
  ['#ad6a40', '#6b3a22'],
  ['#cfc8bc', '#8a847c'],
  ['#4f4038', '#2c231f'],
];

/** Where the legs and tail hang from, in the body's frame. */
const HIP = { x: 0.04, y: 0.22, front: 0.11, back: -0.13 } as const;
const TAIL = [0, 0.31, -0.185] as const;
const LEG = 0.205;
/** The saddle's top, where a rider's hips rest. */
export const SADDLE = { y: 0.345, z: -0.02 } as const;

export function buildHorse(look: number, cloth: string): Record<HorsePiece, MeshData> {
  const [coat, mane] = COATS[((look % COATS.length) + COATS.length) % COATS.length]!;
  const piece = (draw: (b: MeshBuilder) => void): MeshData => {
    const b = new MeshBuilder({ ink: `horse${look}` });
    draw(b);
    return b.build();
  };
  const leg = (b: MeshBuilder): void => {
    b.setInk('horse').setPattern(PATTERN.none).setColor(coat);
    tube(b, [[0, 0.02, 0], [0, -LEG * 0.55, 0.004], [0, -LEG + 0.022, 0]], [0.019, 0.014, 0.012], { seg: 5 });
    b.setColor(PALETTE.ink);
    b.box([-0.014, -LEG, -0.012], [0.014, -LEG + 0.024, 0.016]);
  };
  return {
    body: piece((b) => {
      b.setInk('horse').setPattern(PATTERN.none).setColor(coat);
      // The barrel: longer than it is round, a little narrower than it is deep.
      b.at(translation(0, 0.27, -0.015), () => b.at(rotationX(Math.PI / 2), () => b.lathe([[0, -0.19], [0.05, -0.18], [0.075, -0.1], [0.078, 0.02], [0.07, 0.13], [0.045, 0.17], [0, 0.18]], { segments: 9 })));
      // The neck, arched up and forward from the chest; the head down and forward from its top.
      tube(b, [[0, 0.28, 0.12], [0, 0.37, 0.19], [0, 0.44, 0.23]], [0.055, 0.042, 0.032], { seg: 7 });
      tube(b, [[0, 0.455, 0.225], [0, 0.42, 0.29], [0, 0.375, 0.33]], [0.033, 0.03, 0.022], { seg: 6, capEnd: true });
      // Ears.
      for (const x of [-0.015, 0.015]) b.quad([x - 0.008, 0.46, 0.215], [x + 0.008, 0.46, 0.215], [x + 0.002, 0.495, 0.205], [x - 0.002, 0.495, 0.205]);
      // The saddle cloth in the garrison's colour, and the saddle on it.
      b.setInk('saddle').setColor(cloth).setPattern(PATTERN.cloth);
      b.box([-0.083, 0.215, SADDLE.z - 0.075], [0.083, 0.336, SADDLE.z + 0.065], { skip: ['bottom'] });
      b.setColor(PALETTE.trunk).setPattern(PATTERN.none);
      b.box([-0.045, 0.33, SADDLE.z - 0.055], [0.045, SADDLE.y, SADDLE.z + 0.05]);
      // The mane along the top of the neck.
      b.setInk('mane').setColor(mane);
      tube(b, [[0, 0.33, 0.13], [0, 0.415, 0.18], [0, 0.48, 0.215]], [0.012, 0.014, 0.01], { seg: 4 });
    }),
    legFL: piece(leg),
    legFR: piece(leg),
    legBL: piece(leg),
    legBR: piece(leg),
    tail: piece((b) => {
      b.setInk('mane').setPattern(PATTERN.none).setColor(mane);
      tube(b, [[0, 0, 0], [0, -0.05, -0.045], [0, -0.17, -0.06]], [0.016, 0.022, 0.012], { seg: 5, capEnd: true });
    }),
  };
}

export type Gait = 'stand' | 'walk' | 'trot';

export interface HorsePose {
  /** Forward (+) swing of each leg, radians: FL, FR, BL, BR. */
  legs: [number, number, number, number];
  /** The tail swung aside (about the vertical), and lifted. */
  tail: number;
  tailLift: number;
  /** The whole horse raised (a trot's spring), world units. */
  lift: number;
}

/** Drawings a stride (walk and trot are both shot on twos: four held drawings a stride). */
const DRAWINGS = 4;

/**
 * The pose at a moment. Walk and trot: `phase` is the stride phase (0–1 a stride), snapped to four
 * drawings: a walk steps one leg after another (left hind, left fore, right hind, right fore), a trot
 * springs on diagonal pairs. Standing: `phase` is seconds; the tail flicks now and then.
 */
export function horsePose(gait: Gait, phase: number, seed = 0): HorsePose {
  const p: HorsePose = { legs: [0, 0, 0, 0], tail: 0, tailLift: 0, lift: 0 };
  if (gait === 'stand') {
    const k = Math.floor(phase * 3 + seed * 11) % 17;
    if (k === 5) p.tail = 0.45;
    if (k === 6) p.tail = -0.35;
    if (k === 12) p.legs[3] = 0.12; // a rested hind hoof
    return p;
  }
  const q = Math.floor((((phase % 1) + 1) % 1) * DRAWINGS + 0.5) / DRAWINGS;
  const wave = (off: number, amp: number): number => Math.sin((q - off) * Math.PI * 2) * amp;
  if (gait === 'walk') {
    p.legs = [wave(0.25, 0.32), wave(0.75, 0.32), wave(0, 0.3), wave(0.5, 0.3)];
    p.tail = wave(0.1, 0.12);
  } else {
    p.legs = [wave(0, 0.5), wave(0.5, 0.5), wave(0.5, 0.45), wave(0, 0.45)];
    p.lift = Math.abs(Math.sin(q * Math.PI * 2)) * 0.022;
    p.tailLift = 0.35;
    p.tail = wave(0.25, 0.1);
  }
  return p;
}

/** Local matrices of the six pieces (HORSE_PIECES order) in a pose, into `out` (6 × 16). */
export function horseMatrices(pose: HorsePose, out: Float32Array = new Float32Array(96)): Float32Array {
  const put = (i: number, m: readonly number[]): void => {
    for (let k = 0; k < 16; k++) out[i * 16 + k] = m[k]!;
  };
  const up = pose.lift;
  put(0, translation(0, up, 0));
  const legs: [number, number][] = [[-HIP.x, HIP.front], [HIP.x, HIP.front], [-HIP.x, HIP.back], [HIP.x, HIP.back]];
  legs.forEach(([x, z], i) => {
    const m = rotationX(-pose.legs[i]!);
    m[12] = x;
    m[13] = HIP.y + up;
    m[14] = z;
    put(i + 1, m);
  });
  const t = rotationY(pose.tail);
  const lift = rotationX(-pose.tailLift);
  // Ry · Rx, at the root.
  const m: number[] = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r]! += t[k * 4 + r]! * lift[c * 4 + k]!;
  m[12] = TAIL[0];
  m[13] = TAIL[1] + up;
  m[14] = TAIL[2];
  put(5, m);
  return out;
}
