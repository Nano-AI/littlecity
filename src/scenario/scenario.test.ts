import { describe, expect, test } from 'vitest';
import { columnIndex, edgeKey, key } from '@/core/grid';
import { MAT } from '@/core/world';
import { defineRule } from '@/resolve/engine/api';
import { demoRules } from '../../tests/fixtures/demo';
import { buildScenario, checkScenario, createCheck, flatTerrain, resolveScenario, scenario, TerrainBuilder } from './index';
import { collectScenarios, matchScenarios } from './discover';

describe('scenario builder', () => {
  test('helpers build a town through applyEdit', () => {
    const s = scenario({
      name: 'builder-test',
      seed: 3,
      build(b) {
        expect(b.onTerrain(10, 10)).toBe(1);
        b.house(10, 10, { floors: 3, w: 2, d: 2, color: 4 });
        expect(b.onTerrain(10, 10)).toBe(4);
        expect(b.ground(10, 10)).toBe(1);
        b.block('marble', 20, 1, 20).put('tree', 22, 20).stack('pillar', 24, 20, { floors: 2 });
        b.fill('marble', 30, 30, 32, 31, { floors: 2 });
        b.tower(26, 20).auto(28, 20, { floors: 2 });
        b.path(10, 14, 14, 14).path([20, 22], [23, 22], [23, 25]).plaza(30, 20, 31, 21).garden(34, 20);
        b.fenceEdge(34, 20, 'N').fenceEdge(34, 20, 'W').wallEdge(34, 20, 'E').fenceAround(36, 36, 37, 36);
        b.floor('plaza', 22, 20); // under the tree: shares its cell
        b.erase(20, 1, 20).paint(22, 1, 20, 5).setKind(28, 1, 20, 'tower');
      },
    });
    const { world } = buildScenario(s);
    expect(world.blocks.size).toBe(12 + 1 + 2 + 12 + 3 + 2);
    expect([...world.blocks.values()].filter((b) => b.kind === 'house').every((b) => b.color === 4)).toBe(true);
    expect(world.blocks.get(key(26, 3, 20))?.kind).toBe('tower');
    expect(world.blocks.get(key(28, 1, 20))?.kind).toBe('tower');
    expect(world.blocks.get(key(22, 1, 20))?.color).toBe(5);
    expect(world.floors.get(key(12, 1, 14))).toBe('path');
    expect([[20, 22], [21, 22], [22, 22], [23, 22], [23, 23], [23, 24], [23, 25]].every(([x, z]) => world.floors.get(key(x!, 1, z!)) === 'path')).toBe(true);
    expect(world.floors.get(key(22, 1, 20))).toBe('plaza');
    expect(world.edges.get(edgeKey(34, 1, 19, 'S'))).toBe('fence'); // N side of (34, 20)
    expect(world.edges.get(edgeKey(33, 1, 20, 'E'))).toBe('fence'); // W side
    expect(world.edges.get(edgeKey(34, 1, 20, 'E'))).toBe('wall');
    expect(world.edges.size).toBe(3 + 6);
  });

  test('a stack on bare ground with automatic colour merges into one colour', () => {
    const { world } = buildScenario(scenario({ name: 'auto-colour', seed: 11, build: (b) => void b.house(10, 10, { floors: 2, w: 3 }) }));
    expect(new Set([...world.blocks.values()].map((b) => b.color)).size).toBe(1);
  });

  test('an illegal step fails with the scenario, the step and the reason', () => {
    const bad = scenario({ name: 'bad-step', seed: 1, build: (b) => void b.block('house', 10, 1, 10).block('house', 10, 1, 10) });
    expect(() => buildScenario(bad)).toThrow("scenario 'bad-step': house at (10, 1, 10): something is already there");
    expect(() => scenario({ name: 'has spaces', seed: 1, build() {} })).toThrow(/file name/);
  });

  test('terrain: flat by default, generated on request, or hand-made', () => {
    const flat = buildScenario(scenario({ name: 't-flat', seed: 1, build() {} })).terrain;
    expect(flat.height).toEqual(flatTerrain(1).height);
    expect(flat.height[columnIndex(4, 4)]).toBe(1);
    expect(flat.height[columnIndex(3, 4)]).toBe(0);
    expect(flat.material[columnIndex(4, 10)]).toBe(MAT.sand);
    expect(flat.material[columnIndex(20, 20)]).toBe(MAT.grass);
    expect(flat.material[columnIndex(0, 0)]).toBe(MAT.water);
    const custom = buildScenario(
      scenario({ name: 't-custom', seed: 1, terrain: (t) => t.flat().rect(10, 10, 12, 12, 4).disc(30, 30, 2, 0).set(5, 5, 99), build() {} }),
    ).terrain;
    expect(custom.height[columnIndex(11, 11)]).toBe(4);
    expect(custom.height[columnIndex(30, 30)]).toBe(0);
    expect(custom.height[columnIndex(5, 5)]).toBe(10); // clamped to the tallest terrain (a steep island of generator 2)
    expect(new TerrainBuilder(1).build().height.every((h) => h === 0)).toBe(true);
    const generated = buildScenario(scenario({ name: 't-gen', seed: 5, terrain: 'generated', build() {} })).terrain;
    expect(generated.seed).toBe(5);
  });

  test('cameras: the given ones, or one that frames what was built', () => {
    const given = buildScenario(scenario({ name: 'c1', seed: 1, build() {}, cameras: [{ yaw: 10, pitch: 30, zoom: 2, target: [1, 2, 3] }] }));
    expect(given.cameras).toHaveLength(1);
    const framed = buildScenario(scenario({ name: 'c2', seed: 1, build: (b) => void b.house(10, 20).house(14, 20) })).cameras[0]!;
    expect(framed.target[0]).toBeCloseTo(12.5, 6);
    expect(framed.target[2]).toBeCloseTo(20.5, 6);
    expect(framed.zoom).toBeGreaterThan(2);
  });
});

