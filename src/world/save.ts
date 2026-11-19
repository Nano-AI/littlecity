// STUB (Stage 0). Owner: Logic (Stage 1). Final signatures.
//
// Share codec and autosave. The stub codec is JSON in base64url; the Logic
// owner replaces it with the packed binary format (design section 15) and
// makes decode reject garbage, truncation and other versions with a plain
// reason (plan Review Focus 2). Neither function may throw.

import type { Block, World } from '@/core/world';
import type { EdgeKind, FloorKind } from '@/core/kinds';

export type DecodeResult = { ok: true; world: World } | { ok: false; reason: string };

interface Packed {
  v: 1;
  seed: number;
  nextSeq: number;
  blocks: [number, Block][];
  floors: [number, FloorKind][];
  edges: [number, EdgeKind][];
}

/** A URL-safe string holding the whole town. */
export function encodeTown(w: World): string {
  const packed: Packed = {
    v: 1,
    seed: w.seed,
    nextSeq: w.nextSeq,
    blocks: [...w.blocks],
    floors: [...w.floors],
    edges: [...w.edges],
  };
  const json = JSON.stringify(packed);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Never throws: a bad code comes back as { ok: false, reason }. */
export function decodeTown(code: string): DecodeResult {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const packed = JSON.parse(decodeURIComponent(escape(atob(b64)))) as Packed;
    if (!packed || packed.v !== 1) return { ok: false, reason: 'This town is from a different version.' };
    return {
      ok: true,
      world: {
        version: 1,
        seed: packed.seed,
        nextSeq: packed.nextSeq,
        blocks: new Map(packed.blocks),
        floors: new Map(packed.floors),
        edges: new Map(packed.edges),
      },
    };
  } catch {
    return { ok: false, reason: 'This town link could not be read.' };
  }
}

/** The slice of Storage that autosave needs; pass window.localStorage, or a fake in tests. */
export interface TownStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'little-city.town.v1';

/** Returns false (and never throws) if storage is unavailable or full (plan Review Focus 5). */
export function saveTown(storage: TownStorage | null | undefined, w: World): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, encodeTown(w));
    return true;
  } catch {
    return false;
  }
}

/** The saved town, or null if there is none or it cannot be read. Never throws. */
export function loadTown(storage: TownStorage | null | undefined): World | null {
  try {
    const code = storage?.getItem(SAVE_KEY);
    if (!code) return null;
    const result = decodeTown(code);
    return result.ok ? result.world : null;
  } catch {
    return null;
  }
}
