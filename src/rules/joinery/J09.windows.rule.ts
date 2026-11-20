// J09 · tier 1 · Windows. Each facade cell of a house without a door gets
// one window from the structure's family, except:
//
//   none where a piece stands right against the wall (a tree, a fence, a windmill)
//   none where a door is due (J26's bridge doors come later in the order)
//   none just above a roof (a lower wing or a lower neighbour covers that wall)
//   p = 0.5 on alley sides (every storey of a wall that stands over an alley)
//
// The role bends the family: a chapel's are pointed; a shop's ground storey
// facing its street or square is shopfront, and an upper storey may be a bay
// (p = 0.2); a townhouse's upper storeys on the door side may carry a
// balcony (R-H10, p = 0.5). A free gable end gets a small round window
// (p = HOUSE.gableWindow); the chapel's far gable gets its rose.
import { below, keyY, neighbor, NO_CELL, type CellKey, type Dir4 } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { facades } from '@/resolve/facts/facades.fact';
import { roofRegions } from '@/resolve/facts/roofs.fact';
import { structureInfo } from '@/resolve/facts/structure.fact';
import type { Structure } from '@/resolve/plan';
import { structureStyle } from '@/resolve/structures';
import { HOUSE, personalityOf } from '@/style/houses';
import { houseFacts } from './houses.fact';
import { cliffSide, farGableEnd, houseStructures, isTerraceTop, roleOf, roofOf } from './houses.lib';

type WindowVariant = 'square' | 'tall' | 'arched' | 'shuttered' | 'pointed' | 'shopfront' | 'bay';

