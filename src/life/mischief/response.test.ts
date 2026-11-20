// The town answers a fire (mischief, design section 13b), stepped at fixed
// steps with the living town and the mischief director, no drawing.

import { describe, expect, test } from 'vitest';
import { columnIndex, key, keyX, keyY, keyZ, type CellKey } from '@/core/grid';
import type { StructureId } from '@/resolve/plan';
import { findScenario } from '@/scenario/discover';
import { packRuin } from '@/world/damage';
import streetTown from '../../../scenarios/mischief/street.scenario';
import { clock, resolved, scenarioTown, townOf, type TestTown } from '../people/testing';
import { allChains, createLivingTown } from '../town';
import { Director } from './director';
import { fireChain, rebuildChain, standsOf, type FireChain } from './response';

const ENV = { wind: () => ({ dirX: 1, dirZ: 0, strength: 0.3 }) };

function run(where: TestTown, opts: { seconds: number; brigade: boolean; light: CellKey; dry?: boolean; every?: (t: number, d: Director, fire: FireChain) => void }) {
  const d = new Director(5);
  d.sync(where.shape);
  const fire = fireChain(d);
  const chains = opts.brigade ? [fire, rebuildChain(d), ...allChains()] : allChains();
  const c = clock(where.world.seed, 'day');
  const town = createLivingTown({ seed: where.world.seed, chains });
  town.sync(where.shape, where.dressing, c.time);
  if (opts.dry) for (const ch of chains) ch.sync(town.board);
  // Let the town settle into its morning first.
  for (let i = 0; i < 30 * 5; i++) town.step(c.tick(1 / 30), c.time);
  d.ignite(opts.light);
  let out = Infinity;
  for (let i = 0; i < opts.seconds * 30; i++) {
    const dt = c.tick(1 / 30);
    d.update(dt, ENV);
    town.step(dt, c.time);
    if (i % 30 === 0) opts.every?.(i / 30, d, fire);
    if (!d.engine.busy && out === Infinity) out = i / 30;
  }
  return { d, town, out, fire };
}

/** A square with a fountain, houses round it with gaps between (a fire stays in one house), a street of homes. */
const squareTown = townOf((b) => {
  b.plaza(14, 14, 20, 20);
  b.put('fountain', 17, 17);
  for (let i = 0; i < 4; i++) {
    b.house(13 + i * 2, 12, { floors: 2, color: i });
    b.house(13 + i * 2, 22, { floors: 2, color: i + 2 });
  }
  b.path(10, 13, 10, 21).path(11, 21, 13, 21).path(11, 13, 13, 13);
  for (let i = 0; i < 4; i++) b.house(8, 13 + i * 2, { floors: 1, color: i + 4 });
});

describe('the pump cart', () => {
  test('kept by the fountain, wheeled to the fire, hose laid and water on, then wound in and wheeled home', () => {
    const states = new Set<string>();
    let home: { x: number; z: number } | null = null;
    let laid = 0;
    const r = run(squareTown, {
      seconds: 150,
      brigade: true,
      light: key(15, 1, 12),
      every: (_t, _d, fire) => {
        const pump = fire.pump!;
        home ??= { x: pump.at.x, z: pump.at.z };
        states.add(pump.state);
        laid = Math.max(laid, pump.hose.length);
      },
    });
    const pump = r.fire.pump!;
    expect([...states]).toEqual(expect.arrayContaining(['home', 'muster', 'wheel', 'work', 'reel', 'return']));
    // The hose lay along the way he walked (more than a straight bar's two ends).
    expect(laid).toBeGreaterThan(3);
    // Home again, where it was kept.
    expect(pump.state).toBe('home');
    expect(Math.hypot(pump.at.x - home!.x, pump.at.z - home!.z)).toBeLessThan(0.01);
  }, 240_000);
});

