import { describe, expect, test } from 'vitest';
import { key, keyX, type CellKey } from '@/core/grid';
import { rand } from '@/core/rand';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { demoRuleModules, demoRules } from '../../../tests/fixtures/demo';
import { resolveDressing, resolveShape, resolveTown } from '../index';
import { candidateRoll, defineRule, slot, type Rule } from './api';
import { collectRules } from './discover';
import { sortRules } from './run';

const terrain = flatTerrain(5);

/** A row of `n` single-block houses along x, starting at (10, 10). */
function row(n: number, extra?: (b: TownBuilder) => void): TownBuilder {
  const b = new TownBuilder(emptyWorld(5), terrain);
  for (let i = 0; i < n; i++) b.house(10 + i * 2, 10, { color: i % 8 });
  extra?.(b);
  return b;
}
const houses = (ctx: { facts: { structures: ReadonlyMap<number, { kind: string; cells: readonly CellKey[]; id: number }> } }) =>
  [...ctx.facts.structures.values()].filter((s) => s.kind === 'house').map((s) => ({ anchor: s.cells[0]!, structure: s.id }));

describe('discovery', () => {
  test('engine discovers a rule file', () => {
    // demoRuleModules is an import.meta.glob over tests/fixtures/demo/rules/*.rule.ts:
    // the same mechanism src/resolve/engine/discover.ts uses over src/rules.
    expect(Object.keys(demoRuleModules)).toHaveLength(4);
    expect(demoRules.map((r) => r.id)).toEqual(['R-X01.demo-cottage', 'J-X01.demo-door', 'D-X01.demo-lamp', 'L-X01.demo-smoke']);
  });

  test('a rule file with no rule, or a reused id, is an error', () => {
    expect(() => collectRules({ '/src/rules/x.rule.ts': { default: 42 } })).toThrow(/exports no rule/);
    const r = defineRule({ id: 'D99.same', part: 'decoration', tier: 1, priority: 0, find: () => [], apply() {} });
    const r2 = defineRule({ id: 'D99.same', part: 'urban', tier: 1, priority: 0, find: () => [], apply() {} });
    expect(() => collectRules({ '/a.rule.ts': { default: r }, '/b.rule.ts': { default: r2 } })).toThrow(/defined in both/);
    expect(() => defineRule({ id: 'bad id', part: 'roles', tier: 1, priority: 0, find: () => [], apply() {} })).toThrow(/must look like/);
    expect(() => defineRule({ id: 'D98.p', part: 'roles', tier: 1, priority: 0, chance: 0, find: () => [], apply() {} })).toThrow(/chance/);
  });
});

describe('ordering', () => {
  const log: string[] = [];
  const logging = (id: string, part: Rule['part'], priority: number): Rule =>
    defineRule({
      id, part, tier: 1, priority,
      find() {
        log.push(id);
        return [];
      },
      apply() {},
    });

  test('engine orders by priority then id', () => {
    const rules = [
      logging('D02.b', 'decoration', 10),
      logging('L01.life', 'life', 99),
      logging('D01.a', 'decoration', 10),
      logging('D03.first', 'decoration', 50),
      logging('U01.urban', 'urban', 0),
      logging('J01.joinery', 'joinery', -5),
      logging('R-H02.low', 'roles', 1),
      logging('R-H01.high', 'roles', 2),
    ];
    const expected = ['R-H01.high', 'R-H02.low', 'J01.joinery', 'D03.first', 'D01.a', 'D02.b', 'U01.urban', 'L01.life'];
    expect(sortRules(rules).map((r) => r.id)).toEqual(expected);
    log.length = 0;
    resolveTown(row(1).world, terrain, { rules });
    expect(log).toEqual(expected);
  });

  test('candidates run in cell-key order, ties in find() order', () => {
    const seen: string[] = [];
    const rule = defineRule<string>({
      id: 'J02.order', part: 'joinery', tier: 1, priority: 0,
      find: () => [
        { anchor: key(5, 1, 5), data: 'c' },
        { anchor: key(9, 0, 9), data: 'a' },
        { anchor: key(5, 1, 5), data: 'd' },
        { anchor: key(4, 1, 5), data: 'b' },
      ],
      apply(c) {
        seen.push(c.data);
      },
    });
    resolveShape(row(1).world, terrain, { rules: [rule] });
    expect(seen).toEqual(['a', 'b', 'c', 'd']);
  });

  test('a rule sees what earlier rules emitted', () => {
    const shape = resolveShape(row(2).world, terrain, { rules: demoRules });
    // J-X01 reads plan.roles, which R-X01 filled in the part before it.
    expect(shape.features.filter((f) => f.type === 'door')).toHaveLength(2);
    expect([...shape.roles.values()].every((r) => r.role === 'cottage' && r.rule === 'R-X01.demo-cottage')).toBe(true);
  });
});