export default defineRule<{ s: Structure }>({
  id: 'J09.windows',
  part: 'joinery',
  tier: 1,
  priority: 910,
  local: 3, // apply reads only facades (reach 3, and their alley flags), the roofs of the houses beside it (RuleDef.local)
  localAlso: (ctx, s) => facades(ctx.facts).alleyDigest(s),
  about: 'Reads: facades, alleys (through facades), door and roof features, roles. Emits: window features with window sockets; balconies on townhouses.',
  find: (ctx) => houseStructures(ctx).map((s) => ({ anchor: s.cells[0]!, structure: s.id, data: { s } })),
  apply(c, out, ctx) {
    const { s } = c.data;
    const role = roleOf(ctx.plan, s.id);
    if (role === 'greenhouse') return; // all glass already
    const persona = personalityOf(s.seed, s.color, role, s.cells.length, false, structureStyle(ctx.plan.world, s));
    const cliff = role === 'cliff-house' ? cliffSide(ctx, s) : null;
    let cliffBalcony = false;
    const hf = houseFacts(ctx.facts);
    const info = structureInfo(ctx.facts).get(s.id);
    const mainDoor = (ctx.plan.featuresByStructure.get(s.id) ?? []).find((f) => f.type === 'door' && (f.params as { main?: number } | undefined)?.main === 1);
    const window = (cell: CellKey, dir: Dir4, variant: WindowVariant | 'round' | 'rose'): void => {
      const id = out.feature({ type: 'window', structure: s.id, cell, dir, variant });
      const extra = variant === 'shopfront' ? ['awning-mount' as const] : [];
      out.socket({ type: 'window', owner: id, structure: s.id, cell, dir });
      for (const type of extra) out.socket({ type, owner: id, structure: s.id, cell, dir });
    };

    const all = facades(ctx.facts);
    // Where the doors are, looked up once (a big house has hundreds of facade cells).
    const doors = new Set<number>();
    for (const f of ctx.plan.featuresByStructure.get(s.id) ?? []) if (f.type === 'door' && f.cell !== undefined && f.dir !== undefined) doors.add(f.cell * 4 + f.dir);
    // U09, U11-F: a clock, a niche or an oriel already fills the wall of some cells; a balcony
    // put there first wants a tall window behind it.
    const taken = new Set<number>();
    const balconies = new Set<number>();
    for (const f of ctx.plan.featuresByStructure.get(s.id) ?? []) {
      if (f.cell === undefined || f.dir === undefined) continue;
      if (f.type === 'vista' && f.variant !== 'doorway') taken.add(f.cell * 4 + f.dir);
      if (f.type === 'balcony') balconies.add(f.cell * 4 + f.dir);
    }
    // Columns (and sides) of this house that stand over an alley.
    const alleySides = new Set<number>();
    for (const f of all.byStructure.get(s.id) ?? []) if (f.alley) alleySides.add((f.cell & 4095) * 4 + f.dir);
    for (const f of all.byStructure.get(s.id) ?? []) {
      if (doors.has(f.cell * 4 + f.dir) || taken.has(f.cell * 4 + f.dir)) continue;
      if (f.touching || (f.faces === 'structure' && f.dist === 1)) continue;
      const what = hf.outside(f.cell, f.dir);
      if (what === 'bridge') continue; // J26 puts a door here
      if (what === 'roof' && !isTerraceTop(ctx, below(neighbor(f.cell, f.dir)))) continue;
      // An alley side is the whole wall over the alley, not just its ground storey.
      const alley = f.alley || alleySides.has((f.cell & 4095) * 4 + f.dir);
      if (alley && ctx.rand('alley', f.cell, f.dir) >= 0.5) continue;
      // R-H18: a barn has few windows, small and shuttered: one wall cell in three.
      if (role === 'barn' && ctx.rand('barn', f.cell, f.dir) >= 0.34) continue;

      let variant: WindowVariant = persona.family;
      const top = info ? keyY(f.cell) === info.maxY : false;
      if (role === 'chapel') variant = 'pointed';
      else if (role === 'barn') variant = 'shuttered';
      else if (role === 'shop') {
        if (f.storey === 1 && (f.street === 1 || f.plaza === 1) && f.drop === 0) variant = 'shopfront';
        else if (f.storey >= 2 && (f.street !== undefined || f.plaza !== undefined) && ctx.rand('bay', f.cell, f.dir) < 0.2) variant = 'bay';
      } else if (role === 'townhouse' && mainDoor && f.dir === mainDoor.dir && f.storey >= 2 && !top && ctx.rand('balcony', f.cell) < 0.5) {
        // A balcony wants a tall window behind it.
        variant = 'tall';
        const balcony = out.feature({ type: 'balcony', structure: s.id, cell: f.cell, dir: f.dir, variant: 'iron' });
        out.socket({ type: 'perch', owner: balcony, structure: s.id, cell: f.cell, dir: f.dir });
      }
      // R-H12: one timber balcony on the top storey, on the side away from the cliff.
      if (cliff !== null && !cliffBalcony && top && f.storey >= 2 && f.dir === ((cliff + 2) & 3)) {
        cliffBalcony = true;
        variant = 'tall';
        const balcony = out.feature({ type: 'balcony', structure: s.id, cell: f.cell, dir: f.dir, variant: 'timber' });
        out.socket({ type: 'perch', owner: balcony, structure: s.id, cell: f.cell, dir: f.dir });
      }
      if (balconies.has(f.cell * 4 + f.dir)) variant = 'tall';
      window(f.cell, f.dir, variant);
    }

    // Gable ends: a round window under the ridge; the chapel's rose.
    for (const region of roofRegions(ctx.facts).byStructure.get(s.id) ?? []) {
      const roof = roofOf(ctx.plan, region);
      if (!roof || (roof.variant !== 'gable' && roof.variant !== 'stepped-gable')) continue;
      const ridge = (roof.params as { ridge?: 'x' | 'z' } | undefined)?.ridge ?? (region.width >= region.depth ? 'x' : 'z');
      const span = ridge === 'x' ? region.depth : region.width;
      if (span > 2 || !region.rectangular || region.pierced.length > 0) {
        if (role !== 'chapel') continue;
      }
      if (role === 'chapel') {
        const end = farGableEnd(ctx, s.id, region, ridge);
        if (end) window(end.cell, end.dir, 'rose');
        continue;
      }
      for (const dir of (ridge === 'x' ? [3, 1] : [0, 2]) as Dir4[]) {
        // The first cell of this end, in key order; the generator centres the window across the gable.
        const cell = region.cells.find((k) => {
          const n = neighbor(k, dir);
          return n === NO_CELL || !region.cells.includes(n);
        });
        if (cell === undefined || hf.outside(cell, dir) === 'blocked') continue;
        const fc = all.at(cell, dir);
        if (fc && (fc.touching || (fc.faces === 'structure' && fc.dist === 1))) continue; // something stands against that end
        const always = roof.variant === 'stepped-gable' && mainDoor?.dir === dir;
        if (!always && ctx.rand('gable', region.index, dir) >= HOUSE.gableWindow) continue;
        window(cell, dir, 'round');
      }
    }
  },
});
