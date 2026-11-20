// The mischief engine, at fixed steps with no drawing and no people.

import { describe, expect, test } from 'vitest';
import { key, type CellKey } from '@/core/grid';
import type { Edit, Terrain, World } from '@/core/world';
import { resolveShape } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { ruinCause, ruinFall, ruinMending, ruinProgress, ruinStage } from '@/world/damage';
import { applyEdit, emptyWorld } from '@/world/world';
import { createMischiefEngine, type Env, type MischiefEngine } from './engine';

const EAST_WIND: Env = { wind: () => ({ dirX: 1, dirZ: 0, strength: 0.7 }) };
const CALM: Env = { wind: () => ({ dirX: 1, dirZ: 0, strength: 0 }) };

class Sim {
  world: World;
  engine: MischiefEngine;
  log: Edit[] = [];
  constructor(
    readonly terrain: Terrain,
    world: World,
    seed = 1,
  ) {
    this.world = world;
    this.engine = createMischiefEngine(seed);
    this.engine.sync(resolveShape(world, terrain));
  }
  flush(): void {
    const edits = this.engine.takeEdits();
    if (edits.length === 0) return;
    for (const e of edits) this.world = applyEdit(this.world, this.terrain, e);
    this.log.push(...edits);
    this.engine.sync(resolveShape(this.world, this.terrain));
  }
  run(seconds: number, env: Env = EAST_WIND): void {
    for (let t = 0; t < seconds; t += 0.5) {
      this.engine.step(0.5, env);
      this.flush();
    }
  }
  stage(x: number, y: number, z: number): number {
    return ruinStage(this.world.blocks.get(key(x, y, z))?.ruin);
  }
}

function town(build: (b: TownBuilder) => void): Sim {
  const terrain = flatTerrain(3);
  const b = new TownBuilder(emptyWorld(3), terrain);
  build(b);
  return new Sim(terrain, b.world);
}

describe('fire', () => {
  test('spreads to an adjacent timber house downwind, and not across a two-cell street', () => {
    const sim = town((b) => {
      b.house(10, 10, { floors: 2, color: 1 });
      b.house(11, 10, { floors: 2, color: 2 }); // touching, downwind (east)
      b.house(14, 10, { floors: 2, color: 3 }); // across a two-cell street (12, 13)
    });
    expect(sim.engine.ignite(key(10, 1, 10))).toBe(true);
    sim.run(90);
    expect(sim.stage(10, 1, 10)).toBe(3);
    expect(sim.stage(10, 2, 10)).toBe(3); // it climbed
    expect(sim.stage(11, 1, 10)).toBeGreaterThanOrEqual(2); // the neighbour caught
    expect(sim.stage(14, 1, 10)).toBe(0);
    expect(sim.stage(14, 2, 10)).toBe(0);
    expect(sim.engine.busy).toBe(false);
  });

  test('upwind, a fire is slower to cross than downwind', () => {
    const at = (env: Env): number => {
      const sim = town((b) => {
        b.house(10, 10, { color: 1 });
        b.house(11, 10, { color: 2 });
      });
      sim.engine.ignite(key(11, 1, 10));
      for (let t = 0; t < 120; t += 0.5) {
        sim.run(0.5, env);
        if (sim.stage(10, 1, 10) > 0) return t;
      }
      return Infinity;
    };
    const westward: Env = { wind: () => ({ dirX: -1, dirZ: 0, strength: 0.8 }) };
    expect(at(westward)).toBeLessThan(at(EAST_WIND));
  });

  test('stone does not burn: a tower only scorches', () => {
    const sim = town((b) => b.tower(10, 10, { floors: 3 }));
    sim.engine.ignite(key(10, 1, 10));
    sim.run(60);
    for (let y = 1; y <= 3; y++) expect(sim.stage(10, y, 10)).toBeLessThanOrEqual(1);
    expect(sim.engine.busy).toBe(false);
  });

  test('a low wall between two houses stops the fire', () => {
    const sim = town((b) => {
      b.house(10, 10, { color: 1 });
      b.house(12, 10, { color: 2 });
      b.put('wall', 11, 10);
    });
    sim.engine.ignite(key(10, 1, 10));
    sim.run(90, { wind: () => ({ dirX: 1, dirZ: 0, strength: 1 }) });
    expect(sim.stage(10, 1, 10)).toBe(3);
    expect(sim.stage(12, 1, 10)).toBe(0);
  });

  test('a fire put out in time leaves the house scorched, not burnt out', () => {
    const sim = town((b) => b.house(10, 10, { color: 1 }));
    sim.engine.ignite(key(10, 1, 10));
    sim.run(5, CALM);
    sim.engine.douse(key(10, 1, 10), 1);
    sim.run(30, CALM);
    expect(sim.stage(10, 1, 10)).toBeGreaterThanOrEqual(1);
    expect(sim.stage(10, 1, 10)).toBeLessThan(3);
    expect(sim.engine.busy).toBe(false);
  });

  test('same town, same click, same seed: the same fire', () => {
    const go = (): Edit[] => {
      const sim = town((b) => {
        for (let i = 0; i < 6; i++) b.house(8 + i, 10, { floors: 1 + (i % 2), color: i });
        b.put('tree', 10, 12);
      });
      sim.engine.ignite(key(9, 1, 10));
      sim.run(60);
      return sim.log;
    };
    expect(go()).toEqual(go());
  });
});

