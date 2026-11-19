// Birds (L11, L12, L13, L16), tested by stepping the simulation with fixed
// time steps against a recording stage. What they look like is checked by
// eye: scenarios/gallery/part.birds and the sequences named in the L11–L16
// scenario files.

import { describe, expect, test } from 'vitest';
import { CELL_H, key, keyX, keyZ, SEA_Y } from '@/core/grid';
import type { Actor } from '@/resolve/plan';
import { resolveTown } from '@/resolve/index';
import { resolveScenario, TerrainBuilder, TownBuilder, type Scenario } from '@/scenario';
import { BIRDS } from '@/style/birds';
import { MOTION } from '@/style/animation';
import { emptyWorld } from '@/world/world';
import gullsScenario from '../../../scenarios/rules/L11.gulls.scenario';
import pigeonsScenario from '../../../scenarios/rules/L12.pigeons.scenario';
import swiftsScenario from '../../../scenarios/rules/L13.swifts.scenario';
import scatterScenario from '../../../scenarios/rules/L16.scatter.scenario';
import { createLife } from '../runtime';
import { createSignals } from '../signals';
import { recordingStage, step, type Recorded } from '../testing/stage';
import gull from './gull.behaviour';
import pigeon from './pigeon.behaviour';
import scare from './scare.system';
import swift from './swift.behaviour';
import { openWater } from './town';

const BEHAVIOURS = [gull, pigeon, swift];

function live(scn: Scenario) {
  const town = resolveScenario(scn);
  const rec = recordingStage(town);
  const signals = createSignals(scn.seed);
  const life = createLife(rec.stage, signals, { behaviours: BEHAVIOURS, systems: [scare], onError: (what, error) => { throw new Error(`${what}: ${String(error)}`); } });
  life.sync(town);
  const birds = town.dressing.actors.filter((a) => a.type === 'gull' || a.type === 'pigeon' || a.type === 'swift');
  // Each bird spawned its two wings as it was created, in the order of the plan.
  const wingsOf = (a: Actor): [Recorded, Recorded] => {
    const k = birds.indexOf(a);
    return [rec.spawned[k * 2]!, rec.spawned[k * 2 + 1]!];
  };
  const pos = (a: Actor): [number, number, number] => {
    const m = rec.of(a.id).matrix;
    return [m[12]!, m[13]!, m[14]!];
  };
  const of = (type: string): Actor[] => birds.filter((a) => a.type === type);
  return { town, rec, signals, life, birds, wingsOf, pos, of };
}
const finite = (m: ArrayLike<number>): boolean => Array.from(m).every(Number.isFinite);

describe('the rules at their edges', () => {
  const resolve = (terrain: (t: TerrainBuilder) => void, build: (b: TownBuilder) => void) => {
    const t = new TerrainBuilder(3);
    terrain(t);
    const land = t.build();
    const b = new TownBuilder(emptyWorld(3), land);
    build(b);
    return resolveTown(b.world, land);
  };
  const count = (town: ReturnType<typeof resolve>, type: string): number => town.dressing.actors.filter((a) => a.type === type).length;

  test('L11: one gull on a shore with no docks, none on an island of no sea, eight at most', () => {
    const shore = resolve((t) => (t.flat(1), t.water(0, 30, 47, 47)), () => {});
    expect(count(shore, 'gull')).toBe(1);
    expect(shore.dressing.actors.find((a) => a.type === 'gull')!.params).toMatchObject({ index: 0, count: 1, perch: '' });
    expect(count(resolve((t) => t.rect(0, 0, 47, 47, 1), () => {}), 'gull')).toBe(0);
    const harbour = resolve((t) => (t.flat(1), t.water(0, 30, 47, 47)), (b) => {
      for (let x = 4; x < 44; x++) b.block('dock', x, 0, 30);
    });
    expect(count(harbour, 'gull')).toBe(BIRDS.gullMax);
  });

  test('L13: no swifts in a hamlet; a tower of five brings three; long streets bring more, nine at most', () => {
    const land = (t: TerrainBuilder): void => void t.flat(1);
    expect(count(resolve(land, (b) => b.house(10, 10).path(8, 12, 20, 12).tower(14, 10, { floors: 4 })), 'swift')).toBe(0);
    expect(count(resolve(land, (b) => b.tower(14, 10, { floors: 5 })), 'swift')).toBe(3);
    expect(count(resolve(land, (b) => b.path(4, 12, 23, 12)), 'swift')).toBe(3); // 20 cells of street and nothing built
    expect(count(resolve(land, (b) => b.path(4, 12, 43, 12).path(4, 20, 43, 20).house(10, 10)), 'swift')).toBe(9); // 80 ÷ 8 = 10, capped
  });
});

