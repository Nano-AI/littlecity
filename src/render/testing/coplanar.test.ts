// Coplanar faces in the dense towns (Look; docs/swarm/steady-ink.md). Two faces in one plane, facing
// one way and overlapping, with different ink ids, trade pixels as the camera moves, and every traded
// pixel draws a seam: the face fills with scribble for a frame. The view settles most such ties, but
// one pair in 24 still fights; the fix that always works is in the geometry (lift a detail 0.004 off
// the face it sits on, leave a hidden face out, or trim one of two solids). This holds the towns to
// that: a new piece that lays a face on another's shows up here, with a place to look.
//
// Same scan as `node src/render/testing/coplanar.mjs <scenario> --props=1 --pairs`: structures, layers
// and every prop where the layout puts it. (Actors are left out: at rest the people waiting at a door
// stand in one another, which life never shows.)

import { describe, expect, test } from 'vitest';
import { resolveDressing, resolveShape } from '@/resolve/index';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { coplanarPairs, kindOf, type CoplanarPair } from './coplanar-scan';

/**
 * Pairs that share less than this (square units) are left out: 0.022 × 0.022, about a pixel at
 * playing zoom. Below it are pieces that touch at a corner or along an edge (two marble blocks
 * diagonal to each other, a window's pane at its frame's rim), not a face lying on another.
 */
const MIN_SHARED = 5e-4;

/**
 * What may remain in any one town, by the kinds of the two sides, with the most pairs allowed. Each is
 * something a generator or part cannot fix from what it may read, or a small known clash between two
 * owners' pieces, written down here so it does not grow.
 */
const ALLOWED: Record<string, number> = {
  // Two docks touching corner to corner: their deck overhangs meet in the open cell's corner, 0.035 each
  // way. Neither dock can see the other (a diagonal neighbour is not in its hash).
  'dock / dock': 1,
  // A marble block's cornice stops, end on, in the face of an arch that runs into its side (or a base
  // course where an arch's pier meets it). The marble generator cannot tell a full arch (which buries
  // it) from a buttress rib (which leaves it showing), so it keeps the cornice.
  'arch / marble': 2,
  // A balustrade edge run (J19) ends in a post at a stair's head, where the stair draws its own
  // balustrade post: two posts in one place. Neither structure sees the other's edge pieces.
  'fence / stairs': 6,
  // Props against other owners' pieces, small (under 0.04 square units each), each a clash of positions
  // two rules choose apart: a laundry line's wall brackets in the plane of a window frame (D05 does not
  // know where the windows are); a retaining wall's end pier (U07) in the plane of a fence post, a
  // path's gate post or a house's board on the same cell line; a pocket park's hedge (U01) against a
  // plaza's edge; a woodpile's logs on a window sill; a street lamp's foot on a path's dirt patch; two
  // crates of a dock's goods stack (D15) level with each other.
  'house / prop laundry-line': 14,
  'house / prop retaining-wall': 1,
  'path / prop retaining-wall': 3,
  'fence / prop retaining-wall': 1,
  'plaza / prop hedge': 1,
  'house / prop woodpile': 1,
  'path / prop lamp': 1,
  'prop goods-stack / prop goods-stack': 2,
  // A front garden's corner post (U03) where a placed fence run (an edge piece) or a retaining wall's
  // pier ends at the same grid corner: two posts in one place. Known, not yet fixed: U03 would need the
  // edge pieces' post positions.
  'fence / prop garden-fence': 6,
  'prop garden-fence / prop retaining-wall': 2,
};

const SCENARIOS = [
  'everything', 'grown-town-1', 'grown-town-2', 'grown-town-3', 'grown-town-4', 'grown-town-5', 'grown-town-6', 'grown-town-7',
  'dressing-town', 'people-town', 'monuments-vertical', 'village-green-and-harbour', 'look-terrain2-river-town',
];

const where = (p: CoplanarPair): string => `${p.a} / ${p.b} at ${p.at.map((v) => v.toFixed(2)).join(', ')} (shares ${p.shared.toFixed(4)})`;

describe('no faces lie on each other in the dense towns (coplanar overlaps with different ink ids)', () => {
  for (const name of SCENARIOS) {
    test(name, { timeout: 300_000 }, () => {
      const scn = findScenario(name);
      expect(scn, name).toBeDefined();
      const built = buildScenario(scn!);
      const opts = scenarioResolveOptions(scn!);
      const shape = resolveShape(built.world, built.terrain, opts);
      const pairs = coplanarPairs(shape, resolveDressing(shape, opts)).filter((p) => p.shared >= MIN_SHARED);
      const byKinds = new Map<string, CoplanarPair[]>();
      for (const p of pairs) {
        const label = [kindOf(p.a), kindOf(p.b)].sort().join(' / ');
        byKinds.set(label, [...(byKinds.get(label) ?? []), p]);
      }
      const over: string[] = [];
      for (const [label, list] of byKinds) {
        const max = ALLOWED[label] ?? 0;
        if (list.length > max) over.push(`${label}: ${list.length} pairs (allowed ${max}), e.g. ${list.slice(0, 3).map(where).join('; ')}`);
      }
      expect(over, `faces lying on each other in ${name} (run node src/render/testing/coplanar.mjs ${name} --min 0.0005 --props=1 --pairs)`).toEqual([]);
    });
  }
});
