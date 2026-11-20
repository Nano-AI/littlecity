// Every placed kind, floor kind and edge kind, its code pinned (test diet, docs/swarm/test-diet.md).
// The share format numbers kinds by their place in a list that may only grow at the end. The other
// pinned codes (land-save, house-style) hold houses, docks, paths and trees only, so swapping two other
// kinds in that list (a tower saved as a lighthouse) passed every test. This town has one of each.

import { expect, test } from 'vitest';
import { edgeKey, key, type CellKey, type EdgeKey } from '@/core/grid';
import { ALL_KINDS, FLOOR_KINDS, type EdgeKind, type FloorKind, type PlacedKind } from '@/core/kinds';
import type { Block, World } from '@/core/world';
import { legacyEncodeTown } from './legacy-codec';
import { decodeTown, encodeTown } from './save';
import { emptyWorld } from './world';

/** Written by the codec at b83d78b (version 1: no styles, generator 1, no reshaped land). */
const PINNED = 'TEMBcfJT_5skwMAgwM_AwcTDwMDCwCAIIpRAhDGIcAERoSAiDUSUgwgOZhApyaDMxKAFYlmDCB8QEQsi8pjbtRgYGRmZmKZGMLAyAgA';

// The kinds that existed when the code was pinned. Kinds added since (the playing field, …) must go
// on the END of their lists, so these counts never change and the pinned code never moves.
const PINNED_KINDS = 14;
const PINNED_FLOORS = 3;

function everyKind(kinds: readonly PlacedKind[] = ALL_KINDS.slice(0, PINNED_KINDS), floorKinds: readonly FloorKind[] = FLOOR_KINDS.slice(0, PINNED_FLOORS)): World {
  const blocks = new Map<CellKey, Block>();
  const placed: PlacedKind[] = ['auto', ...kinds];
  let seq = 1;
  // Only stairs keep a rotation in the format.
  placed.forEach((kind, i) => blocks.set(key(4 + 2 * (i % 10), 1 + Math.floor(i / 10), 6), { kind, color: i % 8, rot: kind === 'stairs' ? 3 : 0, seq: seq++ }));
  const floors = new Map<CellKey, FloorKind>(floorKinds.map((floor, i) => [key(6 + i, 1, 20), floor]));
  const edges = new Map<EdgeKey, EdgeKind>([[edgeKey(10, 1, 24, 'E'), 'fence'], [edgeKey(12, 1, 24, 'S'), 'wall']]);
  return { ...emptyWorld(4242), blocks, floors, edges, nextSeq: seq };
}

test('a town with one of every kind: the old encoder wrote the pinned code, it decodes to that town, and so does today\'s code', () => {
  const w = everyKind();
  expect(w.blocks.size).toBe(PINNED_KINDS + 1);
  expect(FLOOR_KINDS.slice(0, PINNED_FLOORS)).toEqual(['path', 'plaza', 'garden']);
  expect(legacyEncodeTown(w)).toBe(PINNED);
  expect(decodeTown(PINNED)).toEqual({ ok: true, world: w });
  expect(decodeTown(encodeTown(w))).toEqual({ ok: true, world: w });
});

test('kinds added since the pin round-trip too', () => {
  const w = everyKind(ALL_KINDS, FLOOR_KINDS);
  const code = encodeTown(w);
  expect(decodeTown(code)).toEqual({ ok: true, world: w });
});
