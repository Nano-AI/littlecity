// Test helpers for the fence, wall and stairs generators: a small town
// resolved with only the Ground edge rules, and the parts they need.

import { key } from '@/core/grid';
import { createPartRegistry, type PartRegistry } from '@/gen/api';
import { fallbackPart } from '@/gen/fallback';
import railing from '@/parts/ground/railing.part';
import { resolveTown } from '@/resolve/index';
import type { ShapePlan, Structure } from '@/resolve/plan';
import J18 from '@/rules/joinery/J18.stairs.rule';
import J19 from '@/rules/joinery/J19.edge-railing.rule';
import J20 from '@/rules/joinery/J20.fence-wall-runs.rule';
import RE01 from '@/rules/roles/R-E01.fence-style.rule';
import RE02 from '@/rules/roles/R-E02.wall-style.rule';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';

export const EDGE_RULES = [RE01, RE02, J18, J19, J20];
export const edgeParts: PartRegistry = createPartRegistry([railing], fallbackPart);

/** A town on flat ground (height 1 on columns 4–43), resolved with the edge rules only. */
export function town(build: (b: TownBuilder) => void, seed = 3): ShapePlan {
  const terrain = flatTerrain(seed);
  const b = new TownBuilder(emptyWorld(seed), terrain);
  build(b);
  return resolveTown(b.world, terrain, { rules: EDGE_RULES }).shape;
}

export function blockStructure(plan: ShapePlan, x: number, y: number, z: number): Structure {
  const id = plan.structureAt.get(key(x, y, z));
  const s = id === undefined ? undefined : plan.structures.get(id);
  if (!s) throw new Error(`no block structure at (${x}, ${y}, ${z})`);
  return s;
}

export function edgeStructure(plan: ShapePlan, edge: number): Structure {
  const id = plan.edgeAt.get(edge);
  const s = id === undefined ? undefined : plan.structures.get(id);
  if (!s) throw new Error(`no run holds edge ${edge}`);
  return s;
}
