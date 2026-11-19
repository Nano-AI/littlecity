// The little person (People, Stage 3): the spike's person() redrawn with
// MeshBuilder in the game's style. Pure.
//
// A person is five rigid pieces, each built round its own pivot, so the
// crowd can pose them with matrices instead of redrawing them:
//
//   body   torso, head, hair and hat. Origin at the feet, +Y up, facing +Z.
//   legL   legR   origin at the hip, hanging down −Y. L is on −X.
//   armL   armR   origin at the shoulder, hanging down −Y.
//
// They are tiny on screen (0.42 tall: about 23 pixels at playing zoom), so
// the drawing is all silhouette and flat colour: a big round head, a bean of
// a body, no face. Everything below the neck is ONE ink group and the head
// with its hair and hat is another, so the pen draws a person as two shapes
// and never as a knot of small outlines.

import { rand } from '@/core/rand';
import { compose, rotationX, scaling, translation, type Mat4Like } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { PERSON } from '@/style/people';

export type HairStyle = 'short' | 'bob' | 'bun' | 'long' | 'bald';
export type HatStyle = 'none' | 'straw' | 'cap' | 'bobble';

export interface Look {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  hairStyle: HairStyle;
  hat: HatStyle;
  hatColor: string;
  /** A skirt or a long coat: the body flares to the knee and the legs show bare below it. */
  dress: boolean;
  child: boolean;
  /** Whole-figure scale: about 1 for an adult, PERSON.child for a child. */
  scale: number;
  /** Width of the body, about 1. */
  girth: number;
}

const pickOf = <T>(items: readonly T[], r: number): T => items[Math.min(items.length - 1, Math.floor(r * items.length))]!;

/** A resident's seeded look (L21): skin, hair, clothes and hat from the people palette. */
export function lookOf(seed: number, child = false): Look {
  const r = (...p: (number | string)[]): number => rand(seed, 'look', ...p);
  const top = pickOf(PERSON.tops, r('top'));
  // Trousers that are not the colour of the shirt.
  let bottom = pickOf(PERSON.bottoms, r('bottom'));
  if (bottom === top) bottom = PERSON.bottoms[0]!;
  const hairRoll = r('hair-style');
  const hairStyle: HairStyle = hairRoll < 0.36 ? 'short' : hairRoll < 0.6 ? 'bob' : hairRoll < 0.76 ? 'bun' : hairRoll < 0.94 ? 'long' : 'bald';
  const hatRoll = r('hat');
  const hat: HatStyle = hatRoll < 0.14 ? 'straw' : hatRoll < 0.24 ? 'cap' : hatRoll < 0.3 ? 'bobble' : 'none';
  return {
    skin: pickOf(PERSON.skin, r('skin')),
    hair: pickOf(PERSON.hair, r('hair')),
    top,
    bottom,
    hairStyle,
    hat,
    hatColor: pickOf(PERSON.hats, r('hat-colour')),
    dress: r('dress') < 0.34,
    child,
    scale: child ? PERSON.child * (0.92 + r('size') * 0.16) : 0.95 + r('size') * 0.1,
    girth: 0.92 + r('girth') * 0.18,
  };
}

/** Where the pieces join, in the figure's own units (before `scale`). */
export interface Rig {
  hipY: number;
  hipX: number;
  shoulderY: number;
  shoulderX: number;
  headY: number;
  head: number;
  leg: number;
  arm: number;
}

export function rigOf(look: Look): Rig {
  const head = PERSON.head * (look.child ? 1.12 : 1);
  return {
    hipY: 0.128,
    hipX: 0.031 * look.girth,
    shoulderY: 0.25,
    shoulderX: 0.064 * look.girth,
    headY: PERSON.height - PERSON.head,
    head,
    leg: 0.128,
    arm: 0.108,
  };
}

export interface PersonMeshes {
  body: MeshData;
  legL: MeshData;
  legR: MeshData;
  armL: MeshData;
  armR: MeshData;
}

/** Points of a ball's profile for `lathe`, from polar angle a0 (0 = top) to a1, bottom to top. */
function arc(radius: number, cy: number, a0: number, a1: number, steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = steps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([Math.max(0, radius * Math.sin(a)), cy + radius * Math.cos(a)]);
  }
  return out;
}

const SHOE = PALETTE.metal;

function leg(b: MeshBuilder, look: Look, rig: Rig): void {
  const w = 0.044 * look.girth, d = 0.05, len = rig.leg;
  b.setInk('body').setPattern(PATTERN.none);
  b.setColor(look.dress ? look.skin : look.bottom);
  b.box([-w / 2, -len + 0.03, -d / 2], [w / 2, 0, d / 2], { skip: ['top', 'bottom'] });
  // The shoe sticks out in front: at this size it is the one thing that says which way the feet point.
  b.setColor(SHOE);
  b.box([-w / 2 - 0.002, -len, -d / 2 - 0.002], [w / 2 + 0.002, -len + 0.03, d / 2 + 0.026]);
}

