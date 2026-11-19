// What R-F01 and R-S01 pin on a fountain or a stall, and how the generators
// read it back. Not a rule file: the rules and the generators (src/gen/
// fountain, src/gen/stall) both import it, so they cannot disagree.

import { keyX, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { rand } from '@/core/rand';
import type { RolesOf, SocketType, Tag } from '@/core/vocab';
import { FOUNTAIN } from '@/style/props';

// ──────────────────────────────────────────────────────────── fountain ──

export type FountainRole = RolesOf<'fountain'>;

export interface FountainSocket {
  type: SocketType;
  /** Distinguishes several sockets of one type in the one cell. */
  name: string;
}

/**
 * The sockets each fountain declares (R-F01 emits them; the generator
 * returns a world frame for each):
 *   pool, bowl       'water-surface': the centre of each pool of water
 *   top              'water-jet': the finial's tip, shooting up
 *   rim0 … rimN      'water-jet': where the upper bowl spills, pointing outward
 *   spout0, spout1   'water-jet': the small basin's two spouts, pointing outward
 *   rim              'perch': the lip of the birdbath
 */
export function fountainSockets(role: FountainRole): FountainSocket[] {
  const pool: FountainSocket = { type: 'water-surface', name: 'pool' };
  switch (role) {
    case 'tiered-fountain': {
      const out: FountainSocket[] = [pool, { type: 'water-surface', name: 'bowl' }, { type: 'water-jet', name: 'top' }];
      for (let k = 0; k < Math.round(FOUNTAIN.falls); k++) out.push({ type: 'water-jet', name: `rim${k}` });
      return out;
    }
    case 'well':
      return [pool];
    case 'birdbath':
      return [pool, { type: 'perch', name: 'rim' }];
    case 'basin':
      return [pool, { type: 'water-jet', name: 'spout0' }, { type: 'water-jet', name: 'spout1' }];
  }
}

/** The id R-F01 gives a fountain socket (the engine's own form for a socket with no owner). */
export function fountainSocketId(cell: CellKey, s: FountainSocket): string {
  return `${s.type}@${cell}/${s.name}`;
}

// ─────────────────────────────────────────────────────────────── stall ──

export type StallRole = RolesOf<'stall'>;

export const GOODS = ['fruit', 'bread', 'cheese', 'pots', 'cloth'] as const;
export type Goods = (typeof GOODS)[number];

/**
 * What the market stall in a cell sells. The town's seed picks where the
 * sequence starts; from there it steps with the column and the row, so no
 * two stalls within two cells of each other in a row, a column or on a
 * diagonal sell the same thing: a market is always a mix, and placing a new
 * stall never changes what its neighbours sell.
 */
export function goodsAt(worldSeed: number, cell: CellKey): Goods {
  const start = Math.floor(rand(worldSeed, 'R-S01', 'goods') * GOODS.length);
  return GOODS[(keyX(cell) + 2 * keyZ(cell) + start) % GOODS.length]!;
}
export const goodsTag = (g: Goods): Tag => `goods:${g}`;

const SIDES = ['n', 'e', 's', 'w'] as const;
export const frontTag = (d: Dir4): Tag => `front:${SIDES[d]!}`;

/** The goods a tag set names, if any. */
export function readGoods(tags: ReadonlySet<Tag> | undefined): Goods | undefined {
  if (tags) for (const g of GOODS) if (tags.has(goodsTag(g))) return g;
  return undefined;
}
/** The side a tag set says the counter faces, if any. */
export function readFront(tags: ReadonlySet<Tag> | undefined): Dir4 | undefined {
  if (tags) for (let d = 0; d < 4; d++) if (tags.has(frontTag(d as Dir4))) return d as Dir4;
  return undefined;
}
