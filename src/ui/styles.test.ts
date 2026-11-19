// House styles in the hand (design section 7, "House style"): the chosen
// style goes onto a placed house (and its ghost), never onto another piece;
// Alt-click reads the look back off a block.

import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { resolveShape } from '@/resolve/index';
import { structureStyle } from '@/resolve/structures';
import { flatTerrain, TownBuilder } from '@/scenario';
import { applyEdit, canApply, emptyWorld } from '@/world/world';
import { copyLook, planUse, type ActionContext } from './actions';
import { ghostFor } from './ghost';
import { styleIcon } from './icons';
import { pickCell, type Pick } from './pick';

const terrain = flatTerrain(1);
const down = (x: number, z: number) => ({ origin: [x, 50, z] as const, dir: [0, -1, 0] as const });

function setup(): ActionContext {
  const b = new TownBuilder(emptyWorld(1), terrain);
  b.edit({ type: 'placeBlock', cell: key(10, 1, 10), kind: 'house', color: 6, from: null, style: 4 });
  b.house(14, 10, { color: 2 });
  b.put('tree', 18, 10);
  return { world: b.world, terrain, rayDir: [-0.5, -0.6, -0.6] };
}
const pickAt = (ctx: ActionContext, x: number, z: number): Pick => pickCell(down(x, z), ctx.world, ctx.terrain)!;

describe('the style in the hand', () => {
  test('a house is placed with the chosen style; Random and other pieces carry none', () => {
    const ctx = setup();
    const at = pickAt(ctx, 20.5, 20.5);
    expect(planUse({ item: 'house', swatch: 'auto', style: 2 }, at, ctx).tries[0]).toMatchObject({ kind: 'house', style: 2 });
    expect(planUse({ item: 'house', swatch: 'auto', style: 0 }, at, ctx).tries[0]).not.toHaveProperty('style');
    expect(planUse({ item: 'house', swatch: 'auto' }, at, ctx).tries[0]).not.toHaveProperty('style');
    expect(planUse({ item: 'tower', swatch: 'auto', style: 2 }, at, ctx).tries[0]).not.toHaveProperty('style');
    expect(planUse({ item: 'auto', swatch: 'auto', style: 2 }, at, ctx).tries[0]).not.toHaveProperty('style');
  });

  test('the ghost shows the chosen style', () => {
    const ctx = setup();
    const shape = resolveShape(ctx.world, terrain);
    const host = {
      world: ctx.world,
      terrain,
      shape,
      can: (e: Parameters<typeof canApply>[2]) => canApply(ctx.world, terrain, e),
      preview: (w: typeof ctx.world) => resolveShape(w, terrain),
    };
    const ghost = ghostFor(planUse({ item: 'house', swatch: 3, style: 5 }, pickAt(ctx, 20.5, 20.5), ctx), host)!;
    const s = ghost.plan.structures.get(ghost.show[0]!)!;
    expect(structureStyle(ghost.plan.world, s)).toBe(5);
    // Built on top of the style-4 house, the new block joins it, and the house keeps its own style.
    const onTop = ghostFor(planUse({ item: 'house', swatch: 'auto', style: 5 }, pickAt(ctx, 10.5, 10.5), ctx), host)!;
    expect(structureStyle(onTop.plan.world, onTop.plan.structures.get(onTop.show[0]!)!)).toBe(4);
  });

  test('Alt-click copies kind, colour and style; Random copies as 0; the ground copies nothing', () => {
    const ctx = setup();
    expect(copyLook(pickAt(ctx, 10.5, 10.5), ctx)).toEqual({ item: 'house', swatch: 6, style: 4 });
    expect(copyLook(pickAt(ctx, 14.5, 10.5), ctx)).toEqual({ item: 'house', swatch: 2, style: 0 });
    expect(copyLook(pickAt(ctx, 18.5, 10.5), ctx)).toMatchObject({ item: 'tree', style: 0 });
    expect(copyLook(pickAt(ctx, 30.5, 30.5), ctx)).toBeNull();
    // What was copied places the same look again.
    const copied = copyLook(pickAt(ctx, 10.5, 10.5), ctx)!;
    const edit = planUse({ item: copied.item, swatch: copied.swatch, style: copied.style }, pickAt(ctx, 30.5, 30.5), ctx).tries[0]!;
    expect(applyEdit(ctx.world, terrain, edit).blocks.get(key(30, 1, 30))).toMatchObject({ kind: 'house', color: 6, style: 4 });
  });

  test('every style has a drawing that follows the wall colour; 0 is the dice', () => {
    for (let style = 1; style <= 6; style++) {
      expect(styleIcon(style, 0)).not.toBe(styleIcon(style, 4));
      for (let other = style + 1; other <= 6; other++) expect(styleIcon(style, 2)).not.toBe(styleIcon(other, 2));
    }
    expect(styleIcon(0, 3)).toBe(styleIcon(0, 5));
  });
});
