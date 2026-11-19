// Shared by the monument generators' tests: build a small town, resolve it
// with the real rules, and draw one structure.

import { key } from '@/core/grid';
import { allGenerators, allParts } from '@/gen/discover';
import type { MeshData } from '@/gen/mesh';
import { resolveTown } from '@/resolve/index';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { flatTerrain, TerrainBuilder, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';

export interface TestTown {
  plan: ShapePlan;
  at(x: number, y: number, z: number): Structure;
  draw(s: Structure): MeshData;
  drawAt(x: number, y: number, z: number): MeshData;
}

export function town(build: (b: TownBuilder) => void, opts: { seed?: number; terrain?: (t: TerrainBuilder) => void } = {}): TestTown {
  const seed = opts.seed ?? 7;
  let terrain = flatTerrain(seed);
  if (opts.terrain) {
    const t = new TerrainBuilder(seed);
    opts.terrain(t);
    terrain = t.build();
  }
  const b = new TownBuilder(emptyWorld(seed), terrain);
  build(b);
  const plan = resolveTown(b.world, terrain).shape;
  const at = (x: number, y: number, z: number): Structure => {
    const id = plan.structureAt.get(key(x, y, z));
    if (id === undefined) throw new Error(`no structure at ${x}, ${y}, ${z}`);
    return plan.structures.get(id)!;
  };
  const draw = (s: Structure): MeshData => allGenerators().build(s, plan, allParts()).mesh;
  return { plan, at, draw, drawAt: (x, y, z) => draw(at(x, y, z)) };
}

/** The distinct ink ids on triangles whose three corners all satisfy `where`. */
export function inksWhere(mesh: MeshData, where: (x: number, y: number, z: number) => boolean): Set<number> {
  const out = new Set<number>();
  for (let v = 0; v < mesh.inkId.length; v += 3) {
    let all = true;
    for (let k = 0; k < 3; k++) {
      const i = (v + k) * 3;
      if (!where(mesh.position[i]!, mesh.position[i + 1]!, mesh.position[i + 2]!)) all = false;
    }
    if (all) out.add(mesh.inkId[v]!);
  }
  return out;
}
