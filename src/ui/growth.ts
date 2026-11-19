// Playing a grown town (design section 15a): clear the island, then apply
// the generator's edits in order at about 25 a second, each one landing like
// a placed piece, so the town visibly builds itself district by district.
// skip() puts the rest down at once. The clearing and the whole growth are
// one undo step (the Game's batch). No DOM: the interface ticks it from the
// frame loop with the clock and wires skip to a click or a key.

import { keyY } from '@/core/grid';
import type { Edit, Terrain, World } from '@/core/world';
import { initialWorld, terrainGenOf } from '@/terrain/terrain';
import type { Game } from '@/app/game';

export interface Growth {
  /** A growth is playing. */
  readonly active: boolean;
  /** Edits still to come. */
  readonly left: number;
  /** Clears the island and starts playing these edits (computed for an empty island). */
  start(edits: readonly Edit[]): void;
  /** Once per frame with the clock in milliseconds: puts down the edits that are due. */
  tick(now: number): void;
  /** Puts down everything that is left, at once. */
  skip(): void;
  /** Stops where it is (the town so far stays, as one undo step). */
  stop(): void;
}

export interface GrowthOptions {
  /** Edits a second. Default 25. */
  rate?: number;
  /** At most this many edits in one frame, so a slow frame never stalls the view. Default 3. */
  perFrame?: number;
  /** The growth finished (played out, skipped or stopped). */
  onDone?(): void;
}

/** True if the island holds nothing but its starting trees (no confirmation is needed to grow over it). */
export function onlyStartingTrees(world: World, terrain: Terrain): boolean {
  if (world.floors.size > 0 || world.edges.size > 0) return false;
  const start = initialWorld(world.seed, terrain, terrainGenOf(world));
  for (const [cell, b] of world.blocks) if (b.kind !== 'tree' || start.blocks.get(cell)?.kind !== 'tree') return false;
  return true;
}

/** The edits that clear the island: edge pieces, floors, then blocks from the top down. */
export function clearingEdits(world: World): Edit[] {
  const out: Edit[] = [];
  for (const edge of world.edges.keys()) out.push({ type: 'eraseEdge', edge });
  for (const cell of world.floors.keys()) out.push({ type: 'eraseFloor', cell });
  const blocks = [...world.blocks.keys()].sort((a, b) => keyY(b) - keyY(a) || b - a);
  for (const cell of blocks) out.push({ type: 'eraseBlock', cell });
  return out;
}

export function createGrowth(game: Game, opts: GrowthOptions = {}): Growth {
  const rate = opts.rate ?? 25;
  const perFrame = opts.perFrame ?? 3;
  let queue: Edit[] = [];
  let next = 0;
  let active = false;
  let last: number | null = null;
  let due = 0;

  const finish = (): void => {
    if (!active) return;
    active = false;
    queue = [];
    next = 0;
    game.end();
    opts.onDone?.();
  };

  return {
    get active() {
      return active;
    },
    get left() {
      return active ? queue.length - next : 0;
    },
    start(edits) {
      finish();
      game.begin();
      const clear = clearingEdits(game.world);
      if (clear.length > 0) game.editAll(clear);
      queue = [...edits];
      next = 0;
      last = null;
      due = 0;
      active = true;
      if (queue.length === 0) finish();
    },
    tick(now) {
      if (!active) return;
      if (last === null) last = now;
      due += (Math.max(0, now - last) / 1000) * rate;
      last = now;
      let n = Math.min(Math.floor(due), perFrame);
      due -= Math.floor(due);
      while (n-- > 0 && next < queue.length) game.edit(queue[next++]!);
      if (next >= queue.length) finish();
    },
    skip() {
      if (!active) return;
      game.editAll(queue.slice(next));
      next = queue.length;
      finish();
    },
    stop: finish,
  };
}
