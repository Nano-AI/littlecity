// A street being mended, with the living town on top (design section 13b; the
// owner: "repair crew guys just stand there and shrink and grow and shrink and
// grow repeatedly"). Every mend step changes the town, and the people are
// re-planned on each change: nobody may grow back after they have begun to go,
// nobody at work changes size, and no crew is let go and taken on again at the
// same building moments later.

import { expect, test } from 'vitest';
import { key } from '@/core/grid';
import { Director } from '@/life/mischief/director';
import { rebuildChain } from '@/life/mischief/response';
import type { Person } from '@/life/people/crowd';
import { clock, resolved, townOf } from '@/life/people/testing';
import { allChains, createLivingTown } from '@/life/town';
import { tagOf } from '@/life/mischief/response';
import { createGame } from './game';

test('a street mended over two minutes: no one shrinks and grows again, crews stay put', () => {
  const base = townOf((b) => {
    b.plaza(14, 14, 20, 20);
    b.put('fountain', 17, 17);
    for (let i = 0; i < 5; i++) b.house(12 + i * 2, 12, { floors: 2, color: i });
    for (let i = 0; i < 5; i++) b.house(12 + i * 2, 22, { floors: 2, color: i + 2 });
    b.path(10, 13, 10, 21).path(11, 21, 13, 21).path(11, 13, 13, 13);
  });
  const d = new Director(3);
  const c = clock(base.world.seed, 'day');
  const town = createLivingTown({ seed: base.world.seed, chains: [rebuildChain(d), ...allChains()] });
  const game = createGame(
    { world: base.world, terrain: base.terrain },
    {
      show: (shape) => {
        d.sync(shape);
        const r = resolved(shape.world, base.terrain);
        town.sync(r.shape, r.dressing, c.time);
      },
    },
  );
  d.connect({ begin: () => game.begin(), apply: (e) => void game.editAll(e), end: () => game.end(), abort: () => void game.abort(), edit: (e) => void game.editAll(e), amend: (e) => void game.amend(e) });
  for (let i = 0; i < 30 * 4; i++) town.step(c.tick(1 / 30), c.time);
  // Wreck the north row: its people have nowhere to live while it is mended.
  for (let i = 0; i < 5; i++) {
    d.knock(key(12 + i * 2, 1, 12));
    d.knock(key(12 + i * 2, 1, 12));
  }
  const fade = new Map<Person, number>();
  const shrinking = new Set<Person>();
  let regrew = 0;
  let workSizeChanged = 0;
  const lastAt = new Map<Person, { sid: string; left: number }>();
  let rehired = 0;
  for (let i = 0; i < 30 * 120; i++) {
    const dt = c.tick(1 / 30);
    d.update(dt, { wind: () => ({ dirX: 1, dirZ: 0, strength: 0.2 }) });
    d.flush();
    town.step(dt, c.time);
    const now = i / 30;
    for (const p of town.crowd.people) {
      if (p.mode === 'gone') continue;
      const was = fade.get(p) ?? p.fade;
      // Going (fading out, not at the water) and then coming back up while still going: the pulse.
      if (p.leaving && p.fade < was - 1e-6) shrinking.add(p);
      if (p.leaving && shrinking.has(p) && p.fade > was + 1e-6) regrew++;
      if (!p.leaving) shrinking.delete(p);
      fade.set(p, p.fade);
      const tag = tagOf(p);
      if (tag === 'rebuild:work' && p.mode === 'linger' && p.fade < 1) workSizeChanged++;
      // At work at a site, let go, and taken on again at the same site within ten seconds.
      const site = tag === 'rebuild:work' ? String(p.goal?.errand?.cell) : '';
      const had = lastAt.get(p);
      if (site && had && had.sid === site && had.left >= 0 && now - had.left < 10) rehired++;
      if (site) lastAt.set(p, { sid: site, left: -1 });
      else if (had && had.left < 0) had.left = now;
    }
  }
  expect(regrew).toBe(0);
  expect(workSizeChanged).toBe(0);
  expect(rehired).toBe(0);
}, 300_000);
