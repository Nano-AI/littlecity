// Raw DEFLATE (RFC 1951), synchronous and dependency-free, for the share
// codec. The encoder parses optimally (every match the hash chains find, a
// shortest path under the codes' bit costs, re-costed a few times) and
// writes one dynamic-Huffman, fixed-Huffman or stored block, whichever is
// smallest: about 7% smaller than zlib at level 9 on a town. Until
// 2026-11-20 it wrote fixed Huffman only; those streams still read, since
// the decoder reads all three block types and so accepts any standard
// raw-deflate stream. Both are pure. inflateRaw throws on malformed input;
// callers catch.

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// ───────────────────────────────────────────────────────────── encoder ──

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
  /** A Huffman code, most significant bit first. */
  code(code: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) this.bits((code >>> i) & 1, 1);
  }
  /** Pads to a whole byte. */
  align(): void {
    if (this.n > 0) {
      this.bytes.push(this.acc);
      this.acc = 0;
      this.n = 0;
    }
  }
  finish(): Uint8Array {
    this.align();
    return Uint8Array.from(this.bytes);
  }
}

/** Length 3–258 → its index in LEN_BASE (symbol 257 + index). */
const LEN_INDEX = new Uint8Array(259);
for (let i = 0; i < LEN_BASE.length; i++) for (let l = LEN_BASE[i]!; l < (LEN_BASE[i + 1] ?? 259); l++) LEN_INDEX[l] = i;
/** Distance 1–32768 → its distance symbol (made on first use). */
let DIST_INDEX: Uint8Array | null = null;
function distIndex(d: number): number {
  if (!DIST_INDEX) {
    DIST_INDEX = new Uint8Array(32769);
    for (let i = 0; i < DIST_BASE.length; i++) for (let v = DIST_BASE[i]!; v < (DIST_BASE[i + 1] ?? 32769); v++) DIST_INDEX[v] = i;
  }
  return DIST_INDEX[d]!;
}

const MIN_MATCH = 3;
const MAX_MATCH = 258;
const WINDOW = 32768;
/** Candidates tried per position. Towns are small; this finds nearly every useful match. */
const CHAIN = 512;

/**
 * Every useful match at each position: for position i, entries start[i] to
 * start[i + 1] − 1 of (len, dist), lengths rising, each at the nearest
 * distance that reaches that length.
 */
interface Matches {
  start: Int32Array;
  len: Int32Array;
  dist: Int32Array;
}

function findMatches(data: Uint8Array): Matches {
  const n = data.length;
  const start = new Int32Array(n + 1);
  const lens: number[] = [];
  const dists: number[] = [];
  const head = new Int32Array(1 << 16).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const hash = (i: number): number => ((data[i]! << 8) ^ (data[i + 1]! << 4) ^ data[i + 2]!) & 0xffff;
  for (let i = 0; i < n; i++) {
    start[i] = lens.length;
    if (i + MIN_MATCH > n) continue;
    const h = hash(i);
    const max = Math.min(MAX_MATCH, n - i);
    let best = MIN_MATCH - 1;
    let cand = head[h]!;
    for (let chain = CHAIN; cand >= 0 && i - cand <= WINDOW && chain > 0; chain--, cand = prev[cand]!) {
      if (data[cand + best] !== data[i + best]) continue;
      let len = 0;
      while (len < max && data[cand + len] === data[i + len]) len++;
      if (len > best) {
        best = len;
        lens.push(len);
        dists.push(i - cand);
        if (len === max) break;
      }
    }
    prev[i] = head[h]!;
    head[h] = i;
  }
  start[n] = lens.length;
  return { start, len: Int32Array.from(lens), dist: Int32Array.from(dists) };
}

/** A parse: per step, a literal (len 1, dist 0) or a match. */
interface Parse {
  len: number[];
  dist: number[];
}

/** Bit costs: literals by byte, matches by length and by distance symbol, extra bits included. */
interface Costs {
  lit: Float64Array;
  len: Float64Array;
  dist: Float64Array;
}

function costsFrom(litLens: ArrayLike<number>, distLens: ArrayLike<number>, missing: number): Costs {
  const c = (l: number): number => (l > 0 ? l : missing);
  const lit = new Float64Array(256);
  for (let s = 0; s < 256; s++) lit[s] = c(litLens[s]!);
  const len = new Float64Array(MAX_MATCH + 1);
  for (let l = MIN_MATCH; l <= MAX_MATCH; l++) len[l] = c(litLens[257 + LEN_INDEX[l]!]!) + LEN_EXTRA[LEN_INDEX[l]!]!;
  const dist = new Float64Array(30);
  for (let d = 0; d < 30; d++) dist[d] = c(distLens[d]!) + DIST_EXTRA[d]!;
  return { lit, len, dist };
}

