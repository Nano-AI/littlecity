// Reads the town a few times a second and turns it into the strip's numbers: how many live here, how the
// town feels (the mood model, src/ui/stats/mood.ts) and one silly count. Each source is its own small
// function, and each copes with the thing it reads not being there yet (a town still loading).

import type { LifeStage } from '@/life/api';
import { crowdOf } from '@/life/doors/table';
import { mischiefOf, type MischiefEvent } from '@/life/mischief/director';
import { raidsOf } from '@/life/raid/raids';
import { scenesOnStage } from '@/life/town/scenes';
import { SILLY } from '@/style/stats';
import { createMood, createTally, type SillyKey } from './mood';

export interface StatsView {
  population: number | null;
  mood: number;
  silly: { label: string; n: number } | null;
}

/** How often a new view is made (ms), and how long each silly count stays up (ms). */
const EVERY = 250;
const ROTATE = 4000;

type Chain = { id: string; open?: boolean };

export function createStatsWatch() {
  const mood = createMood();
  const tally = createTally();
  /** Mischief events wait here for the next update. */
  const queue: MischiefEvent[] = [];
  const listening = new WeakSet<object>();
  let last = -Infinity;
  let population: number | null = null;
  let silly: { key: SillyKey; n: number } | null = null;
  let shownAt = -Infinity;
  // What each source saw last, so only what is new counts. Those that belong to one town (its scenes,
  // board, crowd) start again, from nothing, when the town's own object changes.
  let sceneN = 0;
  let sceneBook: object | null = null;
  let raids = 0;
  let scuffle = 0;
  let scuffleCrowd: object | null = null;
  let goodsBoard: object | null = null;
  const gave = new Map<string, number>();
  let daysBoard: object | null = null;
  let marketOpen = false;
  let festival = false;

  function listen(stage: LifeStage): void {
    if (listening.has(stage)) return;
    listening.add(stage);
    mischiefOf(stage).on((e) => queue.push(e));
  }

  function apply(e: MischiefEvent): void {
    if (e.type === 'lit') {
      mood.hit('fire');
      tally.add('fires');
    } else if (e.type === 'drop' && e.bomb.nuke) {
      mood.hit('nuke');
      tally.add('nukes');
    } else if (e.type === 'drop') {
      mood.hit('bomb');
      tally.add('bombs');
    } else if (e.type === 'strike') {
      mood.hit('lightning');
      tally.add('lightning');
    } else if (e.type === 'knock') {
      mood.hit('mallet');
    } else if (e.type === 'blast') {
      mood.hit('ruin', e.blast.hit.length);
      tally.add('ruined', e.blast.hit.length);
    } else if (e.type === 'mend') {
      mood.hit('mend');
    }
  }

  /** One at a time, each taken off the queue before it is applied, so none is applied twice or lost with another. */
  function mischief(): void {
    for (let e = queue.shift(); e; e = queue.shift()) apply(e);
  }

  function people(stage: LifeStage): void {
    const crowd = crowdOf(stage);
    if (crowd) population = crowd.residents;
  }

  function scenes(stage: object): void {
    const book = scenesOnStage(stage);
    if (!book) return;
    if (book !== sceneBook) {
      sceneBook = book;
      sceneN = 0;
    }
    let top = sceneN;
    for (const s of book.on) {
      if (s.n <= sceneN) continue;
      top = Math.max(top, s.n);
      if (s.kind === 'raid') continue;
      mood.hit('scene');
      if (s.kind === 'wedding') tally.add('weddings');
    }
    sceneN = top;
  }

  function raiding(stage: object): void {
    const n = raidsOf(stage).count;
    if (n > raids) {
      mood.hit('raid');
      tally.add('raids', n - raids);
    }
    raids = n;
  }

  function scuffling(stage: LifeStage): void {
    const crowd = crowdOf(stage);
    if (!crowd) return;
    if (crowd !== scuffleCrowd) {
      scuffleCrowd = crowd;
      scuffle = 0;
    }
    const n = crowd.scuffles.now?.n;
    if (n && n !== scuffle) {
      mood.hit('scuffle');
      tally.add('scuffles');
    }
    if (n) scuffle = n;
  }

  function goods(stage: object): void {
    const board = raidsOf(stage).board;
    if (!board) return;
    if (board !== goodsBoard) {
      goodsBoard = board;
      gave.clear();
    }
    for (const [load, key] of [['loaf', 'loaves'], ['fishes', 'fish']] as const) {
      const n = board.delivered.get(load) ?? 0;
      const d = n - (gave.get(load) ?? 0);
      if (d > 0) tally.add(key, d);
      gave.set(load, n);
    }
  }

  function burning(stage: LifeStage): void {
    tally.set('burning', mischiefOf(stage).engine.burning().length);
  }

  function days(stage: object): void {
    const board = raidsOf(stage).board;
    if (!board) return;
    const open = (board.chains.find((c) => c.id === 'market') as Chain | undefined)?.open === true;
    const lit = board.season.festival >= 0.5;
    // A town just arrived at is not "news": take its market and lights as they are.
    if (board === daysBoard) {
      if (open && !marketOpen) mood.hit('market');
      if (lit && !festival) mood.hit('festival');
    }
    daysBoard = board;
    marketOpen = open;
    festival = lit;
  }

  return {
    update(stage: object, now: number): StatsView | null {
      if (now - last < EVERY) return null;
      const dt = Number.isFinite(last) ? (now - last) / 1000 : 0;
      last = now;
      const s = stage as LifeStage;
      listen(s);
      mischief();
      people(s);
      scenes(s);
      raiding(s);
      scuffling(s);
      goods(s);
      burning(s);
      days(s);
      mood.step(dt);
      // The silly count changes every ROTATE ms, and shows the live number of the one it is on.
      if (!silly || now - shownAt >= ROTATE) {
        const next = tally.next();
        silly = next && { key: next.key, n: next.n };
        shownAt = now;
      }
      if (silly) {
        silly.n = tally.get(silly.key);
        if (silly.n <= 0) silly = null;
      }
      return {
        population,
        mood: Math.round(mood.value),
        silly: silly && { label: SILLY[silly.key], n: silly.n },
      };
    },
  };
}
