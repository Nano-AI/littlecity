// Helpers shared by the house role and joinery rules (Houses owner). Not a
// rule file: nothing here is discovered.

import { columnIndex, DIR4, keyX, keyY, keyZ, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { Role } from '@/core/vocab';
import type { RuleContext } from '@/resolve/engine/api';
import type { Facade } from '@/resolve/facts/facades.fact';
import { solid } from '@/resolve/facts/lib';
import { roofRegions, type RoofRegion } from '@/resolve/facts/roofs.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import type { Feature, ShapePlan, Structure } from '@/resolve/plan';

/** Stoop steps per storey of drop (J08). The door part's step rise is CELL_H / 5. */
export const STEPS_PER_LEVEL = 5;

/** House structures, by id. */
export function houseStructures(ctx: RuleContext): Structure[] {
  return [...ctx.facts.structures.values()].filter((s) => s.kind === 'house' && s.cells.length > 0).sort((a, b) => a.id - b.id);
}

export function roleOf(plan: ShapePlan, id: number): Role | undefined {
  return plan.roles.get(id)?.role;
}

/** A feature of the structure at a cell (and side), if one was emitted already. */
export function featureAt(plan: ShapePlan, structure: number, type: Feature['type'], cell: CellKey, dir?: Dir4): Feature | undefined {
  for (const f of plan.featuresByStructure.get(structure) ?? []) {
    if (f.type === type && f.cell === cell && (dir === undefined || f.dir === dir)) return f;
  }
  return undefined;
}

/** The roof feature J04 gave a region, if any. */
export function roofOf(plan: ShapePlan, region: RoofRegion): Feature | undefined {
  for (const f of plan.featuresByStructure.get(region.structure) ?? []) {
    if (f.type === 'roof' && f.region === region.index) return f;
  }
  return undefined;
}

/** True when the top of `cell` (a house block) is a flat, walkable terrace. */
export function isTerraceTop(ctx: RuleContext, cell: CellKey): boolean {
  const region = roofRegions(ctx.facts).byCell.get(cell);
  if (!region) return false;
  return roofOf(ctx.plan, region)?.variant === 'flat';
}

/**
 * J06's score for a ground-storey facade cell: a street right outside +5, a
 * plaza right outside +4, any floor within 3 +3, open ground +1; water, a
 * cliff or an alley −3. A door that would open onto a drop, a tree or a
 * fence scores lower still, so it is the last resort.
 */
export function doorScore(fc: Facade): number {
  let score = 0;
  if (fc.street === 1) score += 5;
  if (fc.plaza === 1) score += 4;
  const floor = Math.min(fc.street ?? 9, fc.plaza ?? 9, fc.garden ?? 9);
  if (floor <= 3) score += 3;
  if (fc.faces === 'ground' && fc.dist === 1) score += 1;
  if ((fc.faces === 'water' && fc.dist === 1) || (fc.faces === 'cliff' && fc.dist === 1) || fc.alley) score -= 3;
  if (fc.faces === 'structure' && fc.dist === 1) score -= 6;
  if (fc.touching) score -= 5;
  if (fc.edge) score -= 2;
  score -= 4 * Math.min(fc.drop, 3);
  return score;
}

/** The column [x, z] (centre) of the steeple a chapel is paired with, if any. */
export function steepleColumn(ctx: RuleContext, structure: number): [number, number] | null {
  for (const t of structureInfo(ctx.facts).get(structure)?.touches ?? []) {
    if (ctx.plan.roles.get(t.id)?.role !== 'steeple') continue;
    const c = ctx.facts.structures.get(t.id)!.cells[0]!;
    return [keyX(c) + 0.5, keyZ(c) + 0.5];
  }
  return null;
}

/**
 * The free gable end of a region that lies farthest from the chapel's steeple
 * (or, with no steeple, the south or east end): the cell at that end and the
 * side it faces. Null if both ends are built against something.
 */
export function farGableEnd(ctx: RuleContext, structure: number, region: RoofRegion, ridge: 'x' | 'z'): { cell: CellKey; dir: Dir4 } | null {
  const tower = steepleColumn(ctx, structure);
  const pierced = new Set(region.pierced);
  const cells = region.cells.filter((k) => !pierced.has(k));
  let best: { cell: CellKey; dir: Dir4; far: number } | null = null;
  for (const dir of (ridge === 'x' ? [3, 1] : [0, 2]) as Dir4[]) {
    const [dx, dz] = DIR4[dir]!;
    const cell = [...cells].sort((a, b) => (keyX(b) - keyX(a)) * dx + (keyZ(b) - keyZ(a)) * dz || a - b)[0];
    if (cell === undefined) continue;
    const n = neighbor(cell, dir);
    if (n !== NO_CELL && (solid(ctx.facts, n) || ctx.facts.structureAt.get(n) === structure)) continue;
    const px = keyX(cell) + 0.5 + dx * 0.5, pz = keyZ(cell) + 0.5 + dz * 0.5;
    const far = tower ? Math.abs(px - tower[0]) + Math.abs(pz - tower[1]) : dir === 2 || dir === 1 ? 1 : 0;
    if (!best || far > best.far) best = { cell, dir, far };
  }
  return best && { cell: best.cell, dir: best.dir };
}

/**
 * The side on which a house abuts a cliff: terrain rising 2+ levels above the
 * floor of one of its lowest cells (R-H12). Null if there is none.
 */
export function cliffSide(ctx: RuleContext, s: Structure): Dir4 | null {
  let minY = 99;
  for (const c of s.cells) minY = Math.min(minY, keyY(c));
  for (const c of s.cells) {
    if (keyY(c) !== minY) continue;
    for (let d = 0 as Dir4; d < 4; d = (d + 1) as Dir4) {
      const n = neighbor(c, d);
      if (n === NO_CELL) continue;
      if (ctx.facts.terrain.height[columnIndex(keyX(n), keyZ(n))]! >= minY + 2) return d;
    }
  }
  return null;
}