/** The cheapest parse under these costs (a shortest path over positions). */
function optimalParse(data: Uint8Array, m: Matches, costs: Costs): Parse {
  const n = data.length;
  const cost = new Float64Array(n + 1).fill(Infinity);
  const stepLen = new Int32Array(n + 1);
  const stepDist = new Int32Array(n + 1);
  cost[0] = 0;
  for (let i = 0; i < n; i++) {
    const here = cost[i]!;
    const lit = here + costs.lit[data[i]!]!;
    if (lit < cost[i + 1]!) {
      cost[i + 1] = lit;
      stepLen[i + 1] = 1;
      stepDist[i + 1] = 0;
    }
    let from = MIN_MATCH;
    for (let k = m.start[i]!; k < m.start[i + 1]!; k++) {
      const to = m.len[k]!;
      const d = m.dist[k]!;
      const dc = here + costs.dist[distIndex(d)]!;
      for (let l = from; l <= to; l++) {
        const c = dc + costs.len[l]!;
        if (c < cost[i + l]!) {
          cost[i + l] = c;
          stepLen[i + l] = l;
          stepDist[i + l] = d;
        }
      }
      from = to + 1;
    }
  }
  const len: number[] = [];
  const dist: number[] = [];
  for (let at = n; at > 0; at -= stepLen[at]!) {
    len.push(stepLen[at]!);
    dist.push(stepDist[at]!);
  }
  len.reverse();
  dist.reverse();
  return { len, dist };
}

/** Symbol counts of a parse (end of block included). */
function symbolCounts(data: Uint8Array, p: Parse): { lit: Uint32Array; dist: Uint32Array } {
  const lit = new Uint32Array(286);
  const dist = new Uint32Array(30);
  let at = 0;
  for (let i = 0; i < p.len.length; i++) {
    const l = p.len[i]!;
    if (l === 1) lit[data[at]!]!++;
    else {
      lit[257 + LEN_INDEX[l]!]!++;
      dist[distIndex(p.dist[i]!)]!++;
    }
    at += l;
  }
  lit[256]!++;
  return { lit, dist };
}

/** Huffman code lengths for these counts, none longer than `limit`, at least two codes (so the code is complete). */
function huffmanLengths(freqs: ArrayLike<number>, limit: number): Uint8Array {
  const out = new Uint8Array(freqs.length);
  const used: number[] = [];
  for (let s = 0; s < freqs.length; s++) if (freqs[s]! > 0) used.push(s);
  // One symbol or none still gets a complete two-code tree (a spare code nobody uses).
  for (let s = 0; used.length < 2; s++) if (!used.includes(s)) used.push(s);
  used.sort((a, b) => freqs[a]! - freqs[b]! || a - b);
  // Package-merge (Larmore and Hirschberg): optimal lengths under the limit.
  // An item is a weight and the leaves under it; at most a few thousand
  // leaf entries in all for these alphabets.
  type Item = { w: number; leaves: number[] };
  const leaves: Item[] = used.map((s) => ({ w: freqs[s]!, leaves: [s] }));
  let row = leaves;
  for (let level = 1; level < limit; level++) {
    const packages: Item[] = [];
    for (let i = 0; i + 1 < row.length; i += 2) packages.push({ w: row[i]!.w + row[i + 1]!.w, leaves: row[i]!.leaves.concat(row[i + 1]!.leaves) });
    const merged: Item[] = [];
    let a = 0;
    let b = 0;
    while (a < leaves.length || b < packages.length) {
      if (b >= packages.length || (a < leaves.length && leaves[a]!.w <= packages[b]!.w)) merged.push(leaves[a++]!);
      else merged.push(packages[b++]!);
    }
    row = merged;
  }
  for (let i = 0; i < 2 * used.length - 2; i++) for (const s of row[i]!.leaves) out[s]!++;
  return out;
}

