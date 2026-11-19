// Raw DEFLATE (RFC 1951), synchronous and dependency-free, for the share
// codec. The encoder uses LZ77 with a hash chain and the fixed Huffman
// codes, which is plenty for a few kilobytes of town. The decoder reads all
// three block types, so it accepts any standard raw-deflate stream. Both are
// pure. inflateRaw throws on malformed input; callers catch.

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
  finish(): Uint8Array {
    if (this.n > 0) this.bytes.push(this.acc);
    return Uint8Array.from(this.bytes);
  }
}

function writeFixedLiteral(w: BitWriter, sym: number): void {
  if (sym < 144) w.code(0x30 + sym, 8);
  else if (sym < 256) w.code(0x190 + sym - 144, 9);
  else if (sym < 280) w.code(sym - 256, 7);
  else w.code(0xc0 + sym - 280, 8);
}

function writeLength(w: BitWriter, len: number): void {
  let i = LEN_BASE.length - 1;
  while (LEN_BASE[i]! > len) i--;
  writeFixedLiteral(w, 257 + i);
  w.bits(len - LEN_BASE[i]!, LEN_EXTRA[i]!);
}

function writeDistance(w: BitWriter, dist: number): void {
  let i = DIST_BASE.length - 1;
  while (DIST_BASE[i]! > dist) i--;
  w.code(i, 5);
  w.bits(dist - DIST_BASE[i]!, DIST_EXTRA[i]!);
}

/** Compresses bytes into one fixed-Huffman deflate block. */
export function deflateRaw(data: Uint8Array): Uint8Array {
  const w = new BitWriter();
  w.bits(1, 1); // final block
  w.bits(1, 2); // fixed Huffman
  const WINDOW = 32768;
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
      while (cand >= 0 && i - cand <= WINDOW && chain-- > 0) {
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
      writeLength(w, bestLen);
      writeDistance(w, bestDist);
      for (let j = 0; j < bestLen; j++) insert(i + j);
      i += bestLen;
    } else {
      writeFixedLiteral(w, data[i]!);
      insert(i);
      i++;
    }
  }
  writeFixedLiteral(w, 256);
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
