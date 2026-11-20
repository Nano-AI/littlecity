// The share codec's version 5 body (save.ts has the container and the
// format summary): the whole town as one stream of bits, each coded by the
// range coder (rangecoder.ts) under a context chosen from what has been read
// already, so a town's regularities cost almost nothing: a storey on the
// storey below, a row stepping on, a colour like the block underneath, a
// path beside a path.
//
// One walk serves both ways. Encoding, it is given the world and codes each
// value; decoding, it is given null and builds the world from the bits read.
// The contexts depend only on what both sides have already seen, so the two
// stay in step. Decoding checks every value as it goes and throws Bad with a
// reason; the loops are bounded, so garbage ends quickly.

import { edgeCells, inBounds, key, keyX, keyY, keyZ, NO_CELL, type CellKey, type EdgeKey } from '@/core/grid';
import { EDGE_KINDS, FLOOR_KINDS, PALETTE_SIZE, type EdgeKind, type FloorKind, type PlacedKind } from '@/core/kinds';
import type { Block, Rot, World } from '@/core/world';
import { isHouseStyle } from '@/style/houses';
import { LAND_MAX, landEditable } from '@/terrain/land';
import { isRuin, savedRuin } from './damage';
import { RangeDecoder, RangeEncoder, sint, SINT_CONTEXTS, sym, uint, UINT_CONTEXTS, type Coder } from './rangecoder';

/** Why a body was refused. */
export class Bad extends Error {
  constructor(readonly otherVersion: boolean) {
    super(otherVersion ? 'other version' : 'damaged');
  }
}
const damaged = (): never => {
  throw new Bad(false);
};

/** Section flags, as in version 4. Take the next free bit for a new section (bit 2 is promised to the island size). */
export const SECTION_LAND = 1 << 0;
export const SECTION_RUINS = 1 << 1;
const KNOWN_SECTIONS = SECTION_LAND | SECTION_RUINS;

/** Kind codes. Append only: the order is part of the format (the same list as versions 1 to 4). */
export const PLACED: readonly PlacedKind[] = [
  'auto', 'house', 'tower', 'lighthouse', 'arch', 'dock', 'marble', 'pillar',
  'stairs', 'windmill', 'tree', 'fountain', 'stall', 'fence', 'wall',
];
const KIND_BITS = 4;
const FLOOR_BITS = 3;
const EDGE_BITS = 2;
const N = 48;
const MAX_BLOCKS = 48 * 48 * 32;

// ─────────────────────────────────────────────────────────── contexts ──
// Every slot of the probability table, by what it codes. Changing this
// layout (or any context choice below) changes the format.

let size = 0;
const take = (n: number): number => {
  const at = size;
  size += n;
  return at;
};
const SYM_KIND = 1 << KIND_BITS;
const SYM_FLOOR = 1 << FLOOR_BITS;
const SYM_EDGE = 1 << EDGE_BITS;
const C = {
  gen: take(1),
  blocks: take(UINT_CONTEXTS),
  gap: take(UINT_CONTEXTS),
  /** Is this block on the block after the one under the last block (a storey repeating the one below)? By the last answer. */
  above: take(2),
  /** Is this step the one that followed the last step the last time it was taken? By the last answer. */
  follow: take(2),
  /** The same step as the last block's? By the last "above" answer. */
  same: take(2),
  dy: take(2 * SINT_CONTEXTS), // by: did the last step change level
  dx: take(2 * SINT_CONTEXTS), // by: does this one
  dz: take(4 * SINT_CONTEXTS), // by: does this one, and is dx zero
  kind: take(32 * SYM_KIND), // by: the kind below, or else the last kind
  color: take(32 * 8), // by: the colour below (same kind), the last colour (same kind), or the kind
  rot: take(4),
  styled: take(4), // by: is it a house, was the last block styled
  style: take(8),
  nextSeq: take(UINT_CONTEXTS),
  floorHas: take(16), // by: floors west, north, north-west, north-east
  floorKind: take(9 * 9 * SYM_FLOOR), // by: the kinds west and north
  floorY: take(2 * SINT_CONTEXTS), // by: is there a neighbour to read the level from
  floorStep: take(UINT_CONTEXTS),
  floorMore: take(1),
  edges: take(UINT_CONTEXTS),
  edgeGap: take(UINT_CONTEXTS),
  edgeKind: take(SYM_EDGE * SYM_EDGE), // by: the last kind
  sections: take(UINT_CONTEXTS),
  landHas: take(8), // by: editable, edited west, edited north
  landHeight: take(16),
  landStep: take(SINT_CONTEXTS),
  ruined: take(4), // by: the last block ruined, the block below ruined
  ruinSame: take(1),
  ruin: take(1024),
};
const CONTEXTS = size;
/** A step (each axis −64 to 63) as one number. */
const moveKey = (dx: number, dy: number, dz: number): number => ((dx + 64) << 14) | ((dy + 64) << 7) | (dz + 64);
const unMove = (m: number): [number, number, number] => [(m >> 14) - 64, ((m >> 7) & 127) - 64, (m & 127) - 64];

