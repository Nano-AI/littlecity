import { describe, expect, test } from 'vitest';
import { key } from '@/core/grid';
import { flatTerrain, TownBuilder } from '@/scenario';
import { emptyWorld } from '@/world/world';
import { resolveDressing, resolveShape } from '../index';
import { demoRules } from '../../../tests/fixtures/demo';
import { defineFact, type Facts } from './api';
import { featuresOfType, socketsOfType } from './plan-index.fact';
import { townFacts } from './town.fact';

function town(): { facts: Facts; shape: ReturnType<typeof resolveShape> } {
  const terrain = flatTerrain(1);
  const b = new TownBuilder(emptyWorld(1), terrain);
  b.house(10, 10, { floors: 2 }).tower(14, 10, { floors: 3 }).put('tree', 16, 10);
  const shape = resolveShape(b.world, terrain, { rules: demoRules });
  return { facts: shape.facts, shape };
}

describe('facts', () => {
  test('a fact is computed once per resolve and cached', () => {
    let runs = 0;
    const counted = defineFact('counted', (f) => {
      runs++;
      return f.kinds.size;
    });
    const { facts } = town();
    expect(counted(facts)).toBe(6);
    expect(facts.get(counted)).toBe(6);
    expect(counted(facts)).toBe(6);
    expect(runs).toBe(1);
    counted(town().facts); // a new resolve computes it again
    expect(runs).toBe(2);
  });

  test('facts can read other facts; a cycle is reported', () => {
    const blocks = defineFact('blocks', (f) => townFacts(f).blocks);
    expect(blocks(town().facts)).toBe(6);
    const a: ReturnType<typeof defineFact<number>> = defineFact('a', (f) => b(f) + 1);
    const b = defineFact('b', (f): number => a(f) + 1);
    expect(() => a(town().facts)).toThrow(/depends on itself/);
  });

  test('townFacts counts kinds', () => {
    const t = townFacts(town().facts);
    expect(t.cellsByKind.get('house')).toBe(2);
    expect(t.cellsByKind.get('tower')).toBe(3);
    expect(t.topLevel).toBe(3);
  });

  test('facts.shape is for dressing-stage rules only', () => {
    const terrain = flatTerrain(1);
    const world = new TownBuilder(emptyWorld(1), terrain).house(10, 10).world;
    let sawError = '';
    resolveShape(world, terrain, {
      rules: [
        {
          $type: 'rule', id: 'J-T.peek', part: 'joinery', tier: 1, priority: 0,
          find(ctx) {
            try {
              void ctx.facts.shape;
            } catch (e) {
              sawError = (e as Error).message;
            }
            return [];
          },
          apply() {},
        },
      ],
    });
    expect(sawError).toMatch(/shape stage/);
    const { facts } = town();
    expect(facts.shapeReady).toBe(true);
    // The two-storey house is one structure: one door at the bottom, one chimney on top.
    expect(featuresOfType(facts, 'door')).toHaveLength(1);
    expect(socketsOfType(facts, 'chimney-top').map((s) => s.cell)).toEqual([key(10, 2, 10)]);
    expect(resolveDressing(town().shape, { rules: demoRules }).actors).toHaveLength(1);
  });
});
