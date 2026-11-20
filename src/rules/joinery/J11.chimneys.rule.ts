// J11 · tier 1 · Chimneys. One per 3 pitched roof cells, with a minimum per
// role (a cottage: one, p = 0.7; a chapel: none; a stilt house: a stove
// pipe). They stand on the ridge, preferring a cell beside a party wall
// (always, for a row house). A chimney with a taller wall within one cell
// becomes a tall flue: a brick breast climbing that wall to just above its
// eave (`chimney.against` names the side).
import { CELL_H, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import type { Role } from '@/core/vocab';
import { defineRule } from '@/resolve/engine/api';
import { solid } from '@/resolve/facts/lib';
import { roofRegions } from '@/resolve/facts/roofs.fact';
import type { Structure } from '@/resolve/plan';
import { houseFacts } from './houses.fact';
import { houseStructures, roleOf, roofOf } from './houses.lib';

/** The least number of chimneys a role has, and the chance a small house of that role has one at all. */
const MINIMUM: Partial<Record<Role, readonly [number, number]>> = {
  cottage: [1, 0.7],
  manor: [2, 1],
  inn: [2, 1],
};
/** Roles that never have one. */
const NONE: ReadonlySet<Role> = new Set<Role>(['chapel', 'greenhouse', 'barn', 'smithy']); // a smithy's chimney is its tower (R-H19)

export default defineRule<{ s: Structure }>({
  id: 'J11.chimneys',
  part: 'joinery',
  tier: 1,
  priority: 890,
  local: 1, // apply reads only its roof regions and the cells beside them (RuleDef.local)
  about: 'Reads: roofRegions, roof features, roles, walls beside the roof. Emits: chimney features with chimney-top sockets.',
  find: (ctx) => houseStructures(ctx).map((s) => ({ anchor: s.cells[0]!, structure: s.id, data: { s } })),
  apply(c, out, ctx) {
    const { s } = c.data;
    const role = roleOf(ctx.plan, s.id);
    const hf = houseFacts(ctx.facts);
    const eligible: CellKey[] = [];
    const dormers = new Set<CellKey>();
    for (const f of ctx.plan.featuresByStructure.get(s.id) ?? []) if (f.type === 'dormer' && f.cell !== undefined) dormers.add(f.cell);
    let roofCells = 0;
    for (const region of roofRegions(ctx.facts).byStructure.get(s.id) ?? []) {
      const roof = roofOf(ctx.plan, region);
      if (!roof || roof.variant === 'flat') continue;
      const pierced = new Set(region.pierced);
      for (const k of region.cells) {
        if (pierced.has(k)) continue;
        roofCells++;
        if (!dormers.has(k) && hf.roofDoorAt(k) === undefined) eligible.push(k); // a dormer or a roof door has the cell already
      }
    }
    if (eligible.length === 0 || (role && NONE.has(role))) return;
    const [min, chance] = MINIMUM[role ?? 'cottage'] ?? [1, 1];
    let count = Math.min(3, Math.max(min, Math.floor(roofCells / 3)));
    if (count === min && min > 0 && chance < 1 && ctx.rand('any') >= chance) count = 0;
    if (count === 0) return;

    const party = (k: CellKey): boolean =>
      ([0, 1, 2, 3] as Dir4[]).some((d) => {
        const n = neighbor(k, d);
        return n !== NO_CELL && ctx.facts.structureAt.get(n) !== s.id && solid(ctx.facts, n);
      });
    const tallest = (k: CellKey): number => Math.max(...([0, 1, 2, 3] as Dir4[]).map((d) => hf.wallBeside(k, d)));
    // Best first: beside a party wall, not under a wall too tall to clear, then by seed.
    const score = new Map<CellKey, number>();
    for (const k of eligible) score.set(k, (party(k) ? 2 : 0) - (tallest(k) > 1 ? 4 : 0) + ctx.rand('where', k));
    const ranked = [...eligible].sort((a, b) => score.get(b)! - score.get(a)! || a - b);
    const chosen: CellKey[] = [];
    for (const k of ranked) {
      if (chosen.length >= count) break;
      if (chosen.some((o) => ([0, 1, 2, 3] as Dir4[]).some((d) => neighbor(o, d) === k))) continue; // not two side by side
      chosen.push(k);
    }
    let flues = 0;
    for (const cell of chosen.sort((a, b) => a - b)) {
      const wall = tallest(cell);
      const pipe = role === 'stilt-house';
      // Beside a wall one or two storeys taller the flue climbs that wall as a brick breast and
      // ends just above its eave. At most one a house, and not every time.
      const tall = !pipe && wall >= 1 && wall <= 2 && ctx.rand('flue', cell) < 0.6 && flues++ === 0;
      const against = tall ? ([0, 1, 2, 3] as Dir4[]).find((d) => hf.wallBeside(cell, d) === wall) : undefined;
      const id = out.feature({
        type: 'chimney',
        structure: s.id,
        cell,
        variant: pipe ? 'pipe' : tall ? 'tall-flue' : 'plain',
        ...(tall ? { params: { height: Math.round((wall * CELL_H + 0.25) * 100) / 100, ...(against !== undefined ? { against } : {}) } } : {}),
      });
      out.socket({ type: 'chimney-top', owner: id, structure: s.id, cell });
    }
  },
});