describe('claims', () => {
  const lampAt = (id: string, priority: number): Rule =>
    defineRule({
      id, part: 'decoration', tier: 1, priority,
      find: houses,
      claims: (c) => [slot.floor(c.anchor, 'c')],
      apply(c, out) {
        out.prop({ type: 'lamp', at: { cell: c.anchor, pos: 'c' } });
      },
    });

  test('claims block a second rule', () => {
    const { dressing } = resolveTown(row(3).world, terrain, { rules: [lampAt('D11.second', 1), lampAt('D10.first', 5)] });
    expect(dressing.props).toHaveLength(3);
    expect(dressing.props.every((p) => p.rule === 'D10.first')).toBe(true);
    const second = dressing.trace.find((t) => t.rule === 'D11.second')!;
    expect(second).toMatchObject({ candidates: 3, applied: 0, claimSkipped: 3 });
    expect(dressing.claims.get(slot.floor(key(10, 1, 10), 'c'))).toBe('D10.first');
  });

  test('a rule that claims a different slot is not blocked', () => {
    const other = defineRule({
      id: 'D12.edge', part: 'decoration', tier: 1, priority: 0,
      find: houses,
      claims: (c) => [slot.floor(c.anchor, 'n')],
      apply(c, out) {
        out.prop({ type: 'boulder', at: { cell: c.anchor, pos: 'n' } });
      },
    });
    const { dressing } = resolveTown(row(2).world, terrain, { rules: [lampAt('D10.first', 5), other] });
    expect(dressing.props).toHaveLength(4);
  });

  test('each structure gets exactly one role: role rules claim the structure', () => {
    const role = (id: string, priority: number, name: 'cottage' | 'shop'): Rule =>
      defineRule({ id, part: 'roles', tier: 1, priority, find: houses, apply: (c, out) => out.role(c.structure!, name) });
    const shape = resolveShape(row(3).world, terrain, { rules: [role('R-H15.cottage', 0, 'cottage'), role('R-H07.shop', 9, 'shop')] });
    expect([...shape.roles.values()].map((r) => r.role)).toEqual(['shop', 'shop', 'shop']);
    expect(shape.trace.find((t) => t.rule === 'R-H15.cottage')).toMatchObject({ applied: 0, claimSkipped: 3 });
  });

  test('a shape-stage claim also blocks dressing-stage rules', () => {
    const early = defineRule({
      id: 'J05.early', part: 'joinery', tier: 1, priority: 0, find: houses,
      claims: (c) => [slot.floor(c.anchor, 'c')],
      apply() {},
    });
    const { dressing } = resolveTown(row(2).world, terrain, { rules: [early, lampAt('D10.first', 5)] });
    expect(dressing.props).toHaveLength(0);
  });
});

