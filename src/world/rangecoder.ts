// An adaptive binary range coder (the LZMA kind), synchronous and
// dependency-free, for the share codec's version 5 (save.ts). Every decision
// is one bit coded under a context: a slot in a table of probabilities that
// learns as the town is read, quickly at first (1 / (n + 1.5) after n uses)
// and then at a steady 1/16. The encoder and decoder share one Coder
// interface, so the town layout is written once and runs both ways: an
// encoding coder writes the bit it is given and returns it, a decoding coder
// ignores it and returns the bit it reads. Pure and deterministic (integer
// probabilities; the rates are exact doubles).
//
// The decoder reads zero bytes past the end of its input (the encoder trims
// trailing zeros), so it never runs out; whoever drives it bounds every loop
// and checks the result (save.ts checksums the bytes). A number whose length
// prefix runs too long throws. Callers catch.

/** Probability of a 1, 16-bit; kept clear of 0 and 1. */
const P_MIN = 64;
const P_MAX = 65536 - 64;
const RATE: number[] = Array.from({ length: 256 }, (_, n) => 1 / Math.max(n + 1.5, 16));

export interface Coder {
  /** Codes `bit` (encoding) or reads one (decoding) under context `ctx`; returns the bit. */
  bit(ctx: number, bit: number): number;
}

class Contexts {
  readonly p: Uint16Array;
  readonly n: Uint8Array;
  constructor(size: number) {
    this.p = new Uint16Array(size).fill(32768);
    this.n = new Uint8Array(size);
  }
  /** P(0) in 12 bits, for the coder. */
  p0(ctx: number): number {
    return 4096 - (this.p[ctx]! >>> 4);
  }
  update(ctx: number, bit: number): void {
    const p = this.p[ctx]!;
    const n = this.n[ctx]!;
    const next = p + Math.trunc(((bit ? 65536 : 0) - p) * RATE[n]!);
    this.p[ctx] = Math.min(P_MAX, Math.max(P_MIN, next));
    if (n < 255) this.n[ctx] = n + 1;
  }
}

export class RangeEncoder implements Coder {
  private low = 0;
  private range = 0xffffffff;
  private cache = 0;
  private cacheSize = 1;
  private readonly out: number[] = [];
  private readonly ctx: Contexts;
  constructor(contexts: number) {
    this.ctx = new Contexts(contexts);
  }
  bit(ctx: number, bit: number): number {
    const b = bit ? 1 : 0;
    const bound = (this.range >>> 12) * this.ctx.p0(ctx);
    if (b === 0) this.range = bound;
    else {
      this.low += bound;
      this.range -= bound;
    }
    this.ctx.update(ctx, b);
    while (this.range < 0x1000000) {
      this.range = (this.range * 256) >>> 0;
      this.shiftLow();
    }
    return b;
  }
  private shiftLow(): void {
    if (this.low < 0xff000000 || this.low >= 0x100000000) {
      const carry = this.low >= 0x100000000 ? 1 : 0;
      let temp = this.cache;
      do {
        this.out.push((temp + carry) & 0xff);
        temp = 0xff;
      } while (--this.cacheSize !== 0);
      this.cache = (this.low >>> 24) & 0xff;
    }
    this.cacheSize++;
    this.low = (this.low % 0x1000000) * 256;
  }
  /** The coded bytes: the always-zero first byte dropped, trailing zeros trimmed. */
  finish(): Uint8Array {
    // End on the value in [low, low + range) with the most trailing zero bits, so the tail trims away.
    for (let k = 32; k >= 0; k--) {
      const unit = 2 ** k;
      const v = Math.ceil(this.low / unit) * unit;
      if (v < this.low + this.range) {
        this.low = v;
        break;
      }
    }
    for (let i = 0; i < 5; i++) this.shiftLow();
    let end = this.out.length;
    while (end > 1 && this.out[end - 1] === 0) end--;
    return Uint8Array.from(this.out.slice(1, end));
  }
}

export class RangeDecoder implements Coder {
  private code = 0;
  private range = 0xffffffff;
  private pos = 0;
  private readonly ctx: Contexts;
  constructor(private readonly src: Uint8Array, contexts: number) {
    this.ctx = new Contexts(contexts);
    // The encoder's first byte is always zero and is not sent.
    for (let i = 0; i < 4; i++) this.code = ((this.code << 8) | this.next()) >>> 0;
  }
  /** Past the end, zeros (the encoder trimmed them). Every loop that reads is bounded, so this ends. */
  private next(): number {
    return this.pos < this.src.length ? this.src[this.pos++]! : 0;
  }
  bit(ctx: number, _bit: number): number {
    const bound = (this.range >>> 12) * this.ctx.p0(ctx);
    let b: number;
    if (this.code < bound) {
      this.range = bound;
      b = 0;
    } else {
      this.code -= bound;
      this.range -= bound;
      b = 1;
    }
    this.ctx.update(ctx, b);
    while (this.range < 0x1000000) {
      this.range = (this.range * 256) >>> 0;
      this.code = ((this.code * 256) + this.next()) >>> 0;
    }
    return b;
  }
}

// ─────────────────────────────────────────────── numbers made of bits ──

/** Contexts used by uint(): unary length prefix, then the mantissa's top two bits per length, then the rest. */
export const UINT_CONTEXTS = 32 + 32 * 3;
/** Contexts used by sint(). */
export const SINT_CONTEXTS = 2 + 2 * UINT_CONTEXTS;
/** Longest length prefix: values up to 2^31 − 2. */
const MAX_BITS = 31;

/** An unsigned integer: Elias-gamma shaped, every bit adaptive. */
export function uint(c: Coder, ctx: number, v: number): number {
  const x = v + 1;
  let n = 0;
  while (n < MAX_BITS && x >= 2 ** (n + 1)) n++;
  // Unary length.
  let len = 0;
  while (c.bit(ctx + len, len < n ? 1 : 0)) {
    len++;
    if (len >= MAX_BITS) throw new RangeError('number too long');
  }
  // Mantissa below the leading one, most significant first.
  let out = 1;
  for (let i = len - 1; i >= 0; i--) {
    const slot = len - 1 - i < 2 ? len - 1 - i : 2;
    out = out * 2 + c.bit(ctx + 32 + len * 3 + slot, Math.floor(x / 2 ** i) & 1);
  }
  return out - 1;
}

/** A signed integer: zero?, sign, then the magnitude less one (separate statistics per sign). */
export function sint(c: Coder, ctx: number, v: number): number {
  if (c.bit(ctx, v === 0 ? 1 : 0)) return 0;
  const neg = c.bit(ctx + 1, v < 0 ? 1 : 0);
  const m = uint(c, ctx + 2 + neg * UINT_CONTEXTS, Math.abs(v) - 1) + 1;
  return neg ? -m : m;
}

/** Contexts used by sym() for `bits` bits. */
export const symContexts = (bits: number): number => 1 << bits;

/** A `bits`-bit symbol down a binary tree, each node its own context. */
export function sym(c: Coder, ctx: number, v: number, bits: number): number {
  let node = 1;
  for (let i = bits - 1; i >= 0; i--) node = node * 2 + c.bit(ctx + node, (v >> i) & 1);
  return node - (1 << bits);
}
