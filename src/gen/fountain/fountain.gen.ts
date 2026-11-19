// Fountains (R-F01): a fountain block is one of four pieces, by its role:
// a tiered fountain in a square, a well in a courtyard, a birdbath on a
// garden, a small basin anywhere else. Each stands in the middle of its cell.
//
// Reads: the structure (cell, seed, colour) and its role. Returns the world
// frames of the sockets R-F01 declared: where the water lies and where it
// leaves (for the Animation owner), and the birdbath's perch.

import { CELL_H, keyX, keyY, keyZ } from '@/core/grid';
import { multiply, rotationY, translation, type Mat4, type Mat4Like } from '@/core/mat4';
import { defineGenerator } from '@/gen/api';
import { MeshBuilder } from '@/gen/mesh';
import { rngOf, type Rng } from '@/parts/ground/kit';
import { fountainSocketId, fountainSockets, type FountainRole } from '@/rules/roles/ground-props';
import { birdbath, smallBasin, stoneOf, tieredFountain, well, type FountainAnchors } from './draw';

const DRAW: Record<FountainRole, (b: MeshBuilder, r: Rng, stone: string) => FountainAnchors> = {
  'tiered-fountain': tieredFountain,
  'well': well,
  'birdbath': birdbath,
  'basin': smallBasin,
};
export const FOUNTAIN_ROLES = Object.keys(DRAW) as FountainRole[];

/**
 * How a fountain stands on its cell: a well's posts run east–west or
 * north–south (seeded); the others are round or square and stand true.
 */
function stance(role: FountainRole, r: Rng): Mat4 {
  return rotationY(role === 'well' && r('turn') < 0.5 ? Math.PI / 2 : 0);
}

/**
 * Draws one fountain on the builder's origin and returns the frames of its
 * sockets by name, relative to that origin. Also used by galleries and tests.
 */
export function drawFountain(b: MeshBuilder, role: FountainRole, seed: number, color = 0): FountainAnchors {
  const r = rngOf(seed);
  const m = stance(role, r);
  let local: FountainAnchors = {};
  b.at(m, () => {
    local = DRAW[role](b, r, stoneOf(color));
  });
  const out: FountainAnchors = {};
  for (const name of Object.keys(local)) out[name] = multiply(m, local[name]!);
  return out;
}

export default defineGenerator({
  kind: 'fountain',
  build(s, plan) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    const given = plan.roles.get(s.id)?.role;
    const role: FountainRole = given !== undefined && given in DRAW ? (given as FountainRole) : 'basin';
    for (const cell of s.cells) {
      const origin = translation(keyX(cell) + 0.5, keyY(cell) * CELL_H, keyZ(cell) + 0.5);
      let local: FountainAnchors = {};
      b.at(origin, () => {
        local = drawFountain(b, role, s.seed, s.color);
      });
      for (const socket of fountainSockets(role)) {
        const at = local[socket.name];
        if (at) anchors[fountainSocketId(cell, socket)] = multiply(origin, at);
      }
    }
    return { mesh: b.build(), anchors };
  },
});