function arm(b: MeshBuilder, look: Look, rig: Rig): void {
  const w = 0.03, d = 0.036, len = rig.arm, hand = 0.03;
  b.setInk('body').setPattern(PATTERN.none);
  b.setColor(look.top);
  b.box([-w / 2, -len + hand, -d / 2], [w / 2, 0.012, d / 2], { skip: ['bottom'] });
  b.setColor(look.skin);
  b.box([-w / 2, -len, -d / 2], [w / 2, -len + hand, d / 2], { skip: ['top'] });
}

function body(b: MeshBuilder, look: Look, rig: Rig): void {
  const g = look.girth;
  const segs = 10;
  b.setInk('body').setPattern(PATTERN.none);
  // The torso: a bean, a little flatter front to back than side to side.
  b.at(scaling(g, 1, 0.8), () => {
    if (look.dress) {
      b.setColor(look.top);
      b.lathe([[0, 0.062], [0.082, 0.066], [0.074, 0.12], [0.056, 0.2], [0.05, 0.25], [0.03, 0.283], [0, 0.29]], { segments: segs });
    } else {
      b.setColor(look.bottom);
      b.lathe([[0, 0.098], [0.05, 0.102], [0.058, 0.152]], { segments: segs });
      b.setColor(look.top);
      b.lathe([[0.058, 0.152], [0.057, 0.21], [0.05, 0.25], [0.03, 0.283], [0, 0.29]], { segments: segs });
    }
  });
  // The head, and what is on it.
  const r = rig.head, cy = rig.headY;
  b.setInk('head');
  b.setColor(look.skin);
  b.lathe(arc(r, cy, 0, Math.PI, 6), { segments: segs });
  const tilt = (rad: number, fn: () => void): void => {
    b.at(compose(translation(0, cy, 0), rotationX(-rad), translation(0, -cy, 0)), fn);
  };
  b.setColor(look.hair);
  const hr = r * 1.08;
  switch (look.hairStyle) {
    case 'short':
      tilt(0.42, () => b.lathe(arc(hr, cy, 0, 1.55, 4), { segments: segs }));
      break;
    case 'bob':
      tilt(0.62, () => b.lathe(arc(hr * 1.03, cy, 0, 1.95, 5), { segments: segs }));
      break;
    case 'bun':
      tilt(0.42, () => b.lathe(arc(hr, cy, 0, 1.55, 4), { segments: segs }));
      b.at(translation(0, cy + r * 0.86, -r * 0.62), () => b.lathe(arc(r * 0.42, 0, 0, Math.PI, 4), { segments: 8 }));
      break;
    case 'long':
      tilt(0.5, () => b.lathe(arc(hr, cy, 0, 1.7, 4), { segments: segs }));
      // Down the back to the shoulders: the back half of a sleeve.
      b.lathe([[hr * 0.86, rig.shoulderY - 0.012], [hr * 1.02, cy - r * 0.3], [hr, cy + r * 0.2]], { segments: segs, start: Math.PI + 0.25, sweep: Math.PI - 0.5 });
      break;
    case 'bald':
      break;
  }
  if (look.hat !== 'none') {
    b.setColor(look.hatColor);
    const top = cy + r;
    if (look.hat === 'straw') {
      const y = top - r * 0.5;
      b.lathe([[r * 1.62, y], [r * 1.62, y + 0.012], [r * 0.86, y + 0.016], [r * 0.74, y + r * 0.62], [0, y + r * 0.7]], { segments: segs, capBottom: true });
    } else if (look.hat === 'cap') {
      tilt(0.16, () => b.lathe(arc(hr * 1.06, cy, 0, 1.25, 4), { segments: segs }));
      b.box([-r * 0.62, cy + r * 0.34, r * 0.5], [r * 0.62, cy + r * 0.46, r * 1.5]);
    } else {
      tilt(0.2, () => b.lathe([[hr * 1.08, cy + r * 0.28], [hr * 1.02, cy + r * 0.6], [hr * 0.6, top + 0.018], [0, top + 0.03]], { segments: segs }));
      b.setColor(PALETTE.white);
      b.at(translation(0, top + 0.04, -0.01), () => b.lathe(arc(r * 0.3, 0, 0, Math.PI, 3), { segments: 6 }));
    }
  }
}

/**
 * The five pieces of one person. `ink` namespaces the ink groups: pass the
 * person's id, so two people standing together get a line between them.
 */
export function buildPerson(look: Look, ink: number | string): PersonMeshes {
  const rig = rigOf(look);
  const piece = (draw: (b: MeshBuilder) => void): MeshData => {
    const b = new MeshBuilder({ ink });
    draw(b);
    return b.build();
  };
  return {
    body: piece((b) => body(b, look, rig)),
    legL: piece((b) => leg(b, look, rig)),
    legR: piece((b) => leg(b, look, rig)),
    armL: piece((b) => arm(b, look, rig)),
    armR: piece((b) => arm(b, look, rig)),
  };
}

/** The order of the pieces wherever they are listed (rig matrices, handles). */
export const PIECES = ['body', 'legL', 'legR', 'armL', 'armR'] as const;
export type Piece = (typeof PIECES)[number];

/** One mesh of a whole person, each piece placed by its matrix (PIECES order): for the static part. */
export function assemblePerson(meshes: PersonMeshes, matrices: readonly Mat4Like[], into: MeshBuilder): MeshBuilder {
  PIECES.forEach((p, i) => into.add(meshes[p], matrices[i]));
  return into;
}
