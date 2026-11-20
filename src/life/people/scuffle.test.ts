// L50 · The street scuffle, stepped with fixed time steps and watched: it
// happens where walkers bump, the two always come out the other side,
// nobody is left in a cloud, the exclusions hold, building on the spot ends
// it at once, and the same town gives the same scuffles.

import { describe, expect, test } from 'vitest';
import { key, keyX, keyY, keyZ } from '@/core/grid';
import { SCUFFLE } from '@/style/town-life';
import scuffleTown from '../../../scenarios/life/L50.scuffle.scenario';
import { createCrowd, type Person } from './crowd';
import type { Scuffle } from './scuffle';
import { clock, scenarioTown, watch } from './testing';

const town = scenarioTown(scuffleTown);

function stepped(seconds: number, dials?: { chance?: number; squeeze?: number; rest?: number }) {
  const c = clock(town.world.seed, 'day');
  const seen: Scuffle[] = [];
  const ended: Scuffle[] = [];
  const crowd = createCrowd({ ...(dials ? { scuffle: dials } : {}), events: { scuffle: (s, what) => (what === 'start' ? seen : ended).push(s) } });
  crowd.sync(town.shape, town.dressing, c.time);
  const w = watch(crowd, { maxStuck: 12 });
  const problems: string[] = [];
  const say = (what: string): void => {
    if (problems.length < 10) problems.push(what);
  };
  for (let i = 0; i < seconds * 30; i++) {
    crowd.step(c.tick(1 / 30), c.time);
    w.check();
    const s = crowd.scuffles.now;
    for (const p of crowd.people) {
      if (p.inCloud && (!s || (s.a !== p && s.b !== p) || s.phase !== 'fight')) say(`${p.id} left in a cloud`);
      if (p.scuffle && p.scuffle !== s) say(`${p.id} still tied to an old scuffle`);
    }
  }
  return { crowd, seen, ended, watch: w, problems };
}

