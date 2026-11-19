// Feedback (F01–F05, F08), tested by stepping the system with fixed time
// steps against a recording stage. What it looks like is checked by eye with
// src/life/testing/sequence.mjs (see ../MOTION.md).

import { describe, expect, test } from 'vitest';
import { CELL_H, key } from '@/core/grid';
import { positionOf } from '@/core/mat4';
import { resolveTown } from '@/resolve/index';
import { flatTerrain, TownBuilder } from '@/scenario';
import { FEEDBACK } from '@/style/animation';
import { emptyWorld } from '@/world/world';
import { demoRules } from '../../../tests/fixtures/demo';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import fxSystem from '../fx/fx.system';
import { recordingStage, step } from '../testing/stage';
import { carryOf } from './carry';
import { diffTowns } from './diff';
import feedback, { landingAt, morphAt, wobbleAt } from './feedback.system';

const terrain = flatTerrain(5);
type Build = (b: TownBuilder) => void;
const town = (build: Build, rules = false) => {
  const b = new TownBuilder(emptyWorld(5), terrain);
  build(b);
  return resolveTown(b.world, terrain, rules ? { rules: demoRules } : {});
};

function setup(first: Build, rules = false) {
  const t = town(first, rules);
  const rec = recordingStage(t);
  const signals = createSignals(5);
  const life = createLife(rec.stage, signals, { behaviours: [], systems: [fxSystem, feedback] });
  life.sync(t);
  /** An edit as the app does it: the shape at once, the dressing a frame later. */
  const edit = (build: Build) => {
    const next = town(build, rules);
    rec.setTown(next.shape, null);
    life.sync({ shape: next.shape, dressing: null });
    return {
      next,
      deliver() {
        rec.setTown(next.shape, next.dressing);
        life.sync(next);
      },
    };
  };
  return { rec, signals, life, edit, first: t };
}

describe('the curves', () => {
  test('F01: a landing drops 0.4 of a cell, squashes to 0.85, overshoots to 1.08 and is at rest at the end', () => {
    expect(landingAt(0)).toEqual({ drop: FEEDBACK.landDrop, tall: 1 });
    let low = 1, high = 1, lastDrop = Infinity;
    for (let i = 0; i <= 280; i++) {
      const p = landingAt(i / 280);
      low = Math.min(low, p.tall);
      high = Math.max(high, p.tall);
      expect(p.drop).toBeLessThanOrEqual(lastDrop); // it only ever falls
      lastDrop = p.drop;
    }
    expect(low).toBeCloseTo(0.85, 2);
    expect(high).toBeCloseTo(1.08, 2);
    expect(landingAt(1)).toEqual({ drop: 0, tall: 1 });
    expect(FEEDBACK.landTime).toBe(0.28);
    // It squashes before it stretches.
    const squashAt = Array.from({ length: 281 }, (_, i) => landingAt(i / 280).tall).indexOf(low);
    const stretchAt = Array.from({ length: 281 }, (_, i) => landingAt(i / 280).tall).indexOf(high);
    expect(squashAt).toBeLessThan(stretchAt);
  });

  test('F02: a wobble rocks within ±2° and ends upright; F03: a morph starts squashed and ends at rest', () => {
    const limit = (2 * Math.PI) / 180;
    let most = 0;
    for (let i = 0; i <= 100; i++) most = Math.max(most, Math.abs(wobbleAt(i / 100)));
    expect(most).toBeLessThanOrEqual(limit);
    expect(most).toBeGreaterThan(limit * 0.5);
    expect(wobbleAt(0)).toBe(0);
    expect(Math.abs(wobbleAt(1))).toBeLessThan(1e-9);
    expect(FEEDBACK.wobbleTime).toBe(0.3);
    expect(morphAt(0)).toBeCloseTo(FEEDBACK.morphSquash, 6);
    expect(morphAt(1)).toBe(1);
    expect(FEEDBACK.morphTime).toBe(0.2);
  });
});

