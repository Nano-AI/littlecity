// Every monument drawn in every monuments scenario is a sound mesh: valid
// data, no doubled faces between merged cells, inside the triangle budget,
// every owned socket placed. This is the geometry test for all the role and
// joinery fixtures at once; the per-kind tests beside each generator check
// the particulars.

import { describe, expect, test } from 'vitest';
import { allChunks } from '@/core/grid';
import type { StructureKind } from '@/core/kinds';
import { findDuplicateFaces, validateMesh } from '@/gen/checks';
import { allGenerators, allParts } from '@/gen/discover';
import { triangleCount } from '@/gen/mesh';
import { resolveScenario } from '@/scenario';
import { allScenarios } from '@/scenario/discover';

const MINE = /^(R-[TLMA]\d|J1[3-6]\.|S2-S4|gen\.(tower|lighthouse|arch|marble|pillar)$|monuments-)/;
const KINDS = new Set<StructureKind>(['tower', 'lighthouse', 'arch', 'marble', 'pillar']);
const entries = allScenarios().filter((e) => MINE.test(e.scenario.name));

describe('monuments: every structure in every fixture', () => {
  test('the fixtures are found', () => {
    expect(entries.length).toBeGreaterThanOrEqual(26);
  });

  test.each(entries.map((e) => [e.scenario.name, e] as const))('%s', (_name, entry) => {
    const r = resolveScenario(entry.scenario);
    const generators = allGenerators(), parts = allParts();
    let triangles = 0, cells = 0;
    for (const s of r.shape.structures.values()) {
      if (!KINDS.has(s.kind)) continue;
      const out = generators.build(s, r.shape, parts);
      const label = `${s.kind} ${s.id} (${r.shape.roles.get(s.id)?.role ?? 'no role'})`;
      expect(validateMesh(out.mesh), label).toEqual([]);
      expect(findDuplicateFaces(out.mesh), label).toBe(0);
      const n = triangleCount(out.mesh);
      expect(n, label).toBeGreaterThan(0);
      expect(n, label).toBeLessThan(900 + 650 * s.cells.length);
      triangles += n;
      cells += s.cells.length;
      // Every socket a feature of this structure owns has a frame from the generator.
      for (const f of r.shape.featuresByStructure.get(s.id) ?? []) {
        for (const sock of r.shape.socketsByOwner.get(f.id) ?? []) expect(out.anchors[sock.id], `${label}: socket ${sock.id}`).toBeDefined();
      }
    }
    expect(cells).toBeGreaterThan(0);
    expect(triangles / cells, 'triangles per cell, on average').toBeLessThan(500);
    // The supports layer, chunk by chunk.
    const layer = generators.layers().find((l) => l.layer === 'supports')!;
    for (const chunk of allChunks()) {
      const mesh = layer.build(chunk, r.shape, parts).mesh;
      expect(validateMesh(mesh)).toEqual([]);
      expect(findDuplicateFaces(mesh)).toBe(0);
    }
    expect(triangles).toBeGreaterThan(0);
  });
});
