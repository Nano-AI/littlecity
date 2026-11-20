// The incremental resolve is exactly a full resolve (Polish). The app's
// resolver keeps work from earlier resolves (per-structure facts by the
// content of the columns around them, a ghost preview reused when the same
// edit is then placed). After each of a few hundred random legal edits, the
// plans it hands back must equal a from-scratch resolve of the same world:
// kinds, structures and their hashes, supports, roles, tags, features,
// sockets, claims, props, actors, the walking graph, and the per-structure
// facts themselves.

import { describe, expect, test } from 'vitest';
import type { Terrain, World } from '@/core/world';
import { buildScenario, scenarioResolveOptions } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { randomEdit } from '@/scenario/edits';
import { islandOf } from '@/terrain/land';
import { randomLandEdit } from '@/world/land-edits';
import { applyEdit } from '@/world/world';
import { facades } from './facts/facades.fact';
import { roofRegions } from './facts/roofs.fact';
import { structureInfo } from './facts/structure.fact';
import { withoutMemos } from './facts/content-keys.fact';
import type { ResolveOptions } from './engine/api';
import { resolveDressing, resolveShape } from './index';
import type { DressingPlan, ShapePlan } from './plan';
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

function play(name: string, edits: number, seed: number, land = false): void {
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
    // With `land`, every third edit reshapes the ground (shaping the land: terrain must invalidate what it should).
    const e = land && i % 3 === 0 ? randomLandEdit(world, t, seed, i) : randomEdit(world, islandOf(world, t), seed, i);
    if (!e) continue;
    const next = applyEdit(world, t, e);
    // Hovering first, as a player does: sometimes this very edit, sometimes another one.
    if (i % 3 === 0) resolver.preview(applyEdit(world, t, e));
    if (i % 5 === 1) {
      const other = land && i % 2 === 0 ? randomLandEdit(world, t, seed + 1, i) : randomEdit(world, islandOf(world, t), seed + 1, i);
      if (other) resolver.preview(applyEdit(world, t, other));
    }
    world = next;
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
  expect(played).toBeGreaterThan(edits * 0.9);
}

describe('incremental resolve equals a full resolve', () => {
  test('everything: 300 random legal edits', () => play('everything', 300, 11), 240_000);
  test('bench-2000: 60 random legal edits', () => play('bench-2000', 60, 12), 240_000);
  // Stepped ground, where houses join across one-level steps (split-level houses).
  test('J02.split-level: 150 random legal edits on stepped ground', () => play('J02.split-level', 150, 13), 240_000);
  // Shaping the land: raising, digging and levelling under and around the town.
  test('everything: 150 edits, a third of them land edits', () => play('everything', 150, 14, true), 240_000);
  test('grown town on generator 2: 120 edits, a third of them land edits', () => play('grown-town-1', 120, 15, true), 240_000);
});
