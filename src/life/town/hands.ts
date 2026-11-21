// Who does a chain's work, and where they stand to do it. Shared by the
// chains in src/life/town/chains.

import { DIR4, type CellKey, type Dir4 } from '@/core/grid';
import { usableDoors } from '@/resolve/nav';
import type { Person } from '../people/crowd';
import { DIR_HEADING, type Board, type Chain, type Post } from './board';

/** Grown-ups who can take work: out in the world, not leaving, not shut in. */
export function canWork(p: Person): boolean {
  return !p.child && !p.shutIn && !p.leaving && p.mode !== 'gone';
}

/** The cell outside a person's front door, or null. */
export function homeCell(board: Board, p: Person): CellKey | null {
  const nav = board.nav;
  const d = nav ? usableDoors(nav, p.home)[0] : undefined;
  return d && nav ? nav.nodes[d.node]!.cell : null;
}

/** Whether a person can walk to a cell from where they are now. */
export function reaches(board: Board, p: Person, cell: CellKey): boolean {
  const nav = board.nav;
  if (!nav) return false;
  const to = nav.nodeAt.get(cell);
  if (to === undefined) return false;
  const from = p.node >= 0 ? p.node : -1;
  return from < 0 || nav.part[from] === nav.part[to];
}

/**
 * The person to keep as a chain's hands: whoever already is, if they still can be; else the first of those
 * `prefer` likes, else whoever lives nearest `near`. Claims them for the chain.
 */
export function keepHand(board: Board, chain: Chain, had: Person | null, near: CellKey, prefer: (p: Person) => boolean): Person | null {
  if (had && canWork(had) && board.claimedBy(had) === chain && reaches(board, had, near)) return had;
  if (had && board.claimedBy(had) === chain) board.unclaim(had);
  let best: Person | null = null;
  let bestScore = Infinity;
  for (const p of board.crowd.people) {
    if (!canWork(p) || board.claimedBy(p) !== null) continue;
    const home = homeCell(board, p);
    if (home === null || !reaches(board, p, near)) continue;
    const score = (prefer(p) ? 0 : 1000) + board.dist(home, near);
    if (score < bestScore || (score === bestScore && best !== null && p.id < best.id)) {
      bestScore = score;
      best = p;
    }
  }
  if (best) board.claim(best, chain);
  return best;
}

/** Where to stand at a post, facing the thing it is for: `reach` toward it from the cell's middle, `side` across. */
export function standAt(board: Board, post: { cell: CellKey; dir?: Dir4 }, reach = 0.22, side = 0): { spot: { x: number; z: number }; face: number } {
  const c = board.centre(post.cell);
  if (post.dir === undefined) return { spot: { x: c.x, z: c.z }, face: NaN };
  const [dx, dz] = DIR4[post.dir]!;
  return { spot: { x: c.x + dx * reach - dz * side, z: c.z + dz * reach + dx * side }, face: DIR_HEADING[post.dir] };
}

/** The first post of a role. */
export function postOf(board: Board, chain: string, role: string): Post | undefined {
  return board.posts(chain).find((p) => p.role === role);
}

/**
 * Nobody else's: no chain holds them, no plan is under way, and they are not standing at (or walking to) a
 * step of somebody's errand (a player on a court keeps the step after their plan has run out). What a scene
 * asks before it takes somebody.
 */
export function unbusy(board: Board, p: Person): boolean {
  if (board.claimedBy(p) || board.plans.has(p)) return false;
  return !(p.goal?.errand && (p.mode === 'linger' || p.mode === 'walk' || p.mode === 'visit'));
}
