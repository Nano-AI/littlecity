// R-G03 · tier 2 · Field (design section 7, "Field"). What a patch of
// playing field becomes depends on its shape: the table and the reading are
// in field.lib.ts. This rule pins the answer on the region: its role, a
// `field-court` feature saying where the court lies (none on a plain
// green), and the `school-playground` tag when the field touches a
// schoolhouse (children come out to it at break).
//
// Tennis is played on grass beside a garden, else on clay (grass one time
// in three, by the region's seed). Basketball is a hard court.

import { DIR4, key, keyY, keyX, keyZ, type CellKey } from '@/core/grid';
import { rand } from '@/core/rand';
import type { FeatureVariant } from '@/core/vocab';
import { defineRule, type Candidate } from '@/resolve/engine/api';
import type { Facts } from '@/resolve/facts/api';
import type { ShapePlan, Structure } from '@/resolve/plan';
import { readField, type CellRect, type FieldRole } from './field.lib';

interface Data {
  role: FieldRole;
  rect: CellRect | null;
  along: 0 | 1;
  surface: FeatureVariant<'field-court'>;
  school: boolean;
}

function besideGarden(f: Facts, cells: readonly CellKey[]): boolean {
  return cells.some((c) => DIR4.some(([dx, dz]) => f.world.floors.get(key(keyX(c) + dx, keyY(c), keyZ(c) + dz)) === 'garden'));
}

function besideSchool(f: Facts, plan: ShapePlan, cells: readonly CellKey[]): boolean {
  const own = new Set(cells);
  for (const c of cells) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = key(keyX(c) + dx, keyY(c), keyZ(c) + dz);
        if (own.has(n)) continue;
        const s = f.structureAt.get(n);
        if (s !== undefined && plan.roles.get(s)?.role === 'schoolhouse') return true;
      }
    }
  }
  return false;
}

export function surfaceOf(f: Facts, s: Pick<Structure, 'id' | 'cells'>, role: FieldRole): FeatureVariant<'field-court'> {
  if (role === 'basketball-court' || role === 'boules-court' || role === 'running-track') return role === 'basketball-court' ? 'hard' : 'clay';
  if (role !== 'tennis-court') return 'grass';
  if (besideGarden(f, s.cells)) return 'grass';
  return rand(f.seed, 'R-G03', s.id, 'surface') < 1 / 3 ? 'grass' : 'clay';
}

export default defineRule<Data>({
  id: 'R-G03.field',
  part: 'roles',
  tier: 2,
  priority: 3985,
  about: 'Reads: field regions (their cells and what stands in them), gardens beside, schoolhouses beside. Claims: the field region’s role. Emits: a field-court feature; tags school-playground.',
  find({ facts, plan }) {
    const out: Candidate<Data>[] = [];
    for (const s of facts.structures.values()) {
      if (s.kind !== 'field') continue;
      const reading = readField(s.cells, (c) => !facts.kinds.has(c));
      out.push({
        anchor: s.cells[0]!,
        structure: s.id,
        data: { ...reading, surface: surfaceOf(facts, s, reading.role), school: besideSchool(facts, plan, s.cells) },
      });
    }
    return out;
  },
  apply(c, out) {
    const s = c.structure!;
    out.role(s, c.data.role);
    if (c.data.school) out.tag(s, 'school-playground');
    const r = c.data.rect;
    if (!r) return;
    out.feature({
      type: 'field-court',
      structure: s,
      cell: key(r.x0, keyY(c.anchor), r.z0),
      variant: c.data.surface,
      params: { x0: r.x0, z0: r.z0, w: r.w, d: r.d, along: c.data.along },
    });
  },
});
