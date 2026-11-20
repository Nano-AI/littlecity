// L61 · A dog (meshes only; src/life/town/chains/dogs.ts moves it). Small,
// round and readable: a bean of a body, a big head with floppy ears, four
// stubby legs and a tail up. Drawn in a few held poses shown in turn: two
// trotting drawings, standing, sitting, and a bark (front feet off the
// ground, tail high). World units, origin on the ground under its middle,
// facing +Z.

import { multiply, rotationX, translation } from '@/core/mat4';
import { MeshBuilder, PATTERN, type MeshData } from '@/gen/mesh';
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

function ball(b: MeshBuilder, rx: number, ry: number, rz: number, segments = 8): void {
  const prof: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (1 - i / 6);
    prof.push([Math.max(0, Math.sin(a)), Math.cos(a)]);
  }
  b.at([rx, 0, 0, 0, 0, ry, 0, 0, 0, 0, rz, 0, 0, 0, 0, 1], () => b.lathe(prof, { segments }));
}

export function dogMesh(pose: DogPose, coat: number): MeshData {
  const [fur, patch] = DOG_COATS[((coat % DOG_COATS.length) + DOG_COATS.length) % DOG_COATS.length]!;
  const b = new MeshBuilder({ ink: `dog-${pose}-${coat}` });
  const sit = pose === 'sit', bark = pose === 'bark';
  const legY = 0.06;
  // The body tips up at the front when it sits or barks.
  const tilt = sit ? -0.6 : bark ? -0.35 : 0;
  b.setPattern(PATTERN.none);
  b.at(multiply(translation(0, legY + 0.035 + (sit ? 0.02 : 0), sit ? -0.03 : 0), rotationX(tilt)), () => {
    b.setInk('body').setColor(fur);
    ball(b, 0.045, 0.042, 0.075);
    b.setInk('patch').setColor(patch);
    b.at(translation(0.02, 0.025, -0.01), () => ball(b, 0.022, 0.016, 0.03));
    // Head and ears.
    b.at(translation(0, 0.05, 0.07), () => {
      b.setInk('head').setColor(fur);
      ball(b, 0.038, 0.036, 0.038);
      b.setInk('snout').setColor(fur);
      b.at(translation(0, -0.008, 0.035), () => ball(b, 0.02, 0.016, 0.022));
      b.setInk('nose').setColor(PALETTE.ink);
      b.at(translation(0, -0.002, 0.056), () => ball(b, 0.007, 0.006, 0.006));
      b.setInk('ears').setColor(patch);
      for (const s of [-1, 1]) b.at(translation(s * 0.032, 0.0, 0.0), () => ball(b, 0.012, 0.03, 0.018));
    });
    // The tail, up and a little curled.
    b.setInk('tail').setColor(fur);
    b.at(multiply(translation(0, 0.035, -0.075), rotationX(bark ? -1.2 : -0.8)), () => ball(b, 0.01, 0.01, 0.04));
  });
  // Legs: front pair and back pair, swung for the trot.
  const swing = pose === 'trot-a' ? 0.018 : pose === 'trot-b' ? -0.018 : 0;
  b.setInk('legs').setColor(fur);
  for (const [x, z, front] of [[-0.025, 0.045, true], [0.025, 0.045, true], [-0.025, -0.045, false], [0.025, -0.045, false]] as const) {
    const s = (x < 0 ? 1 : -1) * (front ? 1 : -1) * swing;
    if (sit && !front) {
      // Haunches down.
      b.at(translation(x * 1.2, 0.02, z + 0.01), () => ball(b, 0.02, 0.02, 0.03));
      continue;
    }
    const lift = bark && front ? 0.03 : 0;
    b.box([x - 0.01, lift, z + s - 0.01], [x + 0.01, legY + 0.02, z + s + 0.01]);
  }
  return b.build();
}