/** Canonical codes for these lengths (RFC 1951 3.2.2). */
function canonicalCodes(lengths: ArrayLike<number>): Uint16Array {
  const blCount = new Uint16Array(16);
  for (let i = 0; i < lengths.length; i++) if (lengths[i]) blCount[lengths[i]!]!++;
  const next = new Uint16Array(16);
  let code = 0;
  for (let bits = 1; bits < 16; bits++) {
    code = (code + blCount[bits - 1]!) << 1;
    next[bits] = code;
  }
  const out = new Uint16Array(lengths.length);
  for (let i = 0; i < lengths.length; i++) if (lengths[i]) out[i] = next[lengths[i]!]!++;
  return out;
}

/** The literal and distance code lengths in the code-length alphabet: [symbol, extra bits] pairs. */
function runLengths(lens: Uint8Array): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < lens.length; ) {
    const v = lens[i]!;
    let run = 1;
    while (i + run < lens.length && lens[i + run] === v) run++;
    i += run;
    if (v === 0) {
      while (run >= 11) {
        const r = Math.min(run, 138);
        out.push([18, r - 11]);
        run -= r;
      }
      if (run >= 3) {
        out.push([17, run - 3]);
        run = 0;
      }
    } else {
      out.push([v, 0]);
      run--;
      while (run >= 3) {
        const r = Math.min(run, 6);
        out.push([16, r - 3]);
        run -= r;
      }
    }
    for (; run > 0; run--) out.push([v, 0]);
  }
  return out;
}

/** Extra bits of code-length symbols 16, 17, 18. */
const CL_EXTRA = [2, 3, 7];

/** A dynamic block for a parse: its codes, its header, and its size in bits. */
interface Dynamic {
  lit: Uint8Array;
  dist: Uint8Array;
  hlit: number;
  hdist: number;
  hclen: number;
  rle: [number, number][];
  cl: Uint8Array;
  bits: number;
}

function planDynamic(data: Uint8Array, p: Parse): Dynamic {
  const f = symbolCounts(data, p);
  const lit = huffmanLengths(f.lit, 15);
  const dist = huffmanLengths(f.dist, 15);
  let hlit = 286;
  while (hlit > 257 && lit[hlit - 1] === 0) hlit--;
  let hdist = 30;
  while (hdist > 1 && dist[hdist - 1] === 0) hdist--;
  const all = new Uint8Array(hlit + hdist);
  all.set(lit.subarray(0, hlit));
  all.set(dist.subarray(0, hdist), hlit);
  const rle = runLengths(all);
  const clFreq = new Uint32Array(19);
  for (const [s] of rle) clFreq[s]!++;
  const cl = huffmanLengths(clFreq, 7);
  let hclen = 19;
  while (hclen > 4 && cl[CL_ORDER[hclen - 1]!] === 0) hclen--;
  let bits = 3 + 5 + 5 + 4 + 3 * hclen;
  for (const [s] of rle) bits += cl[s]! + (s >= 16 ? CL_EXTRA[s - 16]! : 0);
  for (let s = 0; s < 286; s++) bits += f.lit[s]! * (lit[s]! + (s >= 257 ? LEN_EXTRA[s - 257]! : 0));
  for (let d = 0; d < 30; d++) bits += f.dist[d]! * (dist[d]! + DIST_EXTRA[d]!);
  return { lit, dist, hlit, hdist, hclen, rle, cl, bits };
}

let FIXED_LENS: [Uint8Array, Uint8Array] | null = null;
function fixedLengths(): [Uint8Array, Uint8Array] {
  if (!FIXED_LENS) {
    const l = new Uint8Array(288);
    l.fill(8, 0, 144);
    l.fill(9, 144, 256);
    l.fill(7, 256, 280);
    l.fill(8, 280, 288);
    FIXED_LENS = [l, new Uint8Array(30).fill(5)];
  }
  return FIXED_LENS;
}

function fixedBits(data: Uint8Array, p: Parse): number {
  const [lit, dist] = fixedLengths();
  const f = symbolCounts(data, p);
  let bits = 3;
  for (let s = 0; s < 286; s++) bits += f.lit[s]! * (lit[s]! + (s >= 257 ? LEN_EXTRA[s - 257]! : 0));
  for (let d = 0; d < 30; d++) bits += f.dist[d]! * (dist[d]! + DIST_EXTRA[d]!);
  return bits;
}

