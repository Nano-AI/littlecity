// The raiders' costume (design section 13b, the raid): drawn over the little
// person (person.ts) the way wedding finery is (finery.ts), without touching
// how a person is built.
//
//   barbarianLook   the clothes on the person's own look: a leather or wool
//                   tunic, dark breeches, bare arms, a burly build, a little
//                   bigger than a townsman; no hat of their own
//   barbarianMesh   what goes on top, in the body piece's frame (origin at
//                   the feet, +Y up, facing +Z, figure units: a person is
//                   0.42 tall): an iron helmet with great curling horns (or
//                   white wings), a big beard (some plaited), a fur cape over
//                   the shoulders, a belt, and a round painted shield slung
//                   on the back. The chief is bigger, in a red cape with a
//                   white wolf-fur collar, with the biggest horns of all.
//
// What they hold (a flaming brand, an axe or a club held up, the chief's
// horn) is a tool (extras.ts) chosen by their costume: `raiderTool`.
//
// Built to read from the town view, where a person is twenty-odd pixels:
// the horns and the shield are the silhouette, the beard and the cape the
// colour. Pure.

import { rand } from '@/core/rand';
import { compose, rotationY, scaling, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { soft } from '@/gen/soft';
import { tube } from '@/parts/ground/kit';
import { drawShield, SHIELD_PAIRS } from '@/parts/raid/longship';
import { PALETTE } from '@/style/palette';
import { DESIGN_HEIGHT, type Look, type Rig } from './person';
import { PERSON } from '@/style/people';

/** A raider (eight looks, by the number) or their chief. */
export type Barbarian = `raider-${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}` | 'chief';
export const BARBARIANS: readonly Barbarian[] = ['raider-0', 'raider-1', 'raider-2', 'raider-3', 'raider-4', 'raider-5', 'raider-6', 'raider-7', 'chief'];

export function isBarbarian(c: unknown): c is Barbarian {
  return typeof c === 'string' && (c === 'chief' || /^raider-[0-7]$/.test(c));
}

/** What a raider carries when their hands are free: a brand (to set fires), an axe or a club; the chief his horn. */
export type RaiderGear = 'brand' | 'axe' | 'club' | 'standard';
export function raiderGear(c: Barbarian): RaiderGear {
  if (c === 'chief') return 'standard';
  const v = Number(c.slice(7));
  return v % 3 === 0 ? 'brand' : v % 3 === 1 ? 'axe' : 'club';
}

const FUR = ['#8b7a66', '#6e5b48', '#a39480', '#5a4a3c'];
const TUNIC = ['#7a4b2a', '#8a3b2e', '#5b6b3a', '#4a5a7a', '#8a6a3a', '#6b4a5a'];
const BREECHES = ['#4a3a30', '#5a5048', '#3f3a44'];
const BEARD = ['#c4612f', '#d8a64a', '#6b4a34', '#3a2e2a', '#e0c070', '#a8452a'];
const IRON = '#8d8f99';
const HORN = '#efe3c4';

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))]!;
const r = (c: Barbarian, k: string): number => rand(0x7a1d, c, k);

/** The clothes on the person's own look: skin stays theirs; everything else is the raider's. */
export function barbarianLook(base: Look, c: Barbarian): Look {
  const chief = c === 'chief';
  return {
    ...base,
    child: false,
    top: chief ? '#6e2a24' : pick(TUNIC, r(c, 'tunic')),
    bottom: pick(BREECHES, r(c, 'breeches')),
    hair: pick(BEARD, r(c, 'beard')),
    hairStyle: r(c, 'hair') < 0.6 ? 'long' : 'short',
    hat: 'none',
    dress: false,
    // The townspeople's own heights (person.ts: 0.95 to 1.05), a little stockier; the chief at the top of that
    // range, told by his cape, horn and standard, not by size (Derek, 2026-11-21: the same size as the villagers).
    girth: chief ? 1.16 : 1.02 + r(c, 'girth') * 0.12,
    scale: (PERSON.height / DESIGN_HEIGHT) * (chief ? 1.05 : 0.95 + r(c, 'size') * 0.1),
  };
}