describe('chance', () => {
  const half = defineRule({
    id: 'D20.half', part: 'decoration', tier: 1, priority: 0, chance: 0.5,
    find: houses,
    apply(c, out) {
      out.prop({ type: 'boulder', at: { cell: c.anchor, pos: 'c' } });
    },
  });
  const chosen = (b: TownBuilder): number[] =>
    resolveTown(b.world, terrain, { rules: [half] }).dressing.props.map((p) => keyX((p.at as { cell: number }).cell));

  test('chance is stable per anchor', () => {
    const first = chosen(row(16));
    expect(chosen(row(16))).toEqual(first);
    expect(first.length).toBeGreaterThan(3);
    expect(first.length).toBeLessThan(13);
    // An unrelated block far away changes nobody's roll.
    expect(chosen(row(16, (b) => b.house(41, 40))).filter((x) => x !== 41)).toEqual(first);
    // The roll is exactly rand(seed, rule id, anchor).
    for (let i = 0; i < 16; i++) {
      const anchor = key(10 + i * 2, 1, 10);
      expect(candidateRoll(5, 'D20.half', { anchor })).toBe(rand(5, 'D20.half', anchor));
      expect(first.includes(10 + i * 2)).toBe(rand(5, 'D20.half', anchor) < 0.5);
    }
  });

  test('a key gives candidates on one anchor their own rolls and ids', () => {
    const sides = defineRule({
      id: 'D21.sides', part: 'decoration', tier: 1, priority: 0, chance: 0.5,
      find: (ctx) => houses(ctx).flatMap((c) => [0, 1, 2, 3].map((d) => ({ ...c, key: d }))),
      apply(c, out) {
        out.prop({ type: 'boulder', at: { cell: c.anchor, pos: (['n', 'e', 's', 'w'] as const)[c.key as number]! } });
      },
    });
    const { dressing } = resolveTown(row(12).world, terrain, { rules: [sides] });
    expect(dressing.props.length).toBeGreaterThan(12);
    expect(dressing.props.length).toBeLessThan(36);
    expect(new Set(dressing.props.map((p) => p.id)).size).toBe(dressing.props.length);
    expect(dressing.props[0]!.id).toMatch(/^D21\.sides@\d+:[0-3]$/);
  });

  test('apply gets a seeded rand of its own', () => {
    const values: number[] = [];
    const r = defineRule({ id: 'D22.rand', part: 'decoration', tier: 1, priority: 0, find: houses, apply: (_c, _o, ctx) => void values.push(ctx.rand('x')) });
    resolveTown(row(4).world, terrain, { rules: [r] });
    const again: number[] = [];
    const r2 = defineRule({ ...r, apply: (_c, _o, ctx) => void again.push(ctx.rand('x')) });
    resolveTown(row(4).world, terrain, { rules: [r2] });
    expect(again).toEqual(values);
    expect(new Set(values).size).toBe(4);
  });
});

describe('stages and ids', () => {
  test('roles and joinery run in resolveShape; decoration, urban and life in resolveDressing', () => {
    const shape = resolveShape(row(2).world, terrain, { rules: demoRules });
    expect(shape.trace.map((t) => t.rule)).toEqual(['R-X01.demo-cottage', 'J-X01.demo-door']);
    const dressing = resolveDressing(shape, { rules: demoRules });
    expect(dressing.trace.map((t) => t.rule)).toEqual(['D-X01.demo-lamp', 'L-X01.demo-smoke']);
    expect(dressing.actors.map((a) => a.type)).toEqual(['smoke', 'smoke']);
  });

  test('a rule cannot emit into the wrong stage', () => {
    const propInShape = defineRule({ id: 'J90.bad', part: 'joinery', tier: 1, priority: 0, find: houses, apply: (c, out) => void out.prop({ type: 'boulder', at: { cell: c.anchor, pos: 'c' } }) });
    expect(() => resolveShape(row(1).world, terrain, { rules: [propInShape] })).toThrow(/\[rule J90\.bad apply\(\) at cell \d+\] out\.prop is only available to decoration/);
    const roleInDressing = defineRule({ id: 'D90.bad', part: 'decoration', tier: 1, priority: 0, find: houses, apply: (c, out) => out.role(c.structure!, 'shop') });
    expect(() => resolveTown(row(1).world, terrain, { rules: [roleInDressing] })).toThrow(/out\.role is only available to roles and joinery/);
  });

  test('ids are readable, unique and stable', () => {
    const { shape, dressing } = resolveTown(row(2).world, terrain, { rules: demoRules });
    const cell = key(10, 1, 10);
    expect(shape.features.map((f) => f.id)).toContain(`door@${cell}:2`);
    expect(shape.sockets.map((s) => s.id)).toContain(`door@${cell}:2/door`);
    expect(shape.sockets.map((s) => s.id)).toContain(`chimney@${cell}/chimney-top`);
    expect(dressing.actors[0]!.id).toBe(`L-X01.demo-smoke@${cell}`);
    expect(shape.socketsByOwner.get(`door@${cell}:2`)).toHaveLength(1);
    expect(shape.featuresByStructure.get(shape.structureAt.get(cell)!)).toHaveLength(2);
    // The same feature emitted twice gets a suffix instead of colliding.
    const twice = defineRule({
      id: 'J91.twice', part: 'joinery', tier: 1, priority: 0, find: houses,
      apply(c, out) {
        expect(out.feature({ type: 'finial', structure: c.structure!, cell: c.anchor })).toBe(`finial@${c.anchor}`);
        expect(out.feature({ type: 'finial', structure: c.structure!, cell: c.anchor })).toBe(`finial@${c.anchor}~2`);
      },
    });
    expect(resolveShape(row(1).world, terrain, { rules: [twice] }).features).toHaveLength(2);
  });

  test('props from two candidates with the same anchor and no key are refused', () => {
    const dup = defineRule({
      id: 'D92.dup', part: 'decoration', tier: 1, priority: 0,
      find: (ctx) => houses(ctx).flatMap((c) => [c, { ...c }]),
      apply: (c, out) => void out.prop({ type: 'boulder', at: { cell: c.anchor, pos: 'c' } }),
    });
    expect(() => resolveTown(row(1).world, terrain, { rules: [dup] })).toThrow(/distinct key/);
  });

  test('an anchor must name a declared socket', () => {
    const lost = defineRule({ id: 'L92.lost', part: 'life', tier: 1, priority: 0, find: houses, apply: (_c, out) => void out.actor({ type: 'smoke', at: { socket: 'nowhere' } }) });
    expect(() => resolveTown(row(1).world, terrain, { rules: [lost] })).toThrow(/which no rule declared/);
  });

  test('town-wide rules can be switched off', () => {
    const wide = defineRule({ id: 'D93.wide', part: 'decoration', tier: 3, priority: 0, townWide: true, find: houses, apply: (c, out) => void out.prop({ type: 'boulder', at: { cell: c.anchor, pos: 'c' } }) });
    expect(resolveTown(row(2).world, terrain, { rules: [wide] }).dressing.props).toHaveLength(2);
    expect(resolveTown(row(2).world, terrain, { rules: [wide], skipTownWide: true }).dressing.props).toHaveLength(0);
  });

  test('the walking graph is built before the life rules', () => {
    const navSeen: Record<string, unknown> = {};
    const peek = (id: string, part: Rule['part']): Rule =>
      defineRule({
        id, part, tier: 1, priority: 0,
        find(ctx) {
          navSeen[part] = ctx.dressing!.nav;
          return [];
        },
        apply() {},
      });
    resolveTown(row(1).world, terrain, { rules: [peek('D94.peek', 'decoration'), peek('U94.peek', 'urban'), peek('L94.peek', 'life')] });
    expect(navSeen.decoration).toBeNull();
    expect(navSeen.urban).toBeNull();
    expect(navSeen.life).toMatchObject({ nodes: [], links: [] });
  });
});

