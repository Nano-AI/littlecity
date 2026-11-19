// FROZEN CONTRACT (Stage 0). Do not edit; see docs/swarm/CONTRACTS.md.
//
// Seeded chance. All randomness in town logic comes from here: same inputs,
// same number, forever, on every machine. Never Math.random.

function mix(h: number, k: number): number {
  // murmur3 32-bit round
  k = Math.imul(k, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  h ^= k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

/** A uint32 hash of a seed and any mix of numbers and strings. Order matters. */
export function hash(seed: number, ...parts: (number | string)[]): number {
  let h = mix(0x9747b28c, seed | 0);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (typeof p === 'number') {
      if (Number.isInteger(p) && p >= -0x80000000 && p <= 0xffffffff) {
        h = mix(h, p | 0);
      } else {
        f64[0] = p;
        h = mix(mix(h, u32[0]! | 0), u32[1]! | 0);
      }
      h = mix(h, 0x6e);
    } else {
      for (let j = 0; j < p.length; j++) h = mix(h, p.charCodeAt(j));
      h = mix(h, 0x73 + p.length);
    }
  }
  return fmix(h ^ parts.length);
}

/** A float in [0, 1). */
export function rand(seed: number, ...parts: (number | string)[]): number {
  return hash(seed, ...parts) / 4294967296;
}

/** A float in [min, max). */
export function randRange(min: number, max: number, seed: number, ...parts: (number | string)[]): number {
  return min + (max - min) * rand(seed, ...parts);
}

/** An integer in [min, max] (both inclusive). */
export function randInt(min: number, max: number, seed: number, ...parts: (number | string)[]): number {
  return min + Math.floor((max - min + 1) * rand(seed, ...parts));
}

/**
 * One item from a list. `weights` (same length, non-negative) biases the
 * choice; null means uniform. Throws on an empty list.
 */
export function pick<T>(
  items: readonly T[],
  weights: readonly number[] | null,
  seed: number,
  ...parts: (number | string)[]
): T {
  if (items.length === 0) throw new Error('pick: empty list');
  const r = rand(seed, ...parts);
  if (!weights) return items[Math.floor(r * items.length)]!;
  let total = 0;
  for (let i = 0; i < items.length; i++) total += Math.max(0, weights[i] ?? 0);
  if (total <= 0) return items[Math.floor(r * items.length)]!;
  let t = r * total;
  for (let i = 0; i < items.length; i++) {
    t -= Math.max(0, weights[i] ?? 0);
    if (t < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** Combine hashes (for content hashes). Order matters. */
export function hashCombine(h: number, ...values: number[]): number {
  let x = h | 0;
  for (let i = 0; i < values.length; i++) x = mix(x, values[i]! | 0);
  return fmix(x);
}

/** Hash of a string alone (for folding ids and type names into content hashes). */
export function hashString(s: string): number {
  return hash(0, s);
}