describe('blast', () => {
  test('ruins what is in its blast, cracks what it shakes, and nothing beyond', () => {
    const sim = town((b) => {
      b.house(10, 10, { color: 1 });
      b.house(12, 10, { color: 2 });
      b.house(20, 10, { color: 3 });
    });
    const ev = sim.engine.blast([10.5, 0.85, 10.5], 1);
    sim.flush();
    expect(ev.water).toBe(false);
    expect(sim.stage(10, 1, 10)).toBe(3);
    expect(ruinCause(sim.world.blocks.get(key(10, 1, 10))!.ruin)).toBe('blast');
    expect(sim.stage(12, 1, 10)).toBeGreaterThanOrEqual(1);
    expect(sim.stage(20, 1, 10)).toBe(0);
    // The chunks land: the settling mark goes.
    sim.run(3, CALM);
    expect(sim.world.blocks.get(key(10, 1, 10))!.ruin! & 16).toBe(0);
  });

  test('a destroyed storey brings down the storeys on it', () => {
    const sim = town((b) => b.house(10, 10, { floors: 3, color: 1 }));
    sim.engine.blast([10.5, 0.9, 10.5], 1);
    sim.flush();
    for (let y = 1; y <= 3; y++) expect(sim.stage(10, y, 10)).toBe(3);
  });

  test('a planned blast does nothing until each hit is done, nearest first; trees fall away from it', () => {
    const sim = town((b) => {
      b.house(10, 10, { color: 1 });
      b.put('tree', 13, 10);
    });
    const plan = sim.engine.blastPlan([10.5, 0.85, 10.5], 2);
    expect(plan.hits.length).toBeGreaterThan(1);
    expect(plan.hits.every((h, i) => i === 0 || plan.hits[i - 1]!.d <= h.d)).toBe(true);
    sim.flush();
    expect(sim.stage(10, 1, 10)).toBe(0);
    for (const h of plan.hits) sim.engine.hit(h);
    sim.flush();
    expect(sim.stage(10, 1, 10)).toBe(3);
    // East of the blast: it fell east.
    expect(ruinFall(sim.world.blocks.get(key(13, 1, 10))!.ruin)).toBe(1);
  });

  test('in the water it only soaks', () => {
    const terrain = flatTerrain(3);
    const b = new TownBuilder(emptyWorld(3), terrain);
    b.block('dock', 20, 0, 2);
    const sim = new Sim(terrain, b.world);
    const ev = sim.engine.blast([20.5, 0.4, 1.5], 1);
    sim.flush();
    expect(ev.water).toBe(true);
    expect(sim.stage(20, 0, 2)).toBe(0);
  });

  test('the nuke on water still plans its hits (it used to plan none: a cloud and an untouched town)', () => {
    const terrain = flatTerrain(3);
    const b = new TownBuilder(emptyWorld(3), terrain);
    b.block('dock', 20, 0, 2);
    b.house(20, 6, { color: 1 });
    const sim = new Sim(terrain, b.world);
    const point = [20.5, 0.4, 1.5] as const;
    // A bomb's plan in water is empty; the nuke's is not.
    expect(sim.engine.blastPlan(point, 7).hits).toEqual([]);
    const plan = sim.engine.blastPlan(point, 7, { rim: true, wet: true });
    expect(plan.water).toBe(true);
    expect(plan.hits.length).toBeGreaterThan(1);
    for (const h of plan.hits) sim.engine.hit(h);
    sim.flush();
    expect(sim.stage(20, 1, 6)).toBeGreaterThan(0);
  });
});

describe('knocks and repairs', () => {
  test('a knock is a stage; a repair puts the scaffolding up, then mends a stage at a time, then clears', () => {
    const sim = town((b) => b.house(10, 10, { color: 4 }));
    const c: CellKey = key(10, 1, 10);
    const before = sim.world.blocks.get(c)!;
    sim.engine.applyDamage(c, 'blast', 1);
    sim.flush();
    expect(sim.stage(10, 1, 10)).toBe(1);
    sim.engine.applyDamage(c, 'blast', 5);
    sim.flush();
    expect(sim.stage(10, 1, 10)).toBe(3);
    sim.run(3, CALM);
    const steps: string[] = [];
    for (let i = 0; i < 6; i++) {
      sim.engine.repair(c, 8);
      sim.flush();
      const r = sim.world.blocks.get(c)!.ruin;
      steps.push(r ? `${ruinStage(r)}${ruinMending(r) ? 'm' : ''}${Math.round(ruinProgress(r) * 32)}` : 'sound');
    }
    // The damage it had stays while it is mended; mending goes 32 steps, then it is sound.
    expect(steps).toEqual(['3m7', '3m15', '3m23', '3m31', 'sound', 'sound']);
    expect(sim.world.blocks.get(c)).toEqual(before);
  });
});
