// Small helpers shared by the decoration and urban-fill rules.

import { columnIndex, DIR4, inColumnBounds, key, keyX, keyY, keyZ, type CellKey, type Dir4 } from '@/core/grid';
import { hash, rand } from '@/core/rand';
import type { Facts } from '@/resolve/facts/api';
import type { Structure } from '@/resolve/plan';

/**
 * The seeded chance roll for one candidate, read from a LIVE style value.
 * The engine's own `chance` field is fixed when the rule is defined; rolling
 * here instead lets the tuning panel change a density and see it. The roll
 * depends only on the town seed, the rule and the candidate's own cell and
 * key, so building somewhere else never changes it.
 */
export function lucky(seed: number, rule: string, anchor: CellKey, k: string | number, p: number): boolean {
  return rand(seed, rule, anchor, k) < p;
}

/** A seeded whole number in [0, n) for a candidate. */
export function choose(seed: number, rule: string, anchor: CellKey, k: string | number, n: number): number {
  return hash(seed, rule, anchor, k) % Math.max(1, n);
}

/** Terrain height of a column (0 off the map). */
export function heightAt(f: Facts, x: number, z: number): number {
  return inColumnBounds(x, z) ? f.terrain.height[columnIndex(x, z)]! : 0;
}

/** The ground cell of the column next to `cell` on side `d` (the cell on its terrain top), or -1 off the map or on water. */
export function groundBeside(f: Facts, cell: CellKey, d: Dir4): CellKey {
  const x = keyX(cell) + DIR4[d]![0], z = keyZ(cell) + DIR4[d]![1];
  const h = heightAt(f, x, z);
  return h > 0 ? key(x, h, z) : -1;
}

/** True if the cell lies on the terrain top of its column. */
export function onGround(f: Facts, cell: CellKey): boolean {
  return keyY(cell) === heightAt(f, keyX(cell), keyZ(cell));
}

/** Column (Manhattan) distance between two cells. */
export function columnSteps(a: CellKey, b: CellKey): number {
  return Math.abs(keyX(a) - keyX(b)) + Math.abs(keyZ(a) - keyZ(b));
}

/**
 * The colour every flag, banner and bunting of one town shares: an index into the cloth colours
 * (src/parts/props/kit.ts, clothColors). Never the green: a green flag is lost against the grass.
 */
export function townColor(seed: number): number {
  const strong = [0, 2, 3, 4, 6, 0, 3];
  return strong[hash(seed, 'town-colour') % strong.length]!;
}

/** The lowest level a structure occupies. */
export function baseLevel(s: Structure): number {
  let y = 99;
  for (const c of s.cells) y = Math.min(y, keyY(c));
  return y;
}
