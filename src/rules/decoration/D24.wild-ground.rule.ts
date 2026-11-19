// D24 · tier 1 · Wild ground. What grows and gathers where nobody builds.
//
//   tufts        long grass, some with wildflowers, on bare grass: rare
//                beside the town (DRESSING.tuftNear) and common out in the
//                open (tuftFar at tuftReach column steps from any block or
//                floor). Out there they gather in drifts (a smooth seeded
//                field over the map), so the country is meadow and lawn,
//                not an even sprinkle. Leftover patches inside the town are
//                not wild: the urban-fill rules decide what those become.
//   boulders     at the foot of a cliff (a rise of two levels or more)
//   beach finds  driftwood, shells and starfish on bare sand
//   reeds        in sheltered water at the foot of a bank
//   lily pads    floating in sheltered water
//
// Water plants belong to still water: any sheltered cell of a pond (a body of
// water that does not reach the map's edge), but on the sea only a true
// inlet (land on three sides). They keep away from docks (boats moor there).
//
// Stability: every cell rolls for itself, seeded by the cell alone. A new
// building changes only the cells whose distance to the town it changes.
//
// Reads: wildGrass, leftovers, landUse, distToStructure, distToFloor, shelteredWater,
// terrain heights and materials, clearways. Claims: the floor slot of each.