describe('scenario checks', () => {
  const s = scenario({
    name: 'check-test',
    seed: 2,
    build: (b) => void b.house(10, 10).house(13, 10).house(16, 10).house(19, 10).path(10, 11, 19, 11).put('tree', 30, 30),
    expect(plan, dressing, check) {
      check.kind(10, 1, 10, 'house');
      check.role(10, 1, 10, 'cottage');
      check.differentStructures([10, 1, 10], [13, 1, 10]);
      check.hasFeature({ type: 'door', on: [10, 1, 10], dir: 2 });
      check.hasFeature({ type: 'chimney' }, 4);
      check.noFeature({ type: 'balcony' });
      check.hasSocket({ type: 'chimney-top', at: [13, 1, 10] });
      check.hasActor({ type: 'smoke' }, 4);
      check.noProp({ type: 'flag' });
      check.equal(check.applied('R-X01.demo-cottage'), 4, 'cottages');
      check.ok(dressing.props.length === check.props({ type: 'lamp' }).length, 'only lamps');
      check.floorStructure(10, 1, 11);
      check.ok(plan.roles.size === 4, 'four roles');
    },
  });

  test('expect() runs against both plans', () => {
    const r = resolveScenario(s, { rules: demoRules });
    expect(() => s.expect!(r.shape, r.dressing, createCheck(r.shape, r.dressing, s.name))).not.toThrow();
  });

  test('a failed check names the scenario and what was expected', () => {
    const r = resolveScenario(s, { rules: demoRules });
    const check = createCheck(r.shape, r.dressing, s.name);
    expect(() => check.role(10, 1, 10, 'shop')).toThrow('[check-test] role at (10, 1, 10): expected shop, got cottage (from R-X01.demo-cottage)');
    expect(() => check.kind(10, 1, 10, 'tower')).toThrow(/expected tower, got house/);
    expect(() => check.hasFeature({ type: 'balcony' })).toThrow(/expected at least 1 feature\(s\) matching \{"type":"balcony"\}, found 0/);
    expect(() => check.noFeature({ type: 'door' })).toThrow(/expected no feature/);
    expect(() => check.structure(40, 1, 40)).toThrow(/no block structure/);
    expect(() => check.ok(false, 'told you')).toThrow('[check-test] told you');
    // checkScenario resolves with the discovered rules, not the demo ones this expect() was written
    // for, so it fails (on whichever check the real rules do not happen to satisfy).
    expect(() => checkScenario(s)).toThrow(/^\[check-test\] /);
  });
});