describe('gulls (L11)', () => {
  test('they circle over the water by their dock, come down to sit, and go up again', () => {
    const { town, signals, life, of, pos, wingsOf, rec } = live(gullsScenario);
    const gulls = of('gull');
    const sat = new Set<string>(), flew = new Set<string>();
    let aloft = 0, overWater = 0;
    for (let f = 0; f < 150 * 60; f++) {
      life.update(signals.advance(1 / 60));
      if (f % 6 !== 0) continue;
      for (const g of gulls) {
        const [x, y, z] = pos(g);
        expect(finite(rec.of(g.id).matrix)).toBe(true);
        const home = (g.params as { home: number }).home;
        expect(Math.hypot(x - keyX(home) - 0.5, z - keyZ(home) - 0.5)).toBeLessThan(BIRDS.gullReach + BIRDS.gullRadius + BIRDS.gullRadiusMore + 2);
        expect(y).toBeGreaterThanOrEqual(SEA_Y - 0.05);
        expect(y).toBeLessThan(8);
        if (wingsOf(g)[0].visible) {
          flew.add(g.id);
          // High on its circle (not on the way down or up).
          if (y > SEA_Y + BIRDS.gullHeight - 0.4) {
            aloft++;
            if (openWater(town.shape, Math.floor(x), Math.floor(z))) overWater++;
          }
        } else sat.add(g.id);
      }
    }
    expect(flew.size).toBe(gulls.length);
    expect(sat.size).toBe(gulls.length); // each has a perch or a spot on the water, and used it
    expect(overWater / aloft).toBeGreaterThan(0.8);
  });

  test('a sitting gull sits on its perch; one with none sits on the water', () => {
    const { signals, life, of, pos, wingsOf, rec } = live(gullsScenario);
    const seen = new Map<string, [number, number, number]>();
    for (let f = 0; f < 150 * 60 && seen.size < 4; f++) {
      life.update(signals.advance(1 / 60));
      for (const g of of('gull')) if (!wingsOf(g)[0].visible && !seen.has(g.id)) seen.set(g.id, pos(g));
    }
    for (const g of of('gull')) {
      const perch = (g.params as { perch: string }).perch;
      const at = seen.get(g.id)!;
      if (perch) {
        const frame = rec.stage.socket(perch)!;
        expect(at[0]).toBeCloseTo(frame[12]!, 5);
        expect(at[1]).toBeCloseTo(frame[13]!, 1);
        expect(at[2]).toBeCloseTo(frame[14]!, 5);
      } else expect(at[1]).toBeCloseTo(SEA_Y, 1);
    }
  });
});

