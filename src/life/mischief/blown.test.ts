// People blown about by mischief (design section 13b, "blown about"): a
// grown town with the app's own wiring and no renderer (tests/helpers/
// turmoil.ts), a nuke or a bomb, and everybody watched: thrown, never inside
// anything solid, below the ground, off the map or not finite; back on the
// walking graph and choosing again within a bounded time; nobody lost or
// made twice.

import { describe, expect, test } from 'vitest';
import { CELL_H, columnIndex, SEA_Y } from '@/core/grid';
import { buildScenario } from '@/scenario';
import { findScenario } from '@/scenario/discover';
import { crowdOf } from '@/life/doors/table';
import type { Person } from '@/life/people/crowd';
import { createTurmoil, type Turmoil } from '../../../tests/helpers/turmoil';
import { throwerOf } from './thrown.system';

function town(name = 'grown-town-1'): { t: Turmoil; h: (x: number, z: number) => number } {
  const built = buildScenario(findScenario(name)!);
  const t = createTurmoil({ world: built.world, terrain: built.terrain });
  t.run(4);
  return { t, h: (x, z) => built.terrain.height[columnIndex(Math.floor(x), Math.floor(z))]! * CELL_H };
}

interface Watch {
  thrown: Set<Person>;
  problems: string[];
  /** Longest a person was off their feet (seconds). */
  longest: number;
  /** Those whose home went (they leave the island, as anybody whose house is gone does). */
  leaving: Set<string>;
}

/** Watches every frame: who is thrown, and that nobody is somewhere they cannot be. */
function watch(t: Turmoil): Watch {
  const w: Watch = { thrown: new Set(), problems: [], longest: 0, leaving: new Set() };
  const since = new Map<Person, number>();
  t.onFrame = (now) => {
    const crowd = crowdOf(t.stage)!;
    const thrower = throwerOf(t.stage);
    const ground = thrower?.ground;
    for (const p of crowd.people) {
      if (p.leaving) w.leaving.add(p.id);
      if (p.mode === 'thrown') {
        w.thrown.add(p);
        if (!since.has(p)) since.set(p, now);
        w.longest = Math.max(w.longest, now - since.get(p)!);
      } else since.delete(p);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) w.problems.push(`${p.id} not finite`);
      if (p.mode !== 'thrown' || !ground) continue;
      const b = thrower!.thrown.get(p)?.body;
      if (!b) {
        w.problems.push(`${p.id} thrown with no body`);
        continue;
      }
      if (p.x < -1.3 || p.x > 49.3 || p.z < -1.3 || p.z > 49.3) w.problems.push(`${p.id} off the map at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
      const foot = b.upright ? b.y : b.y - b.radius;
      if (foot < SEA_Y - 0.3) w.problems.push(`${p.id} below the water at ${foot.toFixed(2)}`);
      // Inside something solid, a little above the feet (resting on a surface is not inside it).
      if (b.phase !== 'swim' && b.phase !== 'climb' && ground.blocked(b.x, foot + 0.06, b.z)) w.problems.push(`${p.id} inside something at ${b.x.toFixed(2)}, ${foot.toFixed(2)}, ${b.z.toFixed(2)} (${b.phase})`);
    }
  };
  return w;
}

describe('people blown about', () => {
  test('a nuke throws the town out in a wave; everyone gets back up and carries on', () => {
    const { t, h } = town();
    const crowd = crowdOf(t.stage)!;
    const before = new Set(crowd.people.filter((p) => !p.id.startsWith('ashore:')).map((p) => p.id));
    const out = crowd.people.filter((p) => p.visible).length;
    const w = watch(t);
    t.mischief.dropNuke([24.5, h(24.5, 24.5), 24.5]);
    t.run(60);
    // Most of those out were thrown.
    expect(out).toBeGreaterThan(10);
    expect(w.thrown.size).toBeGreaterThan(out * 0.6);
    expect(w.problems.slice(0, 10)).toEqual([]);
    // Back on their feet and on the graph: nobody still thrown, everyone in a mode of the crowd's own.
    expect(crowd.people.filter((p) => p.mode === 'thrown').map((p) => p.id)).toEqual([]);
    expect(w.longest).toBeLessThan(40);
    for (const p of w.thrown) {
      expect(p.tumble ?? null).toBeNull();
      if (p.visible && p.mode !== 'gone' && p.mode !== 'home' && p.mode !== 'visit' && p.node >= 0) {
        const c = crowd.nav!.nodes[p.node]!.cell;
        expect(crowd.nav!.nodeAt.get(c)).toBe(p.node);
      }
    }
    // Nobody lost, nobody twice.
    const after = crowd.people.filter((p) => !p.id.startsWith('ashore:')).map((p) => p.id);
    expect(new Set(after).size).toBe(after.length);
    for (const id of before) if (!after.includes(id) && !w.leaving.has(id)) expect.fail(`${id} is gone`);
  }, 120_000);

  test('a bomb in a street throws those near it, not those far off', () => {
    const { t, h } = town();
    const crowd = crowdOf(t.stage)!;
    t.run(20);
    // Where most people are out.
    const out = crowd.people.filter((p) => p.visible && (p.mode === 'walk' || p.mode === 'linger'));
    const p0 = out[0]!;
    const w = watch(t);
    t.mischief.dropBomb([p0.x, h(p0.x, p0.z), p0.z]);
    t.run(25);
    expect(w.problems.slice(0, 10)).toEqual([]);
    expect(w.thrown.size).toBeGreaterThan(0);
    for (const p of w.thrown) expect(Math.hypot(p.x - p0.x, p.z - p0.z)).toBeLessThan(12);
    expect(crowd.people.filter((p) => p.mode === 'thrown').length).toBe(0);
  }, 120_000);
});
