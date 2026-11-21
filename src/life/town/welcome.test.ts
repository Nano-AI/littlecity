// L68 · waving a ship in, with a ship that sails in to the pier's end and
// stops (the harbour's news, faked: tests have no stage): children come
// running to the end of the pier, wave and cheer facing it, and go home once
// it has stopped; a ship going out draws nobody.

import { describe, expect, test } from 'vitest';
import { findScenario } from '@/scenario/discover';
import type { BigShipNews } from '../ships/news';
import { clock, scenarioTown, watch } from '../people/testing';
import { welcomeChain, type WelcomeChain } from './chains/welcome';
import { allChains, createLivingTown } from './index';

const town = scenarioTown(findScenario('ships-harbour')!);
const decks = town.dressing.sockets.filter((s) => s.type === 'way-out' && town.nav.nodes[town.nav.nodeAt.get(s.cell) ?? -1]?.surface === 'deck');
/** Out to sea: from the middle of the pier ends away through the first. */
const OUT = (() => {
  const e = decks[0]!;
  const mx = decks.reduce((n, s) => n + (s.cell & 63), 0) / decks.length, mz = decks.reduce((n, s) => n + ((s.cell >> 6) & 63), 0) / decks.length;
  const dx = (e.cell & 63) - mx, dz = ((e.cell >> 6) & 63) - mz, d = Math.hypot(dx, dz) || 1;
  return { x: d > 0.5 ? dx / d : 1, z: d > 0.5 ? dz / d : 0 };
})();

function run(path: (t: number) => { x: number; z: number; speed: number }) {
  const ships: BigShipNews[] = [];
  const welcome = welcomeChain(() => ships);
  const c = clock(town.world.seed, 'day');
  const t = createLivingTown({ seed: town.world.seed, chains: allChains().map((x) => (x.id === 'welcome' ? welcome : x)) });
  t.sync(town.shape, town.dressing, c.time);
  const w = watch(t.crowd, { maxStuck: 12 });
  // Aim the ship at the first pier end the chain knows.
  const end = town.dressing.sockets.find((s) => s.type === 'way-out' && town.nav.nodes[town.nav.nodeAt.get(s.cell) ?? -1]?.surface === 'deck')!;
  const ex = (end.cell & 63) + 0.5, ez = ((end.cell >> 6) & 63) + 0.5;
  let most = 0, waves = 0;
  const wavers = new Set<unknown>();
  for (let i = 0; i < 160 * 30; i++) {
    const s = i / 30;
    const at = path(s);
    ships.length = 0;
    ships.push({ x: ex + at.x, z: ez + at.z, yaw: 0, stern: -3, bow: 3, halfBeam: 0.7, speed: at.speed });
    t.step(c.tick(1 / 30), c.time);
    w.check();
    most = Math.max(most, welcome.waving.length);
    for (const p of welcome.waving) wavers.add(p);
    waves += welcome.waving.filter((p) => p.mode === 'linger' && (p.pose === 'wave' || p.pose === 'cheer' || p.pose === 'hop')).length > 0 ? 1 : 0;
  }
  return { welcome: welcome as WelcomeChain, most, waves, problems: w.problems, t, wavers };
}

describe('L68: waving the ship in', () => {
  test('a ship coming in: they run to the pier end, wave it in, and go home when it has stopped', () => {
    // From 14 cells out, in at 0.25 a second, stopping 3 cells off.
    const r = run((s) => {
      const d = Math.max(3, 14 - s * 0.25);
      return { x: d, z: 0, speed: d > 3 ? 0.25 : 0 };
    });
    expect(r.problems).toEqual([]);
    expect(r.welcome.welcomed).toBe(1);
    expect(r.most).toBeGreaterThanOrEqual(2);
    expect(r.waves).toBeGreaterThan(30 * 5);
    expect(r.welcome.waving.length).toBe(0);
    for (const p of r.t.crowd.people) if (r.wavers.has(p)) expect(p.party).toBe(false);
  });

  test('a ship going out draws nobody', () => {
    const r = run((s) => ({ x: OUT.x * (3 + s * 0.25), z: OUT.z * (3 + s * 0.25), speed: 0.25 }));
    expect(r.welcome.welcomed).toBe(0);
  });
});
