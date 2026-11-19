// Stalls (R-S01): a stall block is a little booth under a striped awning: a
// market stall (fruit, bread, cheese, pots or cloth), a fish stall near the docks, a
// flower stall on a garden. Its counter faces the side the rule chose.
//
// Reads: the structure (cell, seed, colour), its role and its tags
// (front:<side>, goods:<what>). With no role (rules not run) it is a market
// stall facing south.

import { CELL_H, keyX, keyY, keyZ, S } from '@/core/grid';
import { translation, type Mat4Like } from '@/core/mat4';
import { defineGenerator } from '@/gen/api';
import { MeshBuilder } from '@/gen/mesh';
import { goodsAt, readFront, readGoods, type StallRole } from '@/rules/roles/ground-props';
import { drawStall } from './draw';

export const STALL_ROLES: readonly StallRole[] = ['market-stall', 'fish-stall', 'flower-stall'];

export default defineGenerator({
  kind: 'stall',
  build(s, plan) {
    const anchors: Record<string, Mat4Like> = {};
    const b = new MeshBuilder({ ink: s.id });
    const given = plan.roles.get(s.id)?.role;
    const role: StallRole = given !== undefined && (STALL_ROLES as readonly string[]).includes(given) ? (given as StallRole) : 'market-stall';
    const tags = plan.tags.get(s.id);
    for (const cell of s.cells) {
      b.at(translation(keyX(cell) + 0.5, keyY(cell) * CELL_H, keyZ(cell) + 0.5), () =>
        drawStall(b, { role, goods: readGoods(tags) ?? goodsAt(plan.world.seed, cell), front: readFront(tags) ?? S, seed: s.seed, color: s.color }),
      );
    }
    return { mesh: b.build(), anchors };
  },
});