describe('pigeons (L12) and the scatter (L16)', () => {
  test('they keep to their plaza on foot, wings folded', () => {
    const { town, signals, life, of, pos, wingsOf } = live(pigeonsScenario);
    const start = new Map(of('pigeon').map((p) => [p.id, pos(p)]));
    let walked = 0;
    for (let f = 0; f < 40 * 60; f++) {
      life.update(signals.advance(1 / 60));
      if (f % 10 !== 0) continue;
      for (const p of of('pigeon')) {
        const [x, y, z] = pos(p);
        // No perch flights in this test's reckoning: on the ground it stands on plaza.
        if (wingsOf(p)[0].visible) continue;
        if (y > CELL_H + 0.15) continue; // sitting on the birdbath
        expect(town.shape.world.floors.get(key(Math.floor(x), 1, Math.floor(z)))).toBe('plaza');
        expect(town.shape.kinds.has(key(Math.floor(x), 1, Math.floor(z)))).toBe(false);
        expect(y).toBeGreaterThan(CELL_H);
      }
    }
    for (const p of of('pigeon')) {
      const [x, , z] = pos(p), [sx, , sz] = start.get(p.id)!;
      if (Math.hypot(x - sx, z - sz) > 0.05) walked++;
      const at = (p.at as { cell: number }).cell;
      expect(Math.hypot(x - keyX(at) - 0.5, z - keyZ(at) - 0.5)).toBeLessThan(BIRDS.pigeonRoam + 1.2);
    }
    expect(walked).toBeGreaterThan(of('pigeon').length / 2);
  });

  test('a block landing within three cells puts them up; the far flock stays; they are down again after five seconds', () => {
    const { town, signals, life, of, pos, wingsOf } = live(pigeonsScenario);
    step(life, signals, 3);
    const square = town.shape.floorAt.get(key(20, 1, 20))!, parade = town.shape.floorAt.get(key(20, 1, 27))!, court = town.shape.floorAt.get(key(30, 1, 20))!;
    const flock = (id: number): Actor[] => of('pigeon').filter((p) => (p.params as { plaza: number }).plaza === id);
    const landing = key(22, 1, 21); // on the square
    const near = flock(square).filter((p) => Math.hypot(pos(p)[0] - 22.5, pos(p)[2] - 21.5) <= BIRDS.scareRadius);
    expect(near.length).toBeGreaterThanOrEqual(3);
    signals.emit('blockLanded', landing);
    step(life, signals, 0.6);
    for (const p of near) {
      expect(wingsOf(p)[0].visible, 'wings out').toBe(true);
      expect(pos(p)[1]).toBeGreaterThan(CELL_H + 0.25);
    }
    // The rest of that flock follows; the court, ten cells off, never stirs.
    step(life, signals, 0.9);
    for (const p of flock(square)) expect(pos(p)[1]).toBeGreaterThan(CELL_H + 0.4);
    for (const p of flock(court)) expect(pos(p)[1]).toBeLessThan(CELL_H + 0.12);
    void parade;
    // Still wheeling at four seconds, over the square (not off across town).
    step(life, signals, 2.5);
    for (const p of flock(square)) {
      const [x, y, z] = pos(p);
      expect(y).toBeGreaterThan(CELL_H + 0.3);
      expect(Math.hypot(x - 22.5, z - 21.5)).toBeLessThan(7);
    }
    // Down again a little after five seconds, each by its own spot, wings folded.
    step(life, signals, BIRDS.pigeonSettle - 4 + 0.5);
    for (const p of flock(square)) {
      const [x, y, z] = pos(p);
      const at = (p.at as { cell: number }).cell;
      expect(wingsOf(p)[0].visible).toBe(false);
      expect(y).toBeLessThan(CELL_H + 0.1);
      expect(Math.hypot(x - keyX(at) - 0.5, z - keyZ(at) - 0.5)).toBeLessThan(1.5);
    }
  });

  test('a person walking through puts up only the pigeons at their feet', () => {
    const { signals, life, of, pos, wingsOf } = live(pigeonsScenario);
    step(life, signals, 2);
    const p0 = of('pigeon')[0]!;
    const [x, , z] = pos(p0);
    signals.emit('personPassed', key(Math.floor(x), 1, Math.floor(z)));
    step(life, signals, 0.5);
    expect(wingsOf(p0)[0].visible).toBe(true);
    const far = of('pigeon').filter((p) => Math.hypot(pos(p)[0] - x, pos(p)[2] - z) > 6);
    expect(far.length).toBeGreaterThan(5);
    for (const p of far) expect(wingsOf(p)[0].visible).toBe(false);
  });

  test('L16: a sitting gull within three cells of a landing block takes off; one far away sits on', () => {
    const { signals, life, of, pos, wingsOf } = live(scatterScenario);
    // Wait until a gull is sitting.
    let sitter: Actor | undefined;
    for (let f = 0; f < 200 * 60 && !sitter; f++) {
      life.update(signals.advance(1 / 60));
      sitter = of('gull').find((g) => !wingsOf(g)[0].visible);
    }
    expect(sitter).toBeDefined();
    step(life, signals, 0.5);
    const [x, y, z] = pos(sitter!);
    // Far away: nothing.
    signals.emit('blockLanded', key(Math.min(43, Math.floor(x) + 8), 1, 10));
    step(life, signals, 0.3);
    expect(wingsOf(sitter!)[0].visible).toBe(false);
    // Two cells away: up it goes.
    signals.emit('blockLanded', key(Math.floor(x) + 2, 1, Math.floor(z)));
    step(life, signals, 0.3);
    expect(wingsOf(sitter!)[0].visible).toBe(true);
    step(life, signals, 1.5);
    expect(pos(sitter!)[1]).toBeGreaterThan(y + 0.4);
  });
});