function writeSymbols(w: BitWriter, data: Uint8Array, p: Parse, litLens: Uint8Array, distLens: Uint8Array): void {
  const litCodes = canonicalCodes(litLens);
  const distCodes = canonicalCodes(distLens);
  let at = 0;
  for (let i = 0; i < p.len.length; i++) {
    const l = p.len[i]!;
    if (l === 1) w.code(litCodes[data[at]!]!, litLens[data[at]!]!);
    else {
      const li = LEN_INDEX[l]!;
      w.code(litCodes[257 + li]!, litLens[257 + li]!);
      w.bits(l - LEN_BASE[li]!, LEN_EXTRA[li]!);
      const d = p.dist[i]!;
      const di = distIndex(d);
      w.code(distCodes[di]!, distLens[di]!);
      w.bits(d - DIST_BASE[di]!, DIST_EXTRA[di]!);
    }
    at += l;
  }
  w.code(litCodes[256]!, litLens[256]!);
}

/** Rounds of re-costing; gains stop after a handful. */
const ROUNDS = 8;

/**
 * Compresses bytes into one raw deflate block: dynamic Huffman, fixed Huffman
 * or stored, whichever is smallest. Deterministic: the same bytes always make
 * the same stream.
 */
export function deflateRaw(data: Uint8Array): Uint8Array {
  const m = findMatches(data);
  // Start from the fixed code's costs, then re-cost from each parse's own code.
  const [fixLit, fixDist] = fixedLengths();
  const fixedParse = optimalParse(data, m, costsFrom(fixLit, fixDist, 9));
  let best = fixedParse;
  let plan = planDynamic(data, best);
  let last = plan;
  for (let round = 0; round < ROUNDS; round++) {
    const missing = Math.log2(Math.max(2, data.length)) + 1;
    const next = optimalParse(data, m, costsFrom(last.lit, last.dist, missing));
    const nextPlan = planDynamic(data, next);
    if (nextPlan.bits >= last.bits && nextPlan.bits >= plan.bits) break;
    last = nextPlan;
    if (nextPlan.bits < plan.bits) {
      best = next;
      plan = nextPlan;
    }
  }
  const fixed = fixedBits(data, fixedParse);
  const stored = 3 + 7 + 32 + 8 * data.length; // with the worst alignment; one block holds 65,535 bytes
  const w = new BitWriter();
  w.bits(1, 1); // the final (only) block
  if (data.length <= 0xffff && stored < plan.bits && stored < fixed) {
    w.bits(0, 2); // stored
    w.align();
    w.bits(data.length, 16);
    w.bits(data.length ^ 0xffff, 16);
    for (let i = 0; i < data.length; i++) w.bits(data[i]!, 8);
    return w.finish();
  }
  if (fixed <= plan.bits) {
    w.bits(1, 2); // fixed Huffman
    writeSymbols(w, data, fixedParse, fixLit, fixDist);
    return w.finish();
  }
  w.bits(2, 2); // dynamic Huffman
  w.bits(plan.hlit - 257, 5);
  w.bits(plan.hdist - 1, 5);
  w.bits(plan.hclen - 4, 4);
  for (let i = 0; i < plan.hclen; i++) w.bits(plan.cl[CL_ORDER[i]!]!, 3);
  const clCodes = canonicalCodes(plan.cl);
  for (const [s, extra] of plan.rle) {
    w.code(clCodes[s]!, plan.cl[s]!);
    if (s >= 16) w.bits(extra, CL_EXTRA[s - 16]!);
  }
  writeSymbols(w, data, best, plan.lit, plan.dist);
  return w.finish();
}

// ───────────────────────────────────────────────────────────── decoder ──

interface Huffman {
  counts: Uint16Array;
  symbols: Uint16Array;
}

function buildHuffman(lengths: ArrayLike<number>): Huffman {
  const counts = new Uint16Array(16);
  for (let i = 0; i < lengths.length; i++) counts[lengths[i]!]!++;
  counts[0] = 0;
  let left = 1;
  for (let len = 1; len < 16; len++) {
    left = (left << 1) - counts[len]!;
    if (left < 0) throw new Error('deflate: over-subscribed code');
  }
  const offs = new Uint16Array(16);
  for (let len = 1; len < 15; len++) offs[len + 1] = offs[len]! + counts[len]!;
  const symbols = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) symbols[offs[lengths[s]!]!++] = s;
  return { counts, symbols };
}

let FIXED_LIT: Huffman | null = null;
let FIXED_DIST: Huffman | null = null;
function fixedTables(): [Huffman, Huffman] {
  if (!FIXED_LIT) {
    const l = new Uint8Array(288);
    l.fill(8, 0, 144);
    l.fill(9, 144, 256);
    l.fill(7, 256, 280);
    l.fill(8, 280, 288);
    FIXED_LIT = buildHuffman(l);
    FIXED_DIST = buildHuffman(new Uint8Array(30).fill(5));
  }
  return [FIXED_LIT, FIXED_DIST!];
}

