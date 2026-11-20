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
import { houseStyle } from '@/style/houses';
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
    // On top of the style-4 house (colour 6), a style-5 block takes style 5's colour: its own building.
    const apart = ghostFor(planUse({ item: 'house', swatch: 'auto', style: 5 }, pickAt(ctx, 10.5, 10.5), ctx), host)!;
    expect(apart.plan.structures.get(apart.show[0]!)!.cells).toHaveLength(1);
    // In the house's own colour it joins, the ghost shows the whole house, and it keeps its own style.
    const onTop = ghostFor(planUse({ item: 'house', swatch: 6, style: 5 }, pickAt(ctx, 10.5, 10.5), ctx), host)!;
    const joined = onTop.plan.structures.get(onTop.show[0]!)!;
    expect(joined.cells).toHaveLength(2);
    // The building it joins is framed; a block standing alone frames nothing.
    expect(onTop.shimmer).toEqual([key(10, 1, 10)]);
    expect(apart.shimmer).toBeUndefined();
    expect(structureStyle(onTop.plan.world, joined)).toBe(4);
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

describe('one building, not a row of strangers (design section 7)', () => {
  /** Plays clicks straight down onto columns, as a player clicking ground and then roofs would. */
  function play(style: number, columns: readonly (readonly [number, number])[], storeys: number, build: (b: TownBuilder) => void = () => {}): ActionContext {
    const b = new TownBuilder(emptyWorld(1), terrain);
    build(b);
    let ctx: ActionContext = { world: b.world, terrain, rayDir: [-0.5, -0.6, -0.6] };
    for (let storey = 0; storey < storeys; storey++) {
      for (const [x, z] of columns) {
        const edit = planUse({ item: 'house', swatch: 'auto', style }, pickAt(ctx, x + 0.5, z + 0.5), ctx).tries[0]!;
        ctx = { ...ctx, world: applyEdit(ctx.world, terrain, edit) };
      }
    }
    return ctx;
  }
  const rect = (x0: number, z0: number, w: number, d: number): [number, number][] =>
    Array.from({ length: w * d }, (_, i) => [x0 + (i % w), z0 + Math.floor(i / w)] as [number, number]);
  const structuresOf = (ctx: ActionContext): { ids: Set<number>; role: (x: number, y: number, z: number) => string | undefined } => {
    const plan = resolveShape(ctx.world, terrain);
    const houses = [...ctx.world.blocks.keys()].filter((c) => ctx.world.blocks.get(c)!.kind === 'house');
    return { ids: new Set(houses.map((c) => plan.structureAt.get(c)!)), role: (x, y, z) => plan.roles.get(plan.structureAt.get(key(x, y, z))!)?.role };
  };

  test('each style has its own wall colour, and a house of that style takes it on bare ground', () => {
    const walls = [1, 2, 3, 4, 5, 6].map((s) => houseStyle(s)!.wall);
    expect(new Set(walls).size).toBe(6);
    const ctx = setup();
    for (let s = 1; s <= 6; s++) {
      expect(planUse({ item: 'house', swatch: 'auto', style: s }, pickAt(ctx, 20.5, 20.5), ctx).tries[0]).toMatchObject({ color: walls[s - 1], style: s });
      // A set swatch overrides it.
      expect(planUse({ item: 'house', swatch: 7, style: s }, pickAt(ctx, 20.5, 20.5), ctx).tries[0]).toMatchObject({ color: 7, style: s });
    }
    // Random keeps 'auto' (the hashed bare-ground colour, or the colour of the block below).
    expect(planUse({ item: 'house', swatch: 'auto', style: 0 }, pickAt(ctx, 20.5, 20.5), ctx).tries[0]).toMatchObject({ color: 'auto' });
  });

  test('six ground clicks in a 3 × 2 block beside a square, then a storey on each: one inn', () => {
    const ctx = play(3, rect(10, 10, 3, 2), 2, (b) => b.plaza(9, 12, 13, 14));
    const { ids, role } = structuresOf(ctx);
    expect(ids.size).toBe(1);
    expect(role(10, 1, 10)).toBe('inn');
  });

  test('a 5 × 2 footprint is one manor', () => {
    const { ids, role } = structuresOf(play(5, rect(10, 10, 5, 2), 1));
    expect(ids.size).toBe(1);
    expect(role(10, 1, 10)).toBe('manor');
  });

  test('two houses of one style placed apart stay two buildings', () => {
    expect(structuresOf(play(2, [[10, 10], [13, 10]], 1)).ids.size).toBe(2);
  });

  test('with Random, ground clicks start separate buildings as before', () => {
    const ctx = play(0, rect(10, 10, 3, 2), 1);
    for (const b of ctx.world.blocks.values()) expect(b.style).toBeUndefined();
    // Each bare-ground house has its own hashed colour, so the six do not all join.
    expect(structuresOf(ctx).ids.size).toBeGreaterThan(1);
  });
});