describe('swifts (L13)', () => {
  test('they loop round their tower without flying through it, near its top', () => {
    const { town, signals, life, of, pos, rec } = live(swiftsScenario);
    signals.hold('dusk'); // all of them out
    step(life, signals, 4);
    const far = new Map<string, number>();
    for (let f = 0; f < 60 * 60; f++) {
      life.update(signals.advance(1 / 60));
      for (const s of of('swift')) {
        const p = s.params as { around: number; home: number; height: number };
        const [x, y, z] = pos(s);
        expect(finite(rec.of(s.id).matrix)).toBe(true);
        expect(rec.of(s.id).visible).toBe(true);
        const d = Math.hypot(x - keyX(p.home) - 0.5, z - keyZ(p.home) - 0.5);
        expect(d).toBeGreaterThan(0.62); // clear of the tower's walls
        expect(d).toBeLessThan(9);
        expect(y).toBeGreaterThan(p.height * CELL_H - 0.3);
        expect(y).toBeLessThan(7 * CELL_H + 2.6); // the six-storey tower's top, its cap, and the swift's own lift
        far.set(s.id, Math.max(far.get(s.id) ?? 0, d));
        // Never inside any block.
        expect(town.shape.kinds.has(key(Math.floor(x), Math.floor(y / CELL_H), Math.floor(z)))).toBe(false);
      }
    }
    for (const d of far.values()) expect(d).toBeGreaterThan(2.5); // the far lobe of the eight
  });

  test('all are out at dusk, most by day, few at night; and they are faster at dusk', () => {
    const { signals, life, of, pos, rec } = live(swiftsScenario);
    const out = (): number => of('swift').filter((s) => rec.of(s.id).visible).length;
    const speed = (): number => {
      const s = of('swift').find((a) => (a.params as { index: number }).index === 0)!;
      let dist = 0, last = pos(s);
      for (let f = 0; f < 120; f++) {
        life.update(signals.advance(1 / 60));
        const now = pos(s);
        dist += Math.hypot(now[0] - last[0], now[1] - last[1], now[2] - last[2]);
        last = now;
      }
      return dist / 2;
    };
    step(life, signals, 3);
    expect(out()).toBe(3); // ceil(5 × 0.6)
    const byDay = speed();
    signals.hold('dusk');
    step(life, signals, 3);
    expect(out()).toBe(5);
    const atDusk = speed();
    expect(atDusk).toBeGreaterThan(byDay * 1.2);
    expect(byDay).toBeGreaterThan(BIRDS.swiftSpeed * 0.7);
    signals.hold('night');
    step(life, signals, 3);
    expect(out()).toBe(2); // ceil(5 × 0.25)
  });
});

describe('all birds', () => {
  test('wings follow the body every frame but beat on twos', () => {
    const { signals, life, of, wingsOf, rec } = live(scatterScenario);
    step(life, signals, 1);
    // A gull on the wing: the lift of its wing (the wing's span against the body's up) changes only on a new drawing.
    const g = of('gull').find((a) => wingsOf(a)[0].visible)!;
    expect(g).toBeDefined();
    const wing = wingsOf(g)[0];
    const lift = (): number => {
      const b = rec.of(g.id).matrix, w = wing.matrix;
      return w[0]! * b[4]! + w[1]! * b[5]! + w[2]! * b[6]!;
    };
    let changes = 0, last = lift();
    const moved = wing.moves;
    for (let f = 0; f < 120; f++) {
      life.update(signals.advance(1 / 60));
      const now = lift();
      if (Math.abs(now - last) > 1e-9) changes++;
      last = now;
    }
    expect(wing.moves - moved).toBe(120); // travel is smooth
    expect(changes).toBeLessThanOrEqual(2 * MOTION.poseFps + 1); // the pose is on twos
    expect(changes).toBeGreaterThanOrEqual(6);
  });

  test('the same town at the same time moves the same way', () => {
    const run = (): number[] => {
      const { signals, life, birds, rec } = live(scatterScenario);
      step(life, signals, 4);
      signals.emit('blockLanded', key(21, 1, 22));
      step(life, signals, 3);
      return birds.flatMap((b) => rec.of(b.id).matrix);
    };
    expect(run()).toEqual(run());
  });

  test('state survives a re-resolve: no bird starts over, no wing is spawned twice', () => {
    const { town, signals, life, birds, rec, pos } = live(scatterScenario);
    step(life, signals, 5);
    const before = birds.map((b) => pos(b));
    const wings = rec.spawned.length;
    const again = resolveScenario(scatterScenario);
    rec.setTown(again.shape, again.dressing);
    life.sync(again);
    life.update(signals.advance(1 / 60));
    expect(rec.spawned.length).toBe(wings);
    birds.forEach((b, i) => {
      const now = pos(b);
      expect(Math.hypot(now[0] - before[i]![0], now[1] - before[i]![1], now[2] - before[i]![2])).toBeLessThan(0.25);
    });
    void town;
  });

  test('dispose releases every wing', () => {
    const { life, birds, rec, signals } = live(scatterScenario);
    step(life, signals, 1);
    expect(rec.spawned).toHaveLength(birds.length * 2);
    expect(rec.spawned.every((w) => w.spec && 'actor' in w.spec && w.spec.actor === 'bird-wing')).toBe(true);
    life.dispose();
    expect(rec.spawned.every((w) => w.released)).toBe(true);
  });

  test('thirty birds cost well under 0.2 ms a frame', () => {
    const { life, birds, signals } = live(pigeonsScenario); // 23 pigeons, a gull, swifts
    step(life, signals, 2);
    signals.emit('blockLanded', key(22, 1, 21)); // the busiest they get
    const frames = 1200;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) life.update(signals.advance(1 / 60));
    const perFrame = (performance.now() - t0) / frames;
    const thirty = (perFrame / birds.length) * 30;
    console.log(`birds: ${birds.length} birds cost ${(perFrame * 1000).toFixed(1)} µs a frame (${(thirty * 1000).toFixed(1)} µs for thirty)`);
    expect(thirty).toBeLessThan(0.2);
  });
});