describe('content hashes', () => {
  const hashes = (b: TownBuilder): Map<number, number> => {
    const shape = resolveShape(b.world, terrain, { rules: demoRules });
    return new Map([...shape.structures.values()].map((s) => [s.cells[0]!, s.hash]));
  };

  test('same world same hashes', () => {
    const a = resolveTown(row(6).world, terrain, { rules: demoRules });
    const b = resolveTown(row(6).world, terrain, { rules: demoRules });
    expect(b.shape.hash).toBe(a.shape.hash);
    expect(b.dressing.hash).toBe(a.dressing.hash);
    expect([...b.shape.structures.values()].map((s) => s.hash)).toEqual([...a.shape.structures.values()].map((s) => s.hash));
    expect(a.shape.hash).not.toBe(0);
    expect(new Set([...a.shape.structures.values()].map((s) => s.hash)).size).toBe(6);
  });

  test('far edit leaves hash unchanged; a touching edit changes it', () => {
    const before = hashes(row(4));
    const far = hashes(row(4, (b) => b.house(30, 30)));
    for (const [cell, h] of before) expect(far.get(cell)).toBe(h);
    const near = hashes(row(4, (b) => b.house(11, 10)));
    expect(near.get(key(10, 1, 10))).not.toBe(before.get(key(10, 1, 10)));
    expect(near.get(key(12, 1, 10))).not.toBe(before.get(key(12, 1, 10)));
    expect(near.get(key(16, 1, 10))).toBe(before.get(key(16, 1, 10)));
  });

  test('a structure hash covers its role and features', () => {
    const plain = resolveShape(row(1).world, terrain, { rules: [] });
    const dressed = resolveShape(row(1).world, terrain, { rules: demoRules });
    const id = plain.structureAt.get(key(10, 1, 10))!;
    expect(dressed.structures.get(id)!.hash).not.toBe(plain.structures.get(id)!.hash);
    expect(dressed.hash).not.toBe(plain.hash);
  });

  test('prop hashes cover content, not ids', () => {
    const a = resolveTown(row(8).world, terrain, { rules: demoRules }).dressing;
    expect(a.props.length).toBeGreaterThan(0);
    for (const p of a.props) expect(p.hash).not.toBe(0);
    expect(new Set(a.props.map((p) => p.hash)).size).toBe(a.props.length);
  });
});