/** The helmet: an iron cap with a rim and a nose guard, and horns curling out and up (or wings). */
function helmet(b: MeshBuilder, rig: Rig, c: Barbarian): void {
  const rr = rig.head, cy = rig.headY;
  const chief = c === 'chief';
  b.setInk('helmet').setColor(IRON).setPattern(PATTERN.metal);
  b.lathe([[rr * 1.12, cy + rr * 0.12], [rr * 1.1, cy + rr * 0.55], [rr * 0.8, cy + rr * 0.95], [rr * 0.3, cy + rr * 1.12], [0, cy + rr * 1.16]], { segments: 12 });
  b.setInk('helmet-rim').setColor('#6f6f78');
  b.lathe([[rr * 1.16, cy + rr * 0.08], [rr * 1.17, cy + rr * 0.3], [rr * 1.12, cy + rr * 0.32]], { segments: 12 });
  // The nose guard, down the front of the face.
  b.box([-rr * 0.12, cy - rr * 0.35, rr * 1.0], [rr * 0.12, cy + rr * 0.2, rr * 1.12]);
  b.setPattern(PATTERN.none);
  const wings = !chief && r(c, 'wings') < 0.25;
  if (wings) {
    // White wings swept up and back from each side.
    b.setInk('wings').setColor(PALETTE.white);
    for (const s of [1, -1]) {
      const x0 = s * rr * 1.05;
      const pts: [number, number, number][] = [[x0, cy + rr * 0.35, rr * 0.2], [x0 + s * rr * 0.55, cy + rr * 1.5, -rr * 0.5], [x0 + s * rr * 0.25, cy + rr * 1.15, -rr * 0.75], [x0 + s * rr * 0.4, cy + rr * 0.95, -rr * 0.95], [x0, cy + rr * 0.3, -rr * 0.4]];
      b.polygon(pts);
      b.polygon([...pts].reverse());
    }
    return;
  }
  // The horns: thick at the helmet, curling out, up and a little forward to a point.
  const k = chief ? 1.35 : 1 + r(c, 'horns') * 0.2;
  b.setInk('horns').setColor(HORN);
  for (const s of [1, -1]) {
    tube(
      b,
      [
        [s * rr * 0.92, cy + rr * 0.55, 0],
        [s * rr * (1.45 * k), cy + rr * (0.75 * k), rr * 0.05],
        [s * rr * (1.85 * k), cy + rr * (1.25 * k), rr * 0.15],
        [s * rr * (1.8 * k), cy + rr * (1.85 * k), rr * 0.2],
      ],
      [rr * 0.32, rr * 0.25 * k, rr * 0.15 * k, rr * 0.02],
      { seg: 6 },
    );
  }
}

/** The beard: a big bush over the jaw and down the chest, with a moustache; for some, two plaits. */
function beard(b: MeshBuilder, look: Look, rig: Rig, c: Barbarian): void {
  const rr = rig.head, cy = rig.headY;
  const big = c === 'chief' ? 1.2 : 1;
  soft(b, { ink: 'beard' }, (s) => {
    s.b.setColor(look.hair).setPattern(PATTERN.none);
    s.ball(0, cy - rr * 0.45, rr * 0.55, rr * 0.82 * big, rr * 0.62 * big, rr * 0.5);
    s.ball(0, cy - rr * 1.02, rr * 0.62, rr * 0.62 * big, rr * 0.55 * big, rr * 0.36);
  });
  b.setInk('moustache').setColor(look.hair);
  for (const sd of [1, -1]) tube(b, [[0, cy - rr * 0.1, rr * 1.02], [sd * rr * 0.4, cy - rr * 0.22, rr * 0.98], [sd * rr * 0.62, cy - rr * 0.52, rr * 0.82]], [rr * 0.13, rr * 0.11, rr * 0.05], { seg: 5 });
  if (r(c, 'plaits') < 0.4) {
    b.setInk('plaits');
    for (const sd of [1, -1]) tube(b, [[sd * rr * 0.3, cy - rr * 1.2, rr * 0.7], [sd * rr * 0.34, cy - rr * 1.7, rr * 0.72], [sd * rr * 0.3, cy - rr * 2.0, rr * 0.7]], [rr * 0.13, rr * 0.11, rr * 0.07], { seg: 5 });
  }
}