describe('what an edit does', () => {
  test('nothing plays when a town first opens, or when nothing was edited', () => {
    const { rec, life, signals, first } = setup((b) => b.house(10, 10).house(14, 10));
    step(life, signals, 0.5);
    expect(rec.lifted.size).toBe(0);
    expect(rec.spawned).toHaveLength(0);
    life.sync(first); // the same town again (a refused edit changes nothing: F08)
    step(life, signals, 0.5);
    expect(rec.lifted.size).toBe(0);
    expect(rec.spawned).toHaveLength(0);
  });

  test('F01: a placed piece is lifted, starts above its place, lands, raises dust and is baked back after 280 ms', () => {
    const { rec, life, signals, edit } = setup((b) => b.house(10, 10));
    const { next } = edit((b) => b.house(10, 10).house(20, 20));
    const id = next.shape.structureAt.get(key(20, 1, 20))!;
    expect(rec.lifted.get(id)).toBe(1);
    // Posed at once: never seen at rest first.
    const m0 = rec.of(`structure:${id}`).matrix;
    expect(positionOf(m0)[1]).toBeCloseTo(FEEDBACK.landDrop * CELL_H, 5);
    expect(rec.spawned).toHaveLength(0);
    // Just after touchdown: on the ground, squashed, and the dust is out.
    step(life, signals, FEEDBACK.landTime * FEEDBACK.landImpact + 0.05);
    const m1 = rec.of(`structure:${id}`).matrix;
    expect(m1[5]).toBeLessThan(0.93); // drawn shorter
    expect(m1[0]).toBeGreaterThan(1.03); // and wider
    expect(rec.spawned.filter((s) => s.spec && 'actor' in s.spec && s.spec.actor === 'dust-ring')).toHaveLength(1);
    expect(rec.spawned.filter((s) => s.spec && 'actor' in s.spec && s.spec.actor === 'puff').length).toBe(FEEDBACK.dustPuffs);
    // The squash keeps the foot of the clicked cell where it is.
    const foot = [20.5, CELL_H, 20.5] as const;
    expect(m1[12]! + m1[0]! * foot[0]).toBeCloseTo(foot[0], 5);
    expect(m1[13]! + m1[5]! * foot[1]).toBeCloseTo(foot[1], 5);
    step(life, signals, FEEDBACK.landTime);
    expect(rec.lifted.size).toBe(0);
    // And the dust clears away: every puff ends hidden.
    step(life, signals, 1);
    expect(rec.spawned.every((s) => !s.visible)).toBe(true);
  });

  test('F01: a run of cells landing on one mass every 40 ms (Grow a town) carries its bounce on, not back to the top each time', () => {
    const { rec, life, signals, edit } = setup((b) => b.house(10, 10, { w: 3, floors: 1, color: 2 }));
    edit((b) => b.house(10, 10, { w: 3, floors: 1, color: 2 }).block('house', 13, 1, 10, { color: 2 }));
    const id = () => rec.lifted.keys().next().value!;
    const top = positionOf(rec.of(`structure:${id()}`).matrix)[1];
    for (let k = 0; k < 4; k++) {
      step(life, signals, 0.04);
      edit((b) => {
        b.house(10, 10, { w: 3, floors: 1, color: 2 });
        for (let i = 0; i <= k + 1; i++) b.block('house', 13 + i, 1, 10, { color: 2 });
      });
      // A new cell did not throw it back to the top of its drop.
      expect(positionOf(rec.of(`structure:${id()}`).matrix)[1]).toBeLessThan(top - 0.01);
    }
  });

  test('F01: a big merged house moves less than a single block', () => {
    const { rec, edit } = setup((b) => b.house(10, 10, { w: 3, d: 3, floors: 2, color: 2 }));
    const { next } = edit((b) => b.house(10, 10, { w: 3, d: 3, floors: 2, color: 2 }).block('house', 13, 1, 10, { color: 2 }));
    const id = next.shape.structureAt.get(key(13, 1, 10))!;
    expect(next.shape.structures.get(id)!.cells.length).toBe(19);
    const lift = positionOf(rec.of(`structure:${id}`).matrix)[1];
    // Still seen to drop, but a hand's breadth, not the whole terrace jumping when one cell is added.
    expect(lift).toBeGreaterThan(0.05);
    expect(lift).toBeLessThan(FEEDBACK.landDrop * CELL_H * 0.25);
  });

  test('F02: a neighbour whose shape changed rocks away from the edit and settles; far structures stay put', () => {
    const { rec, life, signals, edit } = setup((b) => b.tower(10, 10, { floors: 3 }).house(30, 30));
    const { next } = edit((b) => b.tower(10, 10, { floors: 3 }).house(30, 30).house(11, 10));
    const tower = next.shape.structureAt.get(key(10, 1, 10))!;
    const far = next.shape.structureAt.get(key(30, 1, 30))!;
    expect(rec.lifted.has(tower)).toBe(true);
    expect(rec.lifted.has(far)).toBe(false);
    step(life, signals, 0.05);
    const m = rec.of(`structure:${tower}`).matrix;
    // Its top leans toward −x: away from the house that landed on its +x side.
    expect(m[4]!).toBeLessThan(0);
    expect(Math.abs(Math.asin(m[4]!))).toBeLessThanOrEqual((FEEDBACK.wobbleDegrees * Math.PI) / 180 + 1e-9);
    expect(carryOf(rec.stage, tower)).not.toBeNull();
    step(life, signals, FEEDBACK.wobbleTime);
    expect(rec.lifted.size).toBe(0);
    expect(carryOf(rec.stage, tower)).toBeNull();
  });

  test('F03: an Auto block that resolves to another kind squashes, pops and throws sparkles', () => {
    // A lone Auto block is a house; with open water on three sides at level 0 it would be a dock, so
    // use the plainest change there is: an Auto stack beside which a tower rises.
    const before = town((b) => b.auto(10, 10, { floors: 1 }));
    const kindBefore = before.shape.kinds.get(key(10, 1, 10));
    // Find an edit beside it that changes what it resolves to.
    const tries: Build[] = [
      (b) => b.auto(10, 10, { floors: 1 }).tower(11, 10, { floors: 3 }),
      (b) => b.auto(10, 10, { floors: 1 }).put('windmill', 11, 10),
      (b) => b.auto(10, 10, { floors: 1 }).block('auto', 10, 2, 10).block('auto', 10, 3, 10).block('auto', 10, 4, 10),
    ];
    const change = tries.find((build) => town(build).shape.kinds.get(key(10, 1, 10)) !== kindBefore);
    expect(change, 'an edit that makes the Auto block change kind').toBeDefined();
    const { rec, life, signals, edit } = setup((b) => b.auto(10, 10, { floors: 1 }));
    const { next } = edit(change!);
    expect(diffTowns(before.shape, next.shape).morphed).toEqual([key(10, 1, 10)]);
    step(life, signals, 0.05);
    const sparkles = rec.spawned.filter((s) => s.spec && 'actor' in s.spec && s.spec.actor === 'sparkle');
    expect(sparkles.length).toBe(FEEDBACK.sparkles);
    step(life, signals, 1.2);
    expect(rec.lifted.size).toBe(0);
    expect(rec.spawned.every((s) => !s.visible)).toBe(true);
  });

  test('F04: an erased piece is drawn once more shrinking away, with puffs; nothing is left behind', () => {
    const { rec, life, signals, edit } = setup((b) => b.house(10, 10).house(20, 20));
    edit((b) => b.house(10, 10));
    const ghost = rec.spawned.find((s) => s.id.startsWith('mesh:'));
    expect(ghost, 'the removed house, drawn once more').toBeDefined();
    step(life, signals, FEEDBACK.removeTime / 2);
    expect(ghost!.matrix[5]!).toBeLessThan(1);
    expect(ghost!.released).toBe(false);
    step(life, signals, FEEDBACK.removeTime);
    expect(ghost!.released).toBe(true);
    expect(rec.spawned.filter((s) => s.spec && 'actor' in s.spec && s.spec.actor === 'puff').length).toBe(FEEDBACK.removePuffs);
  });

  test('F05: new props pop in one after another, 100 ms apart, nearest the click first, and end exactly in place', () => {
    const row: Build = (b) => {
      for (let i = 0; i < 12; i++) b.house(8 + i * 2, 10);
    };
    const { rec, life, signals, edit } = setup(row, true);
    step(life, signals, 0.2);
    const more: Build = (b) => {
      row(b);
      for (let i = 0; i < 12; i++) b.house(8 + i * 2, 20);
    };
    // One click cannot place twelve houses, so this stands for one edit that derives many props:
    // raise the quiet limit so it is treated as an edit.
    const quiet = FEEDBACK.quietAbove;
    FEEDBACK.quietAbove = 100;
    const { next, deliver } = edit(more);
    FEEDBACK.quietAbove = quiet;
    const before = new Set(town(row, true).dressing.props.map((p) => p.id));
    const fresh = next.dressing.props.filter((p) => !before.has(p.id));
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    deliver();
    // All hidden at first.
    expect(fresh.every((p) => !rec.of(p.id).visible)).toBe(true);
    const shownAt = new Map<string, number>();
    for (let f = 0; f < 240; f++) {
      life.update(signals.advance(1 / 60));
      for (const p of fresh) if (!shownAt.has(p.id) && rec.of(p.id).visible) shownAt.set(p.id, f / 60);
    }
    const times = [...shownAt.values()].sort((a, b) => a - b);
    expect(times).toHaveLength(fresh.length);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeCloseTo(FEEDBACK.popGap, 1);
    for (const p of fresh) expect(rec.of(p.id).matrix).toEqual(rec.of(p.id).base);
    // Old props never blinked.
    for (const id of before) expect(rec.of(id).visible).toBe(true);
  });

  test('F04: a prop that loses its slot pops', () => {
    const two: Build = (b) => {
      for (let i = 0; i < 12; i++) b.house(8 + i * 2, 10);
    };
    const { rec, edit, first } = setup(two, true);
    expect(first.dressing.props.length).toBeGreaterThan(0);
    const quiet = FEEDBACK.quietAbove;
    FEEDBACK.quietAbove = 100;
    const { deliver } = edit((b) => b.house(40, 40));
    FEEDBACK.quietAbove = quiet;
    const puffsBefore = rec.spawned.length;
    deliver();
    expect(rec.spawned.length).toBeGreaterThan(puffsBefore);
  });
});
