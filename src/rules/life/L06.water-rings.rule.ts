// L06 · tier 1 · Water: rings on the sea round whatever stands in it.
//
//   dock stilts      at the deck corners and every second post along an open
//                    edge (the same posts the dock generator draws), about two
//                    in three of them, so a pier is not ringed like a target
//   generated supports standing in open water (S3): a ring round a pillar,
//                    one at two of the four corners of a set of stilts
//   blocks that stand alone in the sea: a pillar, a tower, a lighthouse
//   bridge piers that J15 says stand in the water
//
// Each is one 'water-ring' actor at a floor slot of the sea-level cell; the
// behaviour (src/life/water) moves it to the post itself and makes the ring
// grow and sink away. Rings round boats are spawned by the boats.
// (Foam at the shore and the drifting stroke lines are drawn by the sea's
// own pattern.)

import { columnIndex, DIR4_NAMES, inColumnBounds, key, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import { featuresOfType } from '@/resolve/facts/plan-index.fact';
import type { CellPos } from '@/resolve/plan';
import { freeWater } from '../roles/dock-shape';

interface Ring {
  pos: CellPos;
  variant: 'stilt' | 'pillar';
  radius: number;
}

/** How many of a dock's posts get a ring. */
const STILT_SHARE = 0.66;

const CORNERS: readonly CellPos[] = ['nw', 'ne', 'sw', 'se'];

/** The dock posts that stand in open water, as [dock cell, corner]: the dock generator's own layout. */
function dockPosts(f: Facts): [CellKey, CellPos][] {
  const out: [CellKey, CellPos][] = [];
  const isDock = (x: number, z: number): boolean => inColumnBounds(x, z) && f.kinds.get(key(x, 0, z)) === 'dock';
  const land = (x: number, z: number): boolean => inColumnBounds(x, z) && f.terrain.height[columnIndex(x, z)]! > 0;
  const seen = new Set<number>();
  for (const s of f.structures.values()) {
    if (s.kind !== 'dock') continue;
    let bx = 99, bz = 99;
    for (const c of s.cells) {
      bx = Math.min(bx, keyX(c));
      bz = Math.min(bz, keyZ(c));
    }
    for (const c of s.cells) {
      if (keyY(c) !== 0) continue;
      const x = keyX(c), z = keyZ(c);
      for (const [vx, vz] of [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]] as const) {
        const k = vx + vz * 64;
        if (seen.has(k)) continue;
        seen.add(k);
        // The four columns round the vertex: NW, NE, SW, SE.
        const round = [[vx - 1, vz - 1], [vx, vz - 1], [vx - 1, vz], [vx, vz]] as const;
        const docks = round.map(([ax, az]) => isDock(ax, az));
        const count = docks.filter(Boolean).length;
        if (count === 4 || count === 0) continue;
        if (round.some(([ax, az], i) => !docks[i] && land(ax, az))) continue;
        // A post stands only where the deck's edge is over water it could be ringed in.
        if (!round.some(([ax, az], i) => !docks[i] && freeWater(f, ax, az))) continue;
        let sx = 0, sz = 0;
        docks.forEach((d, i) => {
          if (!d) return;
          sx += i % 2 === 0 ? -1 : 1;
          sz += i < 2 ? -1 : 1;
        });
        if (count === 2 && (sx !== 0 || sz !== 0)) {
          const along = sx === 0 ? vx - bx : vz - bz;
          if (along % 2 !== 0) continue;
        }
        // Name it by a dock cell that has this vertex as a corner.
        const i = docks.indexOf(true);
        const [cx, cz] = round[i]!;
        out.push([key(cx, 0, cz), CORNERS[3 - i]!]);
      }
    }
  }
  return out;
}

export default defineRule<Ring>({
  id: 'L06.water-rings',
  part: 'life',
  tier: 1,
  priority: 940,
  about: 'Reads: dock cells, supports and lone blocks standing in open water, pier features. Emits: a water-ring actor at each post, pillar and pier.',
  find({ facts }) {
    const out: Candidate<Ring>[] = [];
    const wet = (x: number, z: number): boolean => inColumnBounds(x, z) && facts.terrain.height[columnIndex(x, z)] === 0;
    for (const [cell, pos] of dockPosts(facts)) {
      if (rand(facts.seed, 'L06', cell, pos) >= STILT_SHARE) continue;
      out.push({ anchor: cell, key: pos, data: { pos, variant: 'stilt', radius: 0.085 } });
    }
    // Generated supports with their feet in the sea.
    for (const s of facts.supports) {
      if (s.bottomY !== 0 || s.type === 'bracket') continue;
      const x = keyX(s.carries), z = keyZ(s.carries);
      if (!wet(x, z) || facts.kinds.has(key(x, 0, z))) continue;
      const cell = key(x, 0, z);
      if (s.type === 'stilts') {
        const first: CellPos = rand(facts.seed, 'L06', cell, 'which') < 0.5 ? 'ne' : 'nw';
        out.push({ anchor: cell, key: first, data: { pos: first, variant: 'stilt', radius: 0.07 } });
        const second: CellPos = first === 'ne' ? 'sw' : 'se';
        out.push({ anchor: cell, key: second, data: { pos: second, variant: 'stilt', radius: 0.07 } });
      } else {
        out.push({ anchor: cell, key: 'c', data: { pos: 'c', variant: 'pillar', radius: 0.24 } });
      }
    }
    // Blocks standing alone in the sea.
    for (const [cell, kind] of facts.kinds) {
      if (keyY(cell) !== 0 || (kind !== 'pillar' && kind !== 'tower' && kind !== 'lighthouse')) continue;
      const x = keyX(cell), z = keyZ(cell);
      if (!wet(x, z)) continue;
      if (!([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).every(([dx, dz]) => freeWater(facts, x + dx, z + dz))) continue;
      out.push({ anchor: cell, key: 'c', data: { pos: 'c', variant: 'pillar', radius: kind === 'pillar' ? 0.3 : 0.5 } });
    }
    // Bridge piers in the water.
    for (const p of featuresOfType(facts, 'pier')) {
      if (p.cell === undefined || p.params?.water !== 1) continue;
      const x = keyX(p.cell), z = keyZ(p.cell);
      if (!wet(x, z)) continue;
      const side = p.params.side;
      const pos: CellPos = side === undefined ? 'c' : DIR4_NAMES[side as Dir4]!;
      out.push({ anchor: key(x, 0, z), key: `p${pos}`, data: { pos, variant: 'pillar', radius: 0.3 } });
    }
    return out;
  },
  apply(c, out) {
    out.actor({ type: 'water-ring', variant: c.data.variant, at: { cell: c.anchor, pos: c.data.pos }, params: { radius: c.data.radius } });
  },
});