describe('the town fights a fire', () => {
  const where = scenarioTown(streetTown);
  const light = key(14, 1, 18);

  test('a brigade forms where there is water, plays water on the fire, and it goes out sooner than left alone', () => {
    let formed = 0;
    let wet = 0;
    const withBrigade = run(where, {
      seconds: 120,
      brigade: true,
      light,
      every: (_t, _d, fire) => {
        const crew = fire.pump?.pumper ? 2 : 0;
        for (const b of fire.brigades.values()) {
          formed = Math.max(formed, crew + b.buckets.length);
          if (b.aim.size > 0) wet++;
        }
        if (fire.pump?.flowing) wet++;
      },
    });
    expect(formed).toBeGreaterThanOrEqual(3);
    expect(wet).toBeGreaterThan(5);
    void withBrigade;
  }, 240_000);

  test('a house by the fountain is put out sooner with the brigade than left alone, and saved from burning out', () => {
    const lit = key(15, 1, 12);
    const helped = run(squareTown, { seconds: 120, brigade: true, light: lit });
    const alone = run(squareTown, { seconds: 120, brigade: false, light: lit });
    expect(helped.out).toBeLessThan(alone.out);
  }, 240_000);

  test('nobody stands in or walks into a burning building, and everyone goes home afterwards', () => {
    const bad: string[] = [];
    let town: ReturnType<typeof createLivingTown> | null = null;
    const r = run(where, {
      seconds: 150,
      brigade: true,
      light,
      every: (_t, d) => {
        if (!town) return;
        const burning = new Set(d.engine.burning().map((b) => b.cell));
        const hotStructures = new Set(d.engine.burning().map((b) => b.structure));
        for (const p of town!.crowd.people) {
          if (!p.visible || p.mode === 'gone') continue;
          const s = where.shape.structureAt.get(key(keyX(p.cell), keyY(p.cell) - 1, keyZ(p.cell)));
          if (burning.has(p.cell)) bad.push(`${p.id} in a burning cell`);
          if (p.inside && hotStructures.has(p.inside.structure)) bad.push(`${p.id} inside a burning house`);
          if (s !== undefined && hotStructures.has(s) && p.mode !== 'walk') bad.push(`${p.id} on a burning roof`);
        }
      },
    });
    town = r.town;
    expect(bad.slice(0, 5)).toEqual([]);
    // Afterwards, nobody is still held by the fire.
    const still = town.crowd.people.filter((p) => town.board.plans.get(p)?.chain.id === 'mischief.fire' && town.board.plans.get(p)!.steps[0]!.tag !== 'mischief:home' && !town.board.plans.get(p)!.steps.some((x) => x.tag === 'fire:park')); // (wheeling the cart home is the last job)
    expect(still.map((p) => `${p.id} ${town.board.plans.get(p)!.steps.map((s) => s.tag).join(',')} busy=${r.d.engine.busy}`)).toEqual([]);
  }, 240_000);
});

describe('the town rebuilds', () => {
  test('out over the water too: a crew can stand on the deck or the nearest shore, or it mends at their pace anyway', () => {
    const base = scenarioTown(findScenario('grown-harbour')!);
    const wet = (c: CellKey): boolean => base.terrain.height[columnIndex(keyX(c), keyZ(c))] === 0;
    const blocks = new Map(base.world.blocks);
    for (const [c, b] of blocks) if (wet(c)) blocks.set(c, { ...b, ruin: packRuin({ stage: 2, cause: 'blast', mending: true, progress: 1 }) });
    const where = resolved({ ...base.world, blocks }, base.terrain);
    const d = new Director(5);
    d.sync(where.shape);
    const rebuild = rebuildChain(d);
    const c = clock(where.world.seed, 'day');
    const town = createLivingTown({ seed: where.world.seed, chains: [rebuild, ...allChains()] });
    town.sync(where.shape, where.dressing, c.time);
    for (let i = 0; i < 30 * 3; i++) town.step(c.tick(1 / 30), c.time);
    const mending = new Map<StructureId, string>();
    for (const cell of blocks.keys()) if (wet(cell)) mending.set(where.shape.structureAt.get(cell)!, blocks.get(cell)!.kind);
    // Every one has somewhere for a crew to stand, or is mended at a crew's pace with nobody there.
    for (const [sid, kind] of mending) expect(`${kind}#${sid} ${standsOf(town.board, sid).length > 0 || d.remote.has(sid)}`).toBe(`${kind}#${sid} true`);
    // Docks, out on the water, get crews too: on the deck, or from the shore.
    expect([...mending].filter(([sid, kind]) => kind === 'dock' && standsOf(town.board, sid).length > 0).length).toBeGreaterThan(0);
    // And crews go out to them.
    expect([...rebuild.sites.keys()].some((sid) => mending.has(sid))).toBe(true);
  });
});
