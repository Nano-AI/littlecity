// TEST HELPER ONLY: the share encoder exactly as it was before the short
// links (versions 1 to 4, fixed-Huffman deflate), frozen at ab93d9d so the
// tests can make old links of any town and prove they still open. Never
// change it; the game does not import it.

import { keyX, keyY, keyZ } from '@/core/grid';
import { EDGE_KINDS, FLOOR_KINDS, type PlacedKind } from '@/core/kinds';
import type { Block, World } from '@/core/world';
import { savedRuin } from './damage';
import { toBase64Url } from './deflate';

const PLACED: readonly PlacedKind[] = [
  'auto', 'house', 'tower', 'lighthouse', 'arch', 'dock', 'marble', 'pillar',
  'stairs', 'windmill', 'tree', 'fountain', 'stall', 'fence', 'wall',
];

class Writer {
  bytes: number[] = [];
  byte(b: number): void {
    this.bytes.push(b & 0xff);
  }
  u32(v: number): void {
    for (let i = 0; i < 4; i++) this.byte(v >>> (8 * i));
  }
  varint(v: number): void {
    let n = Math.max(0, Math.floor(v));
    while (n >= 0x80) {
      this.byte((n & 0x7f) | 0x80);
      n = Math.floor(n / 128);
    }
    this.byte(n);
  }
}

const zigzag = (n: number): number => (n >= 0 ? n * 2 : -n * 2 - 1);

function checksum(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, 0x01000193);
  return h >>> 0;
}

const sortedKeys = <K extends number>(m: ReadonlyMap<K, unknown>): K[] => [...m.keys()].sort((a, b) => a - b);

/** The version the old encoder chose. */
export function legacyVersion(w: World): 1 | 2 | 3 | 4 {
  if (w.terrainEdits && w.terrainEdits.size > 0) return 4;
  for (const b of w.blocks.values()) if (savedRuin(b.ruin)) return 4;
  if (w.terrainGen === 2) return 3;
  for (const b of w.blocks.values()) if (b.style) return 2;
  return 1;
}

/** The old payload (before deflate). */
export function legacyPayload(w: World): Uint8Array {
  const version = legacyVersion(w);
  const p = new Writer();
  p.u32(w.seed | 0);
  if (version >= 3) p.byte(w.terrainGen ?? 1);
  p.varint(w.nextSeq);
  const blocks = [...w.blocks].sort((a, b) => a[1].seq - b[1].seq);
  p.varint(blocks.length);
  let px = 0, py = 0, pz = 0, pseq = 0;
  for (const [cell, b] of blocks) {
    p.varint(b.seq - pseq - 1);
    pseq = b.seq;
    p.varint(zigzag(keyX(cell) - px));
    p.varint(zigzag(keyY(cell) - py));
    p.varint(zigzag(keyZ(cell) - pz));
    px = keyX(cell);
    py = keyY(cell);
    pz = keyZ(cell);
    const styled = version !== 1 && !!b.style;
    p.byte(PLACED.indexOf(b.kind) | (b.color << 4) | (styled ? 0x80 : 0));
    if (b.kind === 'stairs') p.byte(b.rot);
    if (styled) p.byte(b.style!);
  }
  let prev = -1;
  const floors = sortedKeys(w.floors);
  p.varint(floors.length);
  for (const cell of floors) {
    p.varint(cell - prev);
    prev = cell;
    p.byte(FLOOR_KINDS.indexOf(w.floors.get(cell)!));
  }
  prev = -1;
  const edges = sortedKeys(w.edges);
  p.varint(edges.length);
  for (const e of edges) {
    p.varint(e - prev);
    prev = e;
    p.byte(EDGE_KINDS.indexOf(w.edges.get(e)!));
  }
  if (version === 4) legacySections(p, w, blocks.map(([, b]) => b));
  return Uint8Array.from(p.bytes);
}

function legacySections(p: Writer, w: World, order: readonly Block[]): void {
  let flags = 0;
  const sections: number[][] = [];
  if (w.terrainEdits && w.terrainEdits.size > 0) {
    flags |= 1;
    const s = new Writer();
    const cols = sortedKeys(w.terrainEdits);
    s.varint(cols.length);
    let prev = -1;
    for (const c of cols) {
      s.varint(c - prev);
      prev = c;
      s.byte(w.terrainEdits.get(c)!);
    }
    sections.push(s.bytes);
  }
  const ruined: [number, number][] = [];
  order.forEach((b, i) => {
    const r = savedRuin(b.ruin);
    if (r) ruined.push([i, r]);
  });
  if (ruined.length > 0) {
    flags |= 2;
    const s = new Writer();
    s.varint(ruined.length);
    let prev = -1;
    for (const [i, r] of ruined) {
      s.varint(i - prev);
      prev = i;
      s.varint(r);
    }
    sections.push(s.bytes);
  }
  p.varint(flags);
  for (const bytes of sections) {
    p.varint(bytes.length);
    for (const b of bytes) p.byte(b);
  }
}

