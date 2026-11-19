// Small things people have about them (People, Stage 3): the chat bubble
// (L26) and the kite (L28). Meshes only; the people system places them.

import { rotationY, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { PALETTE } from '@/style/palette';
import { PERSON } from '@/style/people';

/**
 * A squiggle chat bubble: a white blob with a tail and three dots, the dots
 * on all four sides so it reads from every orbit quarter. Origin at the tip
 * of the tail, just over the speaker's head.
 */
export function bubbleMesh(): MeshData {
  const b = new MeshBuilder({ ink: 'chat-bubble' });
  const rx = 0.095, ry = 0.062, cy = 0.1;
  const profile: [number, number][] = [];
  for (let i = 6; i >= 0; i--) {
    const a = (Math.PI * i) / 6;
    profile.push([Math.max(0, rx * Math.sin(a)), cy + ry * Math.cos(a)]);
  }
  b.setInk('bubble').setColor(PALETTE.white).setPattern(PATTERN.none);
  b.lathe(profile, { segments: 10 });
  // The tail: a little cone down to the speaker.
  b.lathe([[0, 0], [0.028, cy - ry * 0.8]], { segments: 6 });
  // The squiggle: three dots, drawn on each side.
  b.setColor(PALETTE.ink);
  for (let side = 0; side < 4; side++) {
    b.at(rotationY((side * Math.PI) / 2), () => {
      for (const x of [-0.036, 0, 0.036]) {
        const z = rx * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) - 0.004;
        b.at(translation(x, cy, z), () => b.box([-0.009, -0.009, 0], [0.009, 0.009, 0.008], { skip: ['n'] }));
      }
    });
  }
  return b.build();
}

/**
 * A kite: a diamond with a cross spar and a tail of three bows. Origin at
 * the bridle (the middle of the diamond); it flies in its XY plane, facing
 * +Z. `colour` indexes the people palette's tops.
 */
export function kiteMesh(colour: number): MeshData {
  const b = new MeshBuilder({ ink: `kite${colour}` });
  const w = 0.13, up = 0.14, down = 0.2, t = 0.006;
  const c = PERSON.tops[((colour % PERSON.tops.length) + PERSON.tops.length) % PERSON.tops.length]!;
  b.setInk('sail').setColor(c).setPattern(PATTERN.cloth).setSway(0.3);
  for (const z of [t, -t]) {
    const pts: [number, number, number][] = [[0, up, z], [-w, 0, z], [0, -down, z], [w, 0, z]];
    if (z < 0) pts.reverse();
    b.quad(pts[0]!, pts[1]!, pts[2]!, pts[3]!);
  }
  b.setColor(PALETTE.wood).setPattern(PATTERN.none).setSway(0);
  b.box([-0.008, -down, -t - 0.004], [0.008, up, t + 0.004]);
  b.box([-w, -0.008, -t - 0.004], [w, 0.008, t + 0.004]);
  // The tail.
  b.setInk('tail').setColor(PALETTE.yellow).setPattern(PATTERN.cloth);
  for (let i = 0; i < 3; i++) {
    const y = -down - 0.06 - i * 0.075, x = (i % 2 === 0 ? 1 : -1) * 0.018;
    b.setSway(0.5 + i * 0.2);
    b.box([x - 0.028, y - 0.014, -0.004], [x + 0.028, y + 0.014, 0.004]);
  }
  return b.build();
}

/** The kite's line: a hair of a box from the origin one unit along +X, to be stretched from hand to kite. */
export function lineMesh(): MeshData {
  const b = new MeshBuilder({ ink: 'kite-line' });
  b.setInk('line').setColor(PALETTE.ink).setPattern(PATTERN.none);
  b.box([0, -0.004, -0.004], [1, 0.004, 0.004]);
  return b.build();
}