describe('scenario rules', () => {
  test('a scenario can bring its own rules, e.g. to show a part in isolation', () => {
    const show = defineRule({
      id: 'G-LAMP.show', part: 'decoration', tier: 1, priority: 0,
      find: () => (['post', 'four-arm', 'bridge', 'pier'] as const).map((variant, i) => ({ anchor: key(10 + i * 2, 1, 10), data: variant })),
      apply: (c, out) => void out.prop({ type: 'lamp', variant: c.data, at: { cell: c.anchor, pos: 'c' } }),
    });
    const s = scenario({
      name: 'gallery-lamp', seed: 1, rules: [show], build() {},
      expect: (_plan, _dressing, check) => void check.hasProp({ type: 'lamp', rule: 'G-LAMP.show' }, 4),
    });
    // Its own props only: the discovered rules dress even an empty island (D24 wild ground).
    expect(checkScenario(s).dressing.props.filter((p) => p.rule === 'G-LAMP.show').map((p) => p.variant)).toEqual(['post', 'four-arm', 'bridge', 'pier']);
  });
});

describe('the fixture shown in docs/swarm/CONTRACTS.md', () => {
  test('a rule fixture is a scenario with an expect()', () => {
    const fixture = scenario({
      name: 'D-X01.demo-lamp', seed: 7,
      rules: demoRules, // a real fixture needs no `rules`: its rule is discovered in src/rules
      build(b) {
        for (let i = 0; i < 8; i++) b.house(10 + i * 2, 10);
      },
      cameras: [{ yaw: 45, pitch: 32, zoom: 3, target: [17, 1, 10] }],
      expect(_plan, _dressing, check) {
        check.ok(check.applied('D-X01.demo-lamp') > 0, 'some doors get a lamp');
        check.hasProp({ type: 'lamp', rule: 'D-X01.demo-lamp' });
        check.noProp({ type: 'lamp', at: [10, 1, 10] }); // never inside a house
      },
    });
    // Resolved with the demo rules alone: the real house rules add doors and chimneys of their own.
    const r = resolveScenario(fixture, { rules: [] });
    fixture.expect!(r.shape, r.dressing, createCheck(r.shape, r.dressing, fixture.name));
    expect(r.dressing.props.length).toBeGreaterThan(0);
    expect(r.dressing.props.length).toBeLessThan(8);
  });
});

describe('scenario discovery', () => {
  const a = scenario({ name: 'R-H01.chapel', seed: 1, build() {} });
  const b = scenario({ name: 'laundry-alley', seed: 1, build() {} });
  const mods = { '/scenarios/rules/R-H01.chapel.scenario.ts': { default: a }, '/scenarios/towns/laundry-alley.scenario.ts': { default: b } };

  test('collects default exports, sorted by name; names are unique', () => {
    expect(collectScenarios(mods).map((e) => e.scenario.name)).toEqual(['R-H01.chapel', 'laundry-alley']);
    expect(() => collectScenarios({ ...mods, '/scenarios/x.scenario.ts': { default: a } })).toThrow(/used by both/);
    expect(() => collectScenarios({ '/scenarios/empty.scenario.ts': {} })).toThrow(/exports no scenario/);
  });

  test('globs match names and paths', () => {
    const entries = collectScenarios(mods);
    const names = (p?: string): string[] => matchScenarios(p, entries).map((e) => e.scenario.name);
    expect(names()).toHaveLength(2);
    expect(names('R-H*')).toEqual(['R-H01.chapel']);
    expect(names('rules/**')).toEqual(['R-H01.chapel']);
    expect(names('towns/*')).toEqual(['laundry-alley']);
    expect(names('laundry')).toEqual(['laundry-alley']);
    expect(names('laundry-alley')).toEqual(['laundry-alley']);
    expect(names('*')).toHaveLength(2);
    expect(names('zzz')).toEqual([]);
  });
});