/**
 * Decompresses a raw deflate stream. Throws on anything malformed; output is
 * capped at `maxOut` bytes. With `exact`, bytes left over after the final
 * block are an error too.
 */
export function inflateRaw(src: Uint8Array, maxOut = 1 << 22, exact = false): Uint8Array {
  let pos = 0;
  let bitBuf = 0;
  let bitCnt = 0;
  let out = new Uint8Array(Math.max(1024, src.length * 4));
  let outLen = 0;
  const need = (n: number): number => {
    while (bitCnt < n) {
      if (pos >= src.length) throw new Error('deflate: unexpected end of data');
      bitBuf |= src[pos++]! << bitCnt;
      bitCnt += 8;
    }
    const v = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCnt -= n;
    return v;
  };
  const push = (b: number): void => {
    if (outLen >= out.length) {
      if (out.length >= maxOut) throw new Error('deflate: output too large');
      const bigger = new Uint8Array(Math.min(maxOut, out.length * 2));
      bigger.set(out);
      out = bigger;
    }
    out[outLen++] = b;
  };
  const decode = (h: Huffman): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= need(1);
      const count = h.counts[len]!;
      if (code - count < first) return h.symbols[index + (code - first)]!;
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('deflate: bad code');
  };

  let final: number;
  do {
    final = need(1);
    const type = need(2);
    if (type === 0) {
      bitBuf = 0;
      bitCnt = 0;
      if (pos + 4 > src.length) throw new Error('deflate: unexpected end of data');
      const len = src[pos]! | (src[pos + 1]! << 8);
      const nlen = src[pos + 2]! | (src[pos + 3]! << 8);
      pos += 4;
      if ((len ^ 0xffff) !== nlen) throw new Error('deflate: bad stored block');
      if (pos + len > src.length) throw new Error('deflate: unexpected end of data');
      for (let i = 0; i < len; i++) push(src[pos++]!);
      continue;
    }
    let lit: Huffman;
    let dist: Huffman;
    if (type === 1) [lit, dist] = fixedTables();
    else if (type === 2) {
      const hlit = need(5) + 257;
      const hdist = need(5) + 1;
      const hclen = need(4) + 4;
      const clLens = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) clLens[CL_ORDER[i]!] = need(3);
      const cl = buildHuffman(clLens);
      const lens = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist; ) {
        const sym = decode(cl);
        if (sym < 16) lens[i++] = sym;
        else {
          let rep: number;
          let val = 0;
          if (sym === 16) {
            if (i === 0) throw new Error('deflate: repeat with no previous length');
            val = lens[i - 1]!;
            rep = 3 + need(2);
          } else if (sym === 17) rep = 3 + need(3);
          else rep = 11 + need(7);
          if (i + rep > hlit + hdist) throw new Error('deflate: too many lengths');
          while (rep--) lens[i++] = val;
        }
      }
      lit = buildHuffman(lens.subarray(0, hlit));
      dist = buildHuffman(lens.subarray(hlit));
    } else throw new Error('deflate: bad block type');

    for (;;) {
      const sym = decode(lit);
      if (sym < 256) push(sym);
      else if (sym === 256) break;
      else {
        const li = sym - 257;
        if (li >= 29) throw new Error('deflate: bad length');
        const len = LEN_BASE[li]! + need(LEN_EXTRA[li]!);
        const di = decode(dist);
        if (di >= 30) throw new Error('deflate: bad distance');
        const d = DIST_BASE[di]! + need(DIST_EXTRA[di]!);
        if (d > outLen) throw new Error('deflate: distance too far back');
        for (let k = 0; k < len; k++) push(out[outLen - d]!);
      }
    }
  } while (!final);
  if (exact && pos !== src.length) throw new Error('deflate: trailing data');
  return out.slice(0, outLen);
}

// ──────────────────────────────────────────────────────────── base64url ──

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) s += B64[(n >> 6) & 63]!;
    if (i + 2 < bytes.length) s += B64[n & 63]!;
  }
  return s;
}

/** Null if the string is not base64url (padding and whitespace are tolerated). */
export function fromBase64Url(s: string): Uint8Array | null {
  const clean = s.replace(/[\s=]+/g, '');
  if (clean.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    let v = c < 128 ? B64_INDEX[c]! : -1;
    if (v < 0 && (c === 43 || c === 47)) v = c === 43 ? 62 : 63; // tolerate standard base64
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}
