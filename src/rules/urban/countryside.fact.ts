// Countryside: the street cells out in the country, with nothing built facing
// them (FX-04, UF-04). A fact because D01 street lamps, which run in the
// decoration stage, must leave these cells dark, and U13 country lanes, in
// the urban stage, dresses them instead.
//
// A street cell is in town when, within FRONTAGE column steps, there is a
// building (a house, tower, lighthouse, marble or Auto block: not a windmill
// out in its wheat), a plaza, a village green (U15), a stall or a fountain; or within APPROACH steps
// a dock or an arch (the way onto a pier or a bridge stays lit). The other
// street cells on the ground are out of town; where RUN_MIN or more of them
// run on connected along one street, that run is a country lane and its
// cells are country. A shorter stretch (the last cells of a village street,
// a few cells between two hamlets) stays in town. A lane leads out of town:
// a street with no cell in town at all (a path laid alone in a field) is not
// one, and with no building anywhere there is no town to be out of; both
// keep their lamps (a first path still gets them, as the guide promises).
//
// Stability: a cell's answer depends on what stands within FRONTAGE of it
// and on the out-of-town cells connected to it along its street.

import { keyX, keyZ, SIZE_X, SIZE_Z, type CellKey } from '@/core/grid';
import { KINDS } from '@/core/kinds';
import { defineFact } from '@/resolve/facts/api';
import { columnDistance, NONE } from '@/resolve/facts/lib';
import { streets, type Street } from '@/resolve/facts/streets.fact';
import { onGround } from '../decoration/lib';
import { landUse } from './land-use.fact';

/** Column steps within which a building or a square makes a street cell part of the town. */
export const FRONTAGE = 3;
/** Column steps within which a dock or an arch keeps a street cell lit. */
export const APPROACH = 2;
/** The fewest connected country cells that make a lane worth dressing. */
export const RUN_MIN = 4;

export interface CountryRun {
  street: Street;
  /** Ascending. */
  cells: readonly CellKey[];
}

export interface Countryside {
  /** True for a cell of a country lane: a street cell on the ground in a run of RUN_MIN or more with nothing built near. */
  isCountry(cell: CellKey): boolean;
  /** Runs of RUN_MIN or more connected country cells. */
  runs: readonly CountryRun[];
  /** Steps from a column to the nearest building, square, stall or fountain (NONE far away). */
  frontage(x: number, z: number): number;
}

export const countryside = defineFact<Countryside>('countryside', (f) => {
  const built = new Uint8Array(SIZE_X * SIZE_Z);
  const approach = new Uint8Array(SIZE_X * SIZE_Z);
  for (const [cell, kind] of f.kinds) {
    const i = keyX(cell) + keyZ(cell) * SIZE_X;
    if ((KINDS[kind]?.building && kind !== 'windmill') || kind === 'stall' || kind === 'fountain') built[i] = 1;
    else if (kind === 'dock' || kind === 'arch') approach[i] = 1;
  }
  for (const [cell, floor] of f.world.floors) if (floor === 'plaza') built[keyX(cell) + keyZ(cell) * SIZE_X] = 1;
  // A village green is the village's square.
  for (const g of landUse(f).greens) for (const c of g.cells) built[keyX(c) + keyZ(c) * SIZE_X] = 1;
  const country = new Set<CellKey>();
  const runs: CountryRun[] = [];
  if (!built.includes(1)) return { isCountry: () => false, runs, frontage: () => NONE };
  const near = columnDistance((x, z) => built[x + z * SIZE_X] === 1);
  const toDock = columnDistance((x, z) => approach[x + z * SIZE_X] === 1);

  for (const street of streets(f).list) {
    const out = new Set<CellKey>();
    for (const c of street.cells) {
      if (!onGround(f, c)) continue;
      const x = keyX(c), z = keyZ(c);
      if (near.at(x, z) <= FRONTAGE || toDock.at(x, z) <= APPROACH) continue;
      out.add(c);
    }
    // A country lane leads out of town: a street with no cell in town at all (a path laid alone out
    // in a field) is not one, and keeps its lamps.
    if (!street.cells.some((c) => onGround(f, c) && !out.has(c))) continue;
    const seen = new Set<CellKey>();
    for (const c of street.cells) {
      if (!out.has(c) || seen.has(c)) continue;
      const run: CellKey[] = [];
      const stack = [c];
      seen.add(c);
      while (stack.length) {
        const a = stack.pop()!;
        run.push(a);
        for (const l of street.links.get(a) ?? []) {
          if (out.has(l.cell) && !seen.has(l.cell)) {
            seen.add(l.cell);
            stack.push(l.cell);
          }
        }
      }
      if (run.length < RUN_MIN) continue;
      runs.push({ street, cells: run.sort((a, b) => a - b) });
      for (const k of run) country.add(k);
    }
  }
  return { isCountry: (c) => country.has(c), runs, frontage: near.at };
});