describe('L50 the street scuffle', () => {
  test('on a busy street with the town at rest between them, a few happen; each one ends and the two walk on', () => {
    const { seen, ended, watch: w, problems, crowd } = stepped(300, { rest: 20 });
    expect(problems).toEqual([]);
    expect(w.problems).toEqual([]);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    // Every one but perhaps the last has ended, and the two came out of it walking.
    expect(ended.length).toBeGreaterThanOrEqual(seen.length - 1);
    for (const s of ended) {
      expect(s.a.inCloud || s.b.inCloud).toBe(false);
      expect(s.a.scuffle === s || s.b.scuffle === s).toBe(false);
    }
    // Never two at once.
    expect(crowd.scuffles.now === null || seen.includes(crowd.scuffles.now)).toBe(true);
  });

  test('never children, nobody at work or carrying, and only on open ground', () => {
    const { seen } = stepped(300, { chance: 1, squeeze: 1, rest: 8 });
    expect(seen.length).toBeGreaterThan(3);
    for (const s of seen) {
      for (const p of [s.a, s.b]) {
        expect(p.child).toBe(false);
        expect(p.carrying).toBe(false);
        expect(p.brisk).toBe(false);
      }
      const node = town.nav.nodeAt.get(s.cell)!;
      const n = town.nav.nodes[node]!;
      expect(['path', 'plaza', 'grass', 'trail', 'sand', 'garden']).toContain(n.surface);
      expect(n.rot).toBeUndefined();
      expect(town.shape.structureAt.has(key(keyX(s.cell), keyY(s.cell) - 1, keyZ(s.cell)))).toBe(false);
    }
  });

  test('it runs fight, dazed, up (and sometimes a handshake) in order, and lasts a few seconds', () => {
    const c = clock(town.world.seed, 'day');
    const crowd = createCrowd();
    crowd.sync(town.shape, town.dressing, c.time);
    for (let i = 0; i < 20 * 30; i++) crowd.step(c.tick(1 / 30), c.time);
    const s = crowd.scuffles.provoke();
    expect(s).not.toBeNull();
    const phases: string[] = [];
    let t = 0;
    while (crowd.scuffles.now === s && t < 30) {
      crowd.step(c.tick(1 / 30), c.time);
      t += 1 / 30;
      if (phases[phases.length - 1] !== s!.phase) phases.push(s!.phase);
    }
    expect(crowd.scuffles.now).toBeNull();
    expect(phases.slice(0, 3)).toEqual(['fight', 'dazed', 'up']);
    expect(t).toBeGreaterThan(SCUFFLE.fightMin + SCUFFLE.dazed);
    expect(t).toBeLessThan(SCUFFLE.fightMax + SCUFFLE.dazed + SCUFFLE.up + SCUFFLE.shake + 1);
    // The ring watched, and has let go.
    expect(s!.watchers.length).toBeGreaterThan(0);
    for (const w of s!.watchers) expect(w.p.scuffle).toBeNull();
  });

  test('building on the spot ends it at once and cleanly', () => {
    const c = clock(town.world.seed, 'day');
    const crowd = createCrowd();
    crowd.sync(town.shape, town.dressing, c.time);
    for (let i = 0; i < 20 * 30; i++) crowd.step(c.tick(1 / 30), c.time);
    const s = crowd.scuffles.provoke()!;
    expect(s).not.toBeNull();
    crowd.step(c.tick(1 / 30), c.time);
    // The same town with the scuffle's cell gone from the walking graph.
    const nav = { ...town.nav, nodeAt: new Map([...town.nav.nodeAt].filter(([cell]) => cell !== s.cell)) };
    crowd.sync(town.shape, { ...town.dressing, nav }, c.time);
    expect(crowd.scuffles.now).toBeNull();
    for (const p of crowd.people as Person[]) {
      expect(p.inCloud).toBe(false);
      expect(p.scuffle).toBeNull();
    }
  });

  test('what is their own is set down first and picked up after; hats go askew; somebody coming breaks it up', () => {
    const c = clock(town.world.seed, 'day');
    let sent: Person | null = null;
    const crowd = createCrowd({ respond: (s) => (sent = crowd.people.find((p) => p.visible && p !== s.a && p !== s.b) ?? null) });
    crowd.sync(town.shape, town.dressing, c.time);
    for (let i = 0; i < 20 * 30; i++) crowd.step(c.tick(1 / 30), c.time);
    // Everybody out has a loaf.
    for (const p of crowd.people) if (p.mode === 'walk' && !p.child) p.load = 'loaf';
    const s = crowd.scuffles.provoke()!;
    expect(s).not.toBeNull();
    expect(s.setDown.size).toBe(2);
    expect(s.a.load).toBeNull();
    let askew = false;
    let t = 0;
    while (crowd.scuffles.now === s && t < 40) {
      crowd.step(c.tick(1 / 30), c.time);
      t += 1 / 30;
      if (s.a.costume === 'askew' || s.b.costume === 'askew') askew = true;
      // The peace-keeper gets there two seconds in: the cloud goes then.
      if (Math.abs(t - 2) < 1 / 60) crowd.scuffles.breakUp();
      if (t > 2.1 && t < 2.2) expect(s.phase).not.toBe('fight');
    }
    expect(sent).not.toBeNull();
    expect(askew).toBe(true);
    expect(s.a.load).toBe('loaf');
    expect(s.b.load).toBe('loaf');
    expect(s.a.costume).toBeNull();
  });

  test('the same town stepped the same way has the same scuffles', () => {
    const a = stepped(200, { rest: 20 }).seen.map((s) => [s.a.id, s.b.id, s.cell]);
    const b = stepped(200, { rest: 20 }).seen.map((s) => [s.a.id, s.b.id, s.cell]);
    expect(b).toEqual(a);
  });
});