// ─────────────────────────────────────────────────────────────── walk ──

interface Decoded {
  terrainGen: 1 | 2;
  nextSeq: number;
  blocks: Map<CellKey, Block>;
  floors: Map<CellKey, FloorKind>;
  edges: Map<EdgeKey, EdgeKind>;
  terrainEdits?: Map<number, number>;
}

/** Codes (src given) or reads (src null) a town body. */
function walk(c: Coder, src: World | null, moreFlags = 0): Decoded {
  const enc = src !== null;
  const terrainGen: 1 | 2 = c.bit(C.gen, src?.terrainGen === 2 ? 1 : 0) ? 2 : 1;

  // Blocks, in placement order.
  const list = src ? [...src.blocks].sort((a, b) => a[1].seq - b[1].seq) : [];
  const n = uint(c, C.blocks, list.length);
  if (n > MAX_BLOCKS) damaged();
  const blocks = new Map<CellKey, Block>();
  const order: CellKey[] = [];
  const indexOf = new Map<CellKey, number>();
  const kinds: number[] = [];
  const colors: number[] = [];
  let px = 0, py = 0, pz = 0, pdx = 0, pdy = 0, pdz = 0;
  let pseq = 0, pk = 0, pc = 0, pstyled = 0, ptr = -1, lastHit = 0, lastFollow = 0;
  const followed = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const [tcell, tb] = enc ? list[i]! : [0, null];
    const tx = keyX(tcell), ty = keyY(tcell), tz = keyZ(tcell);
    const seq = pseq + 1 + uint(c, C.gap, tb ? tb.seq - pseq - 1 : 0);
    let x: number, y: number, z: number;
    let placed = false;
    // A storey going up the way the one below went: the block over the one after the block underneath the last.
    if (ptr >= 0 && ptr + 1 < i) {
      const q = order[ptr + 1]!;
      const qx = keyX(q), qy = keyY(q) + 1, qz = keyZ(q);
      lastHit = c.bit(C.above + lastHit, enc && tx === qx && ty === qy && tz === qz ? 1 : 0);
      if (lastHit) {
        [x, y, z] = [qx, qy, qz];
        placed = true;
      }
    }
    // The step that came after this same step last time (a pattern repeating: the next house of a row).
    const lastMove = moveKey(pdx, pdy, pdz);
    const follow = followed.get(lastMove);
    if (!placed && follow !== undefined && follow !== lastMove) {
      const [fx, fy, fz] = unMove(follow);
      lastFollow = c.bit(C.follow + lastFollow, enc && tx - px === fx && ty - py === fy && tz - pz === fz ? 1 : 0);
      if (lastFollow) {
        [x, y, z] = [px + fx, py + fy, pz + fz];
        placed = true;
      }
    }
    if (!placed) {
      if (c.bit(C.same + lastHit, enc && tx - px === pdx && ty - py === pdy && tz - pz === pdz ? 1 : 0)) [x, y, z] = [px + pdx, py + pdy, pz + pdz];
      else {
        const dy = sint(c, C.dy + (pdy !== 0 ? SINT_CONTEXTS : 0), ty - py);
        const dx = sint(c, C.dx + (dy !== 0 ? SINT_CONTEXTS : 0), tx - px);
        const dz = sint(c, C.dz + ((dy !== 0 ? 2 : 0) + (dx !== 0 ? 1 : 0)) * SINT_CONTEXTS, tz - pz);
        [x, y, z] = [px + dx, py + dy, pz + dz];
      }
    }
    if (!inBounds(x!, y!, z!)) damaged();
    const cell = key(x!, y!, z!);
    if (blocks.has(cell)) damaged();
    [pdx, pdy, pdz] = [x! - px, y! - py, z! - pz];
    followed.set(lastMove, moveKey(pdx, pdy, pdz));
    [px, py, pz] = [x!, y!, z!];
    const below = y! > 0 ? indexOf.get(key(x!, y! - 1, z!)) : undefined;
    const k = sym(c, C.kind + (below !== undefined ? 16 + kinds[below]! : pk) * SYM_KIND, tb ? PLACED.indexOf(tb.kind) : 0, KIND_BITS);
    const kind = PLACED[k];
    if (kind === undefined) damaged();
    const cctx = below !== undefined && kinds[below] === k ? colors[below]! : k === pk ? 8 + pc : 16 + k;
    const color = sym(c, C.color + cctx * 8, tb ? tb.color : 0, 3);
    if (color >= PALETTE_SIZE) damaged();
    const rot = (kind === 'stairs' ? sym(c, C.rot, tb ? tb.rot : 0, 2) : 0) as Rot;
    const styled = c.bit(C.styled + (kind === 'house' ? 2 : 0) + pstyled, tb?.style ? 1 : 0);
    const block: Block = { kind: kind!, color, rot, seq };
    if (styled) {
      const style = sym(c, C.style, tb ? tb.style! : 0, 3);
      if (style === 0 || !isHouseStyle(style)) damaged();
      block.style = style;
    }
    blocks.set(cell, block);
    indexOf.set(cell, i);
    order.push(cell);
    kinds.push(k);
    colors.push(color);
    [pseq, pk, pc, pstyled] = [seq, k, color, styled];
    ptr = below ?? -1;
  }
  const nextSeq = pseq + 1 + uint(c, C.nextSeq, src ? src.nextSeq - pseq - 1 : 0);

  // Floors, column by column (rows of z, x along each), lowest first in a column.
  const byColumn = new Map<number, [number, number][]>();
  if (src) {
    for (const [cell, f] of [...src.floors].sort((a, b) => a[0] - b[0])) {
      const col = keyX(cell) + keyZ(cell) * N;
      const at = byColumn.get(col) ?? [];
      at.push([keyY(cell), FLOOR_KINDS.indexOf(f)]);
      byColumn.set(col, at);
    }
  }
  /** Per column, the lowest floor's level and kind (−1: none). */
  const firstY = new Int8Array(N * N).fill(-1);
  const firstKind = new Int8Array(N * N).fill(-1);
  const floorList: [CellKey, FloorKind][] = [];
  let lastY = 1;
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const col = x + z * N;
      const w = x > 0 ? col - 1 : -1;
      const nn = z > 0 ? col - N : -1;
      const nw = x > 0 && z > 0 ? col - N - 1 : -1;
      const ne = x < N - 1 && z > 0 ? col - N + 1 : -1;
      const has = (i: number): number => (i >= 0 && firstKind[i]! >= 0 ? 1 : 0);
      const here = byColumn.get(col);
      if (!c.bit(C.floorHas + has(w) + 2 * has(nn) + 4 * has(nw) + 8 * has(ne), here ? 1 : 0)) continue;
      const kctx = (w >= 0 ? firstKind[w]! + 1 : 0) * 9 + (nn >= 0 ? firstKind[nn]! + 1 : 0);
      let prevY = -1;
      for (let j = 0; ; j++) {
        if (j >= 32) damaged();
        const [ty, tk] = here?.[j] ?? [0, 0];
        const k = sym(c, C.floorKind + kctx * SYM_FLOOR, tk, FLOOR_BITS);
        const kind = FLOOR_KINDS[k];
        if (kind === undefined) damaged();
        let y: number;
        if (j === 0) {
          const from = has(w) ? firstY[w]! : has(nn) ? firstY[nn]! : -1;
          const pred = from >= 0 ? from : lastY;
          y = pred + sint(c, C.floorY + (from >= 0 ? SINT_CONTEXTS : 0), ty - pred);
        } else y = prevY + 1 + uint(c, C.floorStep, ty - prevY - 1);
        if (y < 0 || y >= 32) damaged();
        if (j === 0) {
          firstY[col] = y;
          firstKind[col] = k;
        }
        floorList.push([key(x, y, z), kind!]);
        prevY = lastY = y;
        if (!c.bit(C.floorMore, here && j + 1 < here.length ? 1 : 0)) break;
      }
    }
  }
  floorList.sort((a, b) => a[0] - b[0]);
  const floors = new Map<CellKey, FloorKind>(floorList);

  // Edges, in key order, each a step on from the last.
  const edgeKeys = src ? [...src.edges.keys()].sort((a, b) => a - b) : [];
  const nEdges = uint(c, C.edges, edgeKeys.length);
  if (nEdges > 48 * 48 * 32 * 2) damaged();
  const edges = new Map<EdgeKey, EdgeKind>();
  let prev = -1;
  let pek = 0;
  for (let i = 0; i < nEdges; i++) {
    const te = edgeKeys[i] ?? 0;
    const e = prev + 1 + uint(c, C.edgeGap, te - prev - 1);
    prev = e;
    const [a, b] = edgeCells(e);
    if (a < 0 || a >= 1 << 17 || !inBounds(keyX(a), keyY(a), keyZ(a)) || b === NO_CELL) damaged();
    const k = sym(c, C.edgeKind + pek * SYM_EDGE, src ? EDGE_KINDS.indexOf(src.edges.get(te)!) : 0, EDGE_BITS);
    const kind = EDGE_KINDS[k];
    if (kind === undefined) damaged();
    edges.set(e, kind!);
    pek = k;
  }

  // Optional sections, as in version 4: flags, then each present section, lowest bit first.
  const out: Decoded = { terrainGen, nextSeq, blocks, floors, edges };
  const tEdits = src?.terrainEdits && src.terrainEdits.size > 0 ? src.terrainEdits : null;
  const tRuins = src ? order.map((cell) => savedRuin(src.blocks.get(cell)!.ruin)) : [];
  const flags = uint(c, C.sections, (tEdits ? SECTION_LAND : 0) | (tRuins.some((r) => r) ? SECTION_RUINS : 0) | moreFlags);
  if (!enc && flags & ~KNOWN_SECTIONS) throw new Bad(true);
  if (flags & SECTION_LAND) {
    // Bit 0, the reshaped land: every column of the map in index order, edited or not, and its height.
    const edits = new Map<number, number>();
    for (let col = 0; col < N * N; col++) {
      const x = col % N, z = (col / N) | 0;
      const w = x > 0 ? edits.get(col - 1) : undefined;
      const nn = z > 0 ? edits.get(col - N) : undefined;
      const th = tEdits?.get(col);
      const ctx = (landEditable(x, z) ? 4 : 0) + (w !== undefined ? 1 : 0) + (nn !== undefined ? 2 : 0);
      if (!c.bit(C.landHas + ctx, th !== undefined ? 1 : 0)) continue;
      const pred = w ?? nn;
      const h = pred === undefined ? sym(c, C.landHeight, th ?? 0, 4) : pred + sint(c, C.landStep, (th ?? 0) - pred);
      if (!landEditable(x, z) || h < 0 || h > LAND_MAX) damaged();
      edits.set(col, h);
    }
    if (edits.size === 0) damaged();
    out.terrainEdits = edits;
  }
  if (flags & SECTION_RUINS) {
    // Bit 1, damaged blocks: per block in placement order, ruined or not, and its damage.
    let count = 0;
    let lastRuin = -1;
    const ruined = new Uint8Array(order.length);
    for (let i = 0; i < order.length; i++) {
      const cell = order[i]!;
      const below = keyY(cell) > 0 ? indexOf.get(cell - 4096) : undefined;
      const tr = tRuins[i] ?? 0;
      const ctx = (i > 0 ? ruined[i - 1]! : 0) + 2 * (below !== undefined ? ruined[below]! : 0);
      if (!c.bit(C.ruined + ctx, tr ? 1 : 0)) continue;
      const ruin = c.bit(C.ruinSame, tr === lastRuin ? 1 : 0) ? lastRuin : sym(c, C.ruin, tr, 10);
      if (!isRuin(ruin) || savedRuin(ruin) !== ruin) damaged();
      ruined[i] = 1;
      lastRuin = ruin;
      count++;
      blocks.set(cell, { ...blocks.get(cell)!, ruin });
    }
    if (count === 0) damaged();
  }
  return out;
}

/** The body of a version 5 code for this town. `moreFlags` sets section flags with nothing behind them (tests: a section from a later version). */
export function encodeBody(w: World, moreFlags = 0): Uint8Array {
  const e = new RangeEncoder(CONTEXTS);
  walk(e, w, moreFlags);
  return e.finish();
}

/** The town in a version 5 body (seed from the header). Throws Bad, or anything else, if it is not one. */
export function decodeBody(body: Uint8Array, seed: number): World {
  const d = walk(new RangeDecoder(body, CONTEXTS), null);
  let world: World = { version: 1, seed, nextSeq: d.nextSeq, blocks: d.blocks, floors: d.floors, edges: d.edges };
  if (d.terrainGen === 2) world = { ...world, terrainGen: 2 };
  if (d.terrainEdits) world = { ...world, terrainEdits: d.terrainEdits };
  return world;
}