import { columnIndex, DIR4, key, keyX, keyY, keyZ, SIZE_X, SIZE_Z, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import { MAT } from '@/core/world';
import { defineRule, slot, type Candidate } from '@/resolve/engine/api';
import { distToFloor, distToStructure } from '@/resolve/facts/distance.fact';
import { wildGrass } from '@/resolve/facts/grass.fact';
import { leftovers } from '@/resolve/facts/leftovers.fact';
import { DIRS } from '@/resolve/facts/lib';
import { shelteredWater } from '@/resolve/facts/sheltered-water.fact';
import type { CellPos } from '@/resolve/plan';
import { DRESSING } from '@/style/dressing';
import { landUse } from '../urban/land-use.fact';
import { townEdge } from '../urban/town-edge.fact';
import { clearways, edgePos, POSITIONS } from './clearways.fact';
import { choose, heightAt, lucky } from './lib';

type Wild =
  | { kind: 'tuft'; pos: CellPos; flowers: boolean; density: number }
  | { kind: 'boulder'; pos: CellPos; size: number }
  | { kind: 'beach'; pos: CellPos; variant: 'driftwood' | 'shell' | 'starfish' }
  | { kind: 'reeds'; pos: CellPos; face: Dir4 }
  | { kind: 'lily'; pos: CellPos };

const RULE = 'D24.wild-ground';

/** Smooth seeded noise in [0, 1] over the map: where the meadow drifts lie. */
function drift(seed: number, x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = rand(seed, 'drift', ix, iz), b = rand(seed, 'drift', ix + 1, iz), c = rand(seed, 'drift', ix, iz + 1), d = rand(seed, 'drift', ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export default defineRule<Wild>({
  id: RULE,
  part: 'decoration',
  tier: 1,
  priority: 760,
  about: 'Reads: wildGrass, leftovers, distances to blocks and floors, sheltered water, terrain. Claims: the floor slot of each tuft, boulder, find, reed stand and pad.',
  find({ facts, seed }) {
    const out: Candidate<Wild>[] = [];
    const clear = clearways(facts);
    const t = facts.terrain;
    const bare = (c: CellKey): boolean => !facts.kinds.has(c) && !facts.world.floors.has(c);

    // Tufts.
    const left = leftovers(facts);
    const uses = landUse(facts);
    // The dirt trail a street frays into (U06) is trodden bare.
    const trails = new Set(townEdge(facts).list.flatMap((e) => e.cells));
    const dS = distToStructure(facts), dF = distToFloor(facts);
    const reach = Math.max(2, DRESSING.tuftReach);
    for (const c of wildGrass(facts).cells) {
      if (left.byCell.has(c) || uses.byCell.has(c) || trails.has(c)) continue;
      const x = keyX(c), z = keyZ(c);
      const d = Math.min(dS.at(x, z), dF.at(x, z));
      const far = Math.min(1, Math.max(0, (d - 1) / (reach - 1)));
      // A drift: where the field is above its threshold the meadow is thick, elsewhere there is the odd tuft.
      const field = drift(seed, x / DRESSING.tuftDriftSize, z / DRESSING.tuftDriftSize);
      const inDrift = field > 1 - DRESSING.tuftDrift;
      const p = inDrift ? DRESSING.tuftNear + (DRESSING.tuftFar - DRESSING.tuftNear) * far : DRESSING.tuftNear * 0.6;
      if (!lucky(seed, RULE, c, 'tuft', p)) continue;
      const pos = POSITIONS[choose(seed, RULE, c, 'tuft-pos', POSITIONS.length)]!;
      if (!clear.free(c, pos)) continue;
      out.push({ anchor: c, key: 'tuft', data: { kind: 'tuft', pos, flowers: lucky(seed, RULE, c, 'tuft-flowers', DRESSING.tuftFlowers * (inDrift ? 1.3 : 0.5)), density: inDrift ? far : far * 0.3 } });
    }

    // Boulders at cliff feet, and finds on sand.
    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        const h = t.height[columnIndex(x, z)]!;
        if (h < 1) continue;
        const c = key(x, h, z);
        if (!bare(c)) continue;
        const cliffs = DIRS.filter((d) => heightAt(facts, x + DIR4[d]![0], z + DIR4[d]![1]) - h >= 2);
        if (cliffs.length && lucky(seed, RULE, c, 'boulder', DRESSING.boulder)) {
          const d = cliffs[choose(seed, RULE, c, 'boulder-side', cliffs.length)]!;
          const pos = edgePos(d);
          if (clear.free(c, pos)) out.push({ anchor: c, key: 'boulder', data: { kind: 'boulder', pos, size: (choose(seed, RULE, c, 'boulder-size', 100) + 1) / 100 } });
        }
        if (t.material[columnIndex(x, z)] === MAT.sand && lucky(seed, RULE, c, 'beach', DRESSING.beachFind)) {
          const pos = POSITIONS[choose(seed, RULE, c, 'beach-pos', POSITIONS.length)]!;
          const roll = choose(seed, RULE, c, 'beach-kind', 10);
          if (clear.free(c, pos)) out.push({ anchor: c, key: 'beach', data: { kind: 'beach', pos, variant: roll < 4 ? 'driftwood' : roll < 8 ? 'shell' : 'starfish' } });
        }
      }
    }

    // Reeds and lily pads in sheltered water.
    const claimed = facts.shape.claims;
    const water = shelteredWater(facts);
    // The sea: water joined to the map's edge. Everything else is a pond.
    const sea = new Uint8Array(SIZE_X * SIZE_Z);
    const stack: number[] = [];
    const wet = (x: number, z: number): boolean => t.height[columnIndex(x, z)] === 0;
    for (let z = 0; z < SIZE_Z; z++) {
      for (let x = 0; x < SIZE_X; x++) {
        if ((x === 0 || z === 0 || x === SIZE_X - 1 || z === SIZE_Z - 1) && wet(x, z)) {
          sea[columnIndex(x, z)] = 1;
          stack.push(columnIndex(x, z));
        }
      }
    }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % SIZE_X, z = (i / SIZE_X) | 0;
      for (const [dx, dz] of DIR4) {
        const nx = x + dx!, nz = z + dz!;
        if (nx < 0 || nz < 0 || nx >= SIZE_X || nz >= SIZE_Z || !wet(nx, nz) || sea[columnIndex(nx, nz)]) continue;
        sea[columnIndex(nx, nz)] = 1;
        stack.push(columnIndex(nx, nz));
      }
    }
    const wetCells: CellKey[] = [];
    for (let z = 1; z < SIZE_Z - 1; z++) for (let x = 1; x < SIZE_X - 1; x++) if (wet(x, z) && (!sea[columnIndex(x, z)] || water.has(key(x, 0, z)))) wetCells.push(key(x, 0, z));
    for (const c of wetCells) {
      const x = keyX(c), z = keyZ(c);
      if (keyY(c) !== 0) continue;
      // Away from docks, and from anything standing in the water here.
      if (facts.kinds.has(c) || DIRS.some((d) => facts.kinds.get(key(x + DIR4[d]![0], 0, z + DIR4[d]![1])) === 'dock')) continue;
      if (x < 1 || z < 1 || x > SIZE_X - 2 || z > SIZE_Z - 2) continue;
      const banks = DIRS.filter((d) => heightAt(facts, x + DIR4[d]![0], z + DIR4[d]![1]) > 0);
      const sides = banks.length;
      const pond = !sea[columnIndex(x, z)];
      if (!pond && sides < 3) continue;
      let reedPos: CellPos | null = null;
      if (banks.length && lucky(seed, RULE, c, 'reeds', DRESSING.reeds * (sides >= 2 ? 1 : 0.7))) {
        const d = banks[choose(seed, RULE, c, 'reeds-side', banks.length)]!;
        reedPos = edgePos(d);
        if (!claimed.has(slot.floor(c, reedPos))) out.push({ anchor: c, key: 'reeds', data: { kind: 'reeds', pos: reedPos, face: ((d + 2) % 4) as Dir4 } });
      }
      if (lucky(seed, RULE, c, 'lily', DRESSING.lilyPads)) {
        const spots = POSITIONS.filter((p) => p !== reedPos);
        const pos = spots[choose(seed, RULE, c, 'lily-pos', spots.length)]!;
        if (!claimed.has(slot.floor(c, pos))) out.push({ anchor: c, key: 'lily', data: { kind: 'lily', pos } });
      }
    }
    return out;
  },
  claims: (c) => [slot.floor(c.anchor, c.data.pos)],
  apply(c, out, { rand }) {
    const d = c.data;
    const look = Math.floor(rand('look') * 10000);
    // World-square frames (face south) for the things drawn in flat tones: see src/parts/ground/kit.ts, TONE.
    const at = { cell: c.anchor, pos: d.pos, face: 2 as Dir4 };
    if (d.kind === 'tuft') out.prop({ type: 'tuft', variant: d.flowers ? 'flowers' : 'grass', at, params: { density: Math.round(d.density * 100) / 100, look } });
    else if (d.kind === 'boulder') out.prop({ type: 'boulder', at, params: { size: d.size, look } });
    else if (d.kind === 'beach') out.prop({ type: 'beach-find', variant: d.variant, at, params: { look } });
    else if (d.kind === 'reeds') out.prop({ type: 'reeds', at: { cell: c.anchor, pos: d.pos, face: d.face }, params: { look } });
    else out.prop({ type: 'lily-pads', at, params: { look } });
  },
});