/** A share code exactly as the old encoder wrote it. */
export function legacyEncodeTown(w: World): string {
  const payload = legacyPayload(w);
  const sum = checksum(payload);
  const head = [0x4c, 0x43, legacyVersion(w), sum & 255, (sum >>> 8) & 255, (sum >>> 16) & 255, sum >>> 24];
  const packed = legacyDeflate(payload);
  const all = new Uint8Array(head.length + packed.length);
  all.set(head);
  all.set(packed, head.length);
  return toBase64Url(all);
}

// ─────────────────────────────── the old deflate: LZ77, fixed Huffman only ──

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

class BitWriter {
  private bytes: number[] = [];
  private acc = 0;
  private n = 0;
  bits(value: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.acc |= ((value >>> i) & 1) << this.n;
      if (++this.n === 8) {
        this.bytes.push(this.acc);
        this.acc = 0;
        this.n = 0;
      }
    }
  }
  code(code: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) this.bits((code >>> i) & 1, 1);
  }
  finish(): Uint8Array {
    if (this.n > 0) this.bytes.push(this.acc);
    return Uint8Array.from(this.bytes);
  }
}

function lit(w: BitWriter, sym: number): void {
  if (sym < 144) w.code(0x30 + sym, 8);
  else if (sym < 256) w.code(0x190 + sym - 144, 9);
  else if (sym < 280) w.code(sym - 256, 7);
  else w.code(0xc0 + sym - 280, 8);
}

/** The old fixed-Huffman deflate, byte for byte. */
export function legacyDeflate(data: Uint8Array): Uint8Array {
  const w = new BitWriter();
  w.bits(1, 1);
  w.bits(1, 2);
  const head = new Map<number, number>();
  const prev = new Int32Array(data.length).fill(-1);
  const key3 = (i: number): number => (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
  const insert = (i: number): void => {
    if (i + 2 >= data.length) return;
    const k = key3(i);
    prev[i] = head.get(k) ?? -1;
    head.set(k, i);
  };
  let i = 0;
  while (i < data.length) {
    let bestLen = 0;
    let bestDist = 0;
    if (i + 2 < data.length) {
      let cand = head.get(key3(i)) ?? -1;
      let chain = 64;
      while (cand >= 0 && i - cand <= 32768 && chain-- > 0) {
        let len = 0;
        while (len < 258 && i + len < data.length && data[cand + len] === data[i + len]) len++;
        if (len > bestLen) {
          bestLen = len;
          bestDist = i - cand;
          if (len === 258) break;
        }
        cand = prev[cand]!;
      }
    }
    if (bestLen >= 3) {
      let li = LEN_BASE.length - 1;
      while (LEN_BASE[li]! > bestLen) li--;
      lit(w, 257 + li);
      w.bits(bestLen - LEN_BASE[li]!, LEN_EXTRA[li]!);
      let di = DIST_BASE.length - 1;
      while (DIST_BASE[di]! > bestDist) di--;
      w.code(di, 5);
      w.bits(bestDist - DIST_BASE[di]!, DIST_EXTRA[di]!);
      for (let j = 0; j < bestLen; j++) insert(i + j);
      i += bestLen;
    } else {
      lit(w, data[i]!);
      insert(i);
      i++;
    }
  }
  lit(w, 256);
  return w.finish();
}

// ─────────────────────────────────────────────── a digest of a whole world ──

/** A canonical text of everything saved in a world, for pinning what an old link must decode to. */
export function worldText(w: World): string {
  const parts: string[] = [`seed ${w.seed}`, `gen ${w.terrainGen ?? 1}`, `next ${w.nextSeq}`];
  for (const [c, b] of [...w.blocks].sort((a, b) => a[0] - b[0])) parts.push(`b ${c} ${b.kind} ${b.color} ${b.rot} ${b.seq} ${b.style ?? '-'} ${b.ruin ?? '-'}`);
  for (const [c, k] of [...w.floors].sort((a, b) => a[0] - b[0])) parts.push(`f ${c} ${k}`);
  for (const [e, k] of [...w.edges].sort((a, b) => a[0] - b[0])) parts.push(`e ${e} ${k}`);
  for (const [c, h] of [...(w.terrainEdits ?? new Map<number, number>())].sort((a, b) => a[0] - b[0])) parts.push(`l ${c} ${h}`);
  return parts.join('\n');
}

/** Two FNV-1a hashes of worldText, as hex. */
export function worldDigest(w: World): string {
  const t = worldText(w);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    a = Math.imul(a ^ t.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ t.charCodeAt(i), 0x811c9dc5) ^ (b >>> 15);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
