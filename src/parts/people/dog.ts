// L61 · A dog (meshes only; src/life/town/chains/dogs.ts moves it). Small,
// round and readable: a bean of a body, a big head with floppy ears, four
// stubby legs and a tail up. Drawn in a few held poses shown in turn: two
// trotting drawings, standing, sitting, and a bark (front feet off the
// ground, tail high). World units, origin on the ground under its middle,
// facing +Z.

import { multiply, rotationX, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
import { smoothBall, soft } from '@/gen/soft';
import { PALETTE } from '@/style/palette';

export type DogPose = 'stand' | 'trot-a' | 'trot-b' | 'sit' | 'bark';
export const DOG_POSES: readonly DogPose[] = ['stand', 'trot-a', 'trot-b', 'sit', 'bark'];
/** Coats: body, patches and ears. */
export const DOG_COATS: readonly [string, string][] = [
  ['#b9824d', '#6e4628'],
  ['#f2ece0', '#5a4636'],
  ['#3b3434', '#e9e1d2'],
  ['#d9a35f', '#f4eee2'],
];

// Smoothing the normals is the cost, and a town draws the same few poses and coats over and over. The
// mesh is only ever copied into the render pool (never changed), so callers can share one. Keyed by the
// raw coat, since the ink name carries it; coats are a handful of post refs, so no bound is needed.
const made = new Map<string, MeshData>();

/**
 * A dog in one pose and coat. Drawn as two soft bodies (src/gen/soft.ts): the body with its patch, legs
 * and tail is one round mass with one outline, the head with its snout another (the line where the head
 * sits on the body is drawn on purpose); the ears and the nose keep lines of their own.
 */
export function dogMesh(pose: DogPose, coat: number): MeshData {
  const key = `${pose}|${coat}`;
  let mesh = made.get(key);
  if (!mesh) made.set(key, (mesh = build(pose, coat)));
  return mesh;
}

function build(pose: DogPose, coat: number): MeshData {
  const [fur, patch] = DOG_COATS[((coat % DOG_COATS.length) + DOG_COATS.length) % DOG_COATS.length]!;
  const b = new MeshBuilder({ ink: `dog-${pose}-${coat}` });
  const sit = pose === 'sit', bark = pose === 'bark';
  const legY = 0.06;
  // The body tips up at the front when it sits or barks.
  const tilt = sit ? -0.6 : bark ? -0.35 : 0;
  const torso = multiply(translation(0, legY + 0.035 + (sit ? 0.02 : 0), sit ? -0.03 : 0), rotationX(tilt));
  const swing = pose === 'trot-a' ? 0.018 : pose === 'trot-b' ? -0.018 : 0;
  b.setPattern(PATTERN.none);
  soft(b, { ink: 'body' }, (s) => {
    s.at(torso, () => {
      s.b.setColor(fur);
      s.ball(0, 0, 0, 0.045, 0.042, 0.075, 12, 7);
      // The patch is a colour on the coat, not a shape of its own.
      s.b.setColor(patch);
      s.at(translation(0.02, 0.025, -0.01), () => smoothBall(s.b, 0, 0, 0, 0.022, 0.016, 0.03, 8, 5));
      // The tail, up and a little curled.
      s.b.setColor(fur);
      s.at(multiply(translation(0, 0.035, -0.075), rotationX(bark ? -1.2 : -0.8)), () => s.ball(0, 0, 0, 0.011, 0.011, 0.04, 8, 5));
    });
    // Legs: front pair and back pair, swung for the trot; little round posts, part of the body's mass.
    s.b.setColor(fur);
    for (const [x, z, front] of [[-0.025, 0.045, true], [0.025, 0.045, true], [-0.025, -0.045, false], [0.025, -0.045, false]] as const) {
      const sw = (x < 0 ? 1 : -1) * (front ? 1 : -1) * swing;
      if (sit && !front) {
        // Haunches down.
        s.ball(x * 1.2, 0.02, z + 0.01, 0.02, 0.02, 0.03, 8, 5);
        continue;
      }
      const lift = bark && front ? 0.03 : 0;
      const h = (legY + 0.03 - lift) / 2;
      // A post with rounded ends (not a spindle): its normals from a lump the length of it.
      const lr = 0.0115;
      s.hold(x, lift + h, z + sw, lr, h * 1.15, lr);
      s.at(translation(x, lift, z + sw), () => s.b.lathe([[0, 0], [lr * 0.75, 0.002], [lr, lr * 0.8], [lr, h * 2 - lr], [0, h * 2]], { segments: 7 }));
    }
  });
  // Head and ears.
  b.at(multiply(torso, translation(0, 0.05, 0.07)), () => {
    soft(b, { ink: 'head' }, (s) => {
      s.b.setColor(fur);
      s.ball(0, 0, 0, 0.038, 0.036, 0.038, 12, 7);
      s.ball(0, -0.008, 0.035, 0.02, 0.016, 0.022, 10, 6);
    });
    b.setInk('nose').setColor(PALETTE.ink);
    smoothBall(b, 0, -0.002, 0.056, 0.007, 0.006, 0.006, 8, 4);
    b.setInk('ears').setColor(patch);
    for (const side of [-1, 1]) smoothBall(b, side * 0.032, 0, 0, 0.012, 0.03, 0.018, 8, 5);
  });
  return b.build();
}
