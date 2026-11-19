// R-H14 · tier 3 · Lookout cottage. A house standing on the highest terrain
// level of the island with no other structure within 3 cells: a weathervane
// on its ridge ('weathervane'; J04 emits the finial). The telescope on its
// tripod outside is a prop for the dressing rules. Town-wide: it depends on
// the island's highest ground.
import { columnIndex, keyX, keyY, keyZ, SIZE_X, SIZE_Z } from '@/core/grid';
import { defineRule } from '@/resolve/engine/api';
import { houseStructures } from '../joinery/houses.lib';

export default defineRule({
  id: 'R-H14.lookout-cottage',
  part: 'roles',
  tier: 3,
  priority: 9860,
  townWide: true,
  about: 'Reads: terrain heights, every block within 3 columns. Claims: the role. Tags weathervane.',
  find(ctx) {
    const { terrain } = ctx.facts;
    let top = 0;
    for (let i = 0; i < terrain.height.length; i++) if (terrain.height[i]! > top) top = terrain.height[i]!;
    if (top < 2) return []; // a flat island has no lookout
    // Columns holding a block, by structure.
    const owner = new Int32Array(SIZE_X * SIZE_Z).fill(-1);
    for (const c of ctx.facts.kinds.keys()) {
      const id = ctx.facts.structureAt.get(c);
      if (id !== undefined) owner[columnIndex(keyX(c), keyZ(c))] = id;
    }
    return houseStructures(ctx)
      .filter((s) => {
        const ground = s.cells.filter((c) => keyY(c) === terrain.height[columnIndex(keyX(c), keyZ(c))]);
        if (ground.length === 0 || !ground.every((c) => keyY(c) === top)) return false;
        for (const c of s.cells) {
          for (let dz = -3; dz <= 3; dz++) {
            for (let dx = -3 + Math.abs(dz); dx <= 3 - Math.abs(dz); dx++) {
              const x = keyX(c) + dx, z = keyZ(c) + dz;
              if (x < 0 || z < 0 || x >= SIZE_X || z >= SIZE_Z) continue;
              const o = owner[columnIndex(x, z)]!;
              if (o !== -1 && o !== s.id) return false;
            }
          }
        }
        return true;
      })
      .map((s) => ({ anchor: s.cells[0]!, structure: s.id }));
  },
  apply(c, out) {
    out.role(c.structure!, 'lookout-cottage');
    out.tag(c.structure!, 'weathervane');
  },
});
