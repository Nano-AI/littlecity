// Ruins in the town plan (mischief, design section 13b): the incremental
// resolve stays exactly a full resolve when blocks are damaged and mended
// (a block's damage is in the content keys and the structure hash), and a
// ruined building houses nobody and carries no dressing.

import { describe, expect, test } from 'vitest';
import { hash } from '@/core/rand';
import type { Edit, Terrain, World } from '@/core/world';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { randomEdit } from '@/scenario/edits';
import { packRuin } from '@/world/damage';
import { applyEdit, canApply } from '@/world/world';
import { facades } from './facts/facades.fact';
import { roofRegions } from './facts/roofs.fact';
import { structureInfo } from './facts/structure.fact';
import { withoutMemos } from './facts/content-keys.fact';
import type { ResolveOptions } from './engine/api';
import { resolveDressing, resolveShape, resolveTown } from './index';
import type { DressingPlan, ShapePlan } from './plan';
import { ruinedStructures } from './ruins';
import { createStagedResolver } from './staged';

const plain = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_k, x: unknown) => {
      if (x instanceof Map) return [...x.entries()];
      if (x instanceof Set) return [...x.values()].sort();
      if (typeof x === 'function') return undefined;
      return x;
    }),
  );

/** Everything a plan says, as plain data (trace timings left out). */
function snapshot(shape: ShapePlan, dressing: DressingPlan): Record<string, unknown> {
  return {
    kinds: plain(shape.kinds),
    structures: plain([...shape.structures.values()].sort((a, b) => a.id - b.id)),
    structureAt: plain(shape.structureAt),
    floorAt: plain(shape.floorAt),
    edgeAt: plain(shape.edgeAt),
    supports: plain(shape.supports),
    roles: plain(shape.roles),
    tags: plain(shape.tags),
    features: plain(shape.features),
    sockets: plain(shape.sockets),
    claims: plain(shape.claims),
    trace: shape.trace.map((t) => [t.rule, t.candidates, t.chanceSkipped, t.claimSkipped, t.applied]),
    hash: shape.hash,
    facades: plain(facades(shape.facts).list),
    facadeAt: facades(shape.facts).list.map((f) => facades(shape.facts).at(f.cell, f.dir) === f),
    roofs: plain(roofRegions(shape.facts).list),
    roofByCell: plain([...roofRegions(shape.facts).byCell].map(([c, r]) => [c, r.structure, r.index])),
    info: plain(structureInfo(shape.facts)),
    props: plain(dressing.props),
    actors: plain(dressing.actors),
    dressingSockets: plain(dressing.sockets),
    nav: plain(dressing.nav),
    dressingClaims: plain(dressing.claims),
    dressingTrace: dressing.trace.map((t) => [t.rule, t.candidates, t.chanceSkipped, t.claimSkipped, t.applied]),
    dressingHash: dressing.hash,
  };
}

/** A damage edit on a block of the world: damage of any kind, scaffolding, or a repair. */
function ruinEdit(w: World, seed: number, i: number): Edit | null {
  const cells = [...w.blocks.keys()];
  if (cells.length === 0) return null;
  const cell = cells[hash(seed, 'ruin-cell', i) % cells.length]!;
  const k = hash(seed, 'ruin', i) % 9;
  if (k === 8) return w.blocks.get(cell)!.ruin ? { type: 'repair', cell } : null;
  const ruin = packRuin({ stage: (k % 4) as 0 | 1 | 2 | 3, cause: k % 2 ? 'blast' : 'fire', mending: k >= 6 || k % 4 === 0 });
  return ruin ? { type: 'setRuin', cell, ruin } : null;
}

function play(name: string, edits: number, seed: number): void {
  const scn = findScenario(name)!;
  const built = buildScenario(scn);
  const t: Terrain = built.terrain;
  const opts: ResolveOptions = scenarioResolveOptions(scn);
  const resolver = createStagedResolver(t, opts);
  let world: World = built.world;
  resolver.update(world);
  resolver.poll();
  let played = 0;
  for (let i = 0; i < edits; i++) {
    const e = i % 3 === 2 ? randomEdit(world, t, seed, i) : ruinEdit(world, seed, i);
    if (!e || !canApply(world, t, e).ok) continue;
    if (i % 4 === 0) resolver.preview(applyEdit(world, t, e));
    world = applyEdit(world, t, e);
    const shape = resolver.update(world);
    const got = resolver.poll();
    expect(got, `edit ${i}: dressing`).not.toBeNull();
    const cold = withoutMemos(() => {
      const s = resolveShape(world, t, opts);
      return snapshot(s, resolveDressing(s, opts));
    });
    const warm = snapshot(shape, got!.dressing);
    for (const k of Object.keys(cold)) {
      const a = JSON.stringify(warm[k]);
      const b = JSON.stringify(cold[k]);
      if (a !== b) expect(warm[k], `${name}, edit ${i} (${JSON.stringify(e)}): ${k}`).toEqual(cold[k]);
    }
    played++;
  }
  expect(played).toBeGreaterThan(edits * 0.6);
}

describe('ruins', () => {
  test('incremental resolve equals a full resolve through damage and repair edits', () => play('everything', 120, 21), 240_000);

  test('a ruined building houses nobody and carries no dressing; repaired, it is exactly as before', () => {
    const scn = findScenario('everything')!;
    const built = buildScenario(scn);
    const t = built.terrain;
    const opts = scenarioResolveOptions(scn);
    const before = resolveTown(built.world, t, opts);
    const home = before.dressing.actors.find((a) => a.home !== undefined && before.shape.structures.get(a.home)?.kind === 'house');
    expect(home, 'the town has a resident').toBeDefined();
    const s = before.shape.structures.get(home!.home!)!;
    let w = built.world;
    for (const cell of s.cells) w = applyEdit(w, t, { type: 'setRuin', cell, ruin: packRuin({ stage: 3, cause: 'fire' }) });
    const after = resolveTown(w, t, opts);
    expect(ruinedStructures(after.shape).has(s.id)).toBe(true);
    expect(after.dressing.actors.filter((a) => a.home === s.id)).toEqual([]);
    for (const p of after.dressing.props) {
      const at = p.at;
      if ('cell' in at) expect(s.cells.includes(at.cell), `${p.id} stands in the ruin`).toBe(false);
    }
    for (const cell of s.cells) w = applyEdit(w, t, { type: 'repair', cell });
    expect(w.blocks).toEqual(built.world.blocks);
    expect(resolveTown(w, t, opts).dressing.hash).toBe(before.dressing.hash);
  });
});