/** The fur cape: round the shoulders and down the back to the seat, with a ruff of fur at the collar. */
function cape(b: MeshBuilder, look: Look, rig: Rig, c: Barbarian): void {
  const g = look.girth;
  const chief = c === 'chief';
  const cloth = chief ? PALETTE.red : pick(FUR, r(c, 'fur'));
  b.setInk('cape').setColor(cloth).setPattern(chief ? PATTERN.cloth : PATTERN.none);
  b.at(scaling(g, 1, 0.86), () => {
    b.lathe([[0.086, 0.085], [0.082, 0.16], [0.074, 0.23], [0.064, rig.shoulderY + 0.012], [0.03, rig.shoulderY + 0.035]], { segments: 10, start: Math.PI * 0.5, sweep: Math.PI });
    // Its inside, so the back of it shows the same from the front.
    b.lathe([[0.03, rig.shoulderY + 0.035], [0.062, rig.shoulderY + 0.012], [0.072, 0.23], [0.08, 0.16], [0.084, 0.085]], { segments: 10, start: Math.PI * 0.5, sweep: Math.PI });
  });
  soft(b, { ink: 'ruff' }, (s) => {
    s.b.setColor(chief ? '#f2eee6' : pick(FUR, r(c, 'ruff') * 0.999)).setPattern(PATTERN.none);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      s.ball(Math.sin(a) * 0.055 * g, rig.shoulderY + 0.01, Math.cos(a) * 0.045 * g - 0.004, 0.028, 0.022, 0.028, 7, 4);
    }
  });
  // A broad belt with a buckle.
  b.setInk('belt').setColor('#3d2a1e');
  b.at(scaling(g, 1, 0.8), () => b.lathe([[0.061, 0.13], [0.06, 0.158]], { segments: 10 }));
  b.setInk('buckle').setColor(PALETTE.yellow);
  b.box([-0.012, 0.132, 0.047 * g], [0.012, 0.156, 0.054 * g]);
  if (chief) {
    // A gold torc at the neck.
    b.setInk('torc').setColor(PALETTE.yellow).setPattern(PATTERN.metal);
    b.at(translation(0, rig.shoulderY + 0.03, 0.02), () => b.lathe([[0.04, -0.006], [0.044, 0], [0.04, 0.006]], { segments: 10 }));
  }
}

/**
 * What is drawn over a raider, in the body piece's frame (figure units). `ink` namespaces the ink groups as
 * buildPerson's does (the person's id).
 */
export function barbarianMesh(look: Look, rig: Rig, c: Barbarian, ink: string): MeshData {
  const b = new MeshBuilder({ ink: `${ink}:barbarian` });
  b.setPattern(PATTERN.none);
  helmet(b, rig, c);
  beard(b, look, rig, c);
  cape(b, look, rig, c);
  // The round shield slung on the back, over the cape.
  // Red and white, as the ship's (SHIELD_PAIRS).
  const shields = SHIELD_PAIRS;
  const pair = shields[Math.floor(r(c, 'shield') * shields.length) % shields.length]!;
  // Held up on the left arm, out to the side and forward, seen from the front and the side alike.
  b.at(compose(translation(-0.1 * look.girth, 0.19, 0.035), rotationY(-Math.PI / 2 + 0.55)), () => drawShield(b, c === 'chief' ? 0.11 : 0.1, pair, 'shield'));
  if (c === 'chief') {
    // His horn, hanging at his hip on its strap.
    b.setInk('hip-horn').setColor('#efe3c4');
    tube(b, [[0.07 * look.girth, 0.15, 0.03], [0.09 * look.girth, 0.11, 0.06], [0.1 * look.girth, 0.07, 0.04]], [0.008, 0.014, 0.022], { seg: 6 });
  }
  return b.build();
}
