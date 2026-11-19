// The gesture recogniser, fed made-up samples with a made-up clock: the
// table in design section 7, row by row.

import { beforeEach, describe, expect, test } from 'vitest';
import { resetStyles } from '@/core/style';
import { createGestures, type Gestures, type GestureSink, type PointerSample, type Scheduler } from './gestures';

let log: string[];
let timers: { fn: () => void; at: number; id: number }[];
let now: number;
let acceptRun: boolean;
let g: Gestures;

const scheduler: Scheduler = {
  set(fn, ms) {
    const id = timers.length + 1;
    timers.push({ fn, at: now + ms, id });
    return id;
  },
  clear(handle) {
    timers = timers.filter((t) => t.id !== handle);
  },
};
/** Moves the clock forward and fires what came due. */
function wait(ms: number): void {
  now += ms;
  for (const t of timers.filter((t) => t.at <= now)) {
    timers = timers.filter((other) => other !== t);
    t.fn();
  }
}

const r = (n: number): number => Math.round(n * 100) / 100;
const sink: GestureSink = {
  use: (x, y) => log.push(`use ${x},${y}`),
  erase: (x, y) => log.push(`erase ${x},${y}`),
  orbit: (dx, dy) => log.push(`orbit ${dx},${dy}`),
  pan: (dx, dy) => log.push(`pan ${dx},${dy}`),
  zoom: (f, x, y) => log.push(`zoom ${r(f)} @${x},${y}`),
  hover: (x, y) => log.push(`hover ${x},${y}`),
  hoverEnd: () => log.push('hoverEnd'),
  runStart: (x, y) => {
    log.push(`runStart ${x},${y}`);
    return acceptRun;
  },
  runMove: (x, y) => log.push(`runMove ${x},${y}`),
  runEnd: () => log.push('runEnd'),
};

const mouse = (x: number, y: number, button = 0, shift = false): PointerSample => ({ id: 1, type: 'mouse', x, y, button, shift, t: now });
const finger = (id: number, x: number, y: number): PointerSample => ({ id, type: 'touch', x, y, button: 0, shift: false, t: now });
const acts = (): string[] => log.filter((l) => !l.startsWith('hover'));

beforeEach(() => {
  resetStyles();
  log = [];
  timers = [];
  now = 1000;
  acceptRun = true;
  g = createGestures(sink, scheduler);
});

describe('mouse', () => {
  test('press and release within 5 px is a click: use the tool where it was pressed', () => {
    g.down(mouse(100, 100));
    g.move(mouse(103, 104));
    g.up(mouse(103, 104));
    expect(acts()).toEqual(['use 100,100']);
  });

  test('further than 5 px is a drag: it orbits and uses nothing', () => {
    g.down(mouse(100, 100));
    g.move(mouse(104, 104)); // 5.66 px
    g.move(mouse(114, 109));
    g.up(mouse(114, 109));
    expect(acts()).toEqual(['orbit 4,4', 'orbit 10,5']);
  });

  test('right click erases; right drag pans', () => {
    g.down(mouse(50, 50, 2));
    g.up(mouse(51, 50, 2));
    expect(acts()).toEqual(['erase 50,50']);
    log = [];
    g.down(mouse(50, 50, 2));
    g.move(mouse(70, 60, 2));
    g.up(mouse(70, 60, 2));
    expect(acts()).toEqual(['pan 20,10']);
  });

  test('moving with no button down hovers; pressing or leaving ends the hover', () => {
    g.move(mouse(10, 10));
    g.move(mouse(12, 10));
    g.down(mouse(12, 10));
    g.up(mouse(12, 10));
    g.leave();
    expect(log).toEqual(['hover 10,10', 'hover 12,10', 'hoverEnd', 'use 12,10', 'hover 12,10', 'hoverEnd']);
  });

  test('Shift + drag paints a run, from the press', () => {
    g.down(mouse(10, 10, 0, true));
    g.move(mouse(11, 10, 0, true));
    g.move(mouse(40, 10, 0, true));
    g.up(mouse(40, 10, 0, true));
    expect(acts()).toEqual(['runStart 10,10', 'runMove 11,10', 'runMove 40,10', 'runEnd']);
  });

  test('a declined run is an ordinary press: Shift + click still uses the tool, Shift + drag still orbits', () => {
    acceptRun = false;
    g.down(mouse(10, 10, 0, true));
    g.up(mouse(10, 10, 0, true));
    g.down(mouse(10, 10, 0, true));
    g.move(mouse(30, 10, 0, true));
    g.up(mouse(30, 10, 0, true));
    expect(acts()).toEqual(['runStart 10,10', 'use 10,10', 'runStart 10,10', 'orbit 20,0']);
  });

  test('releasing the other button during a drag changes nothing', () => {
    g.down(mouse(10, 10));
    g.move(mouse(30, 10));
    g.up(mouse(30, 10, 2));
    g.move(mouse(40, 10));
    g.up(mouse(40, 10));
    expect(acts()).toEqual(['orbit 20,0', 'orbit 10,0']);
  });
});

describe('touch', () => {
  test('a tap is within 10 px and 250 ms', () => {
    g.down(finger(1, 100, 100));
    wait(120);
    g.move(finger(1, 106, 104));
    g.up(finger(1, 106, 104));
    expect(log).toEqual(['use 100,100']);
  });

  test('a slow press that is not long enough does nothing', () => {
    g.down(finger(1, 100, 100));
    wait(300);
    g.up(finger(1, 100, 100));
    expect(log).toEqual([]);
  });

  test('holding still for 450 ms erases, once, and the lift does nothing', () => {
    g.down(finger(1, 100, 100));
    wait(449);
    expect(log).toEqual([]);
    wait(1);
    expect(log).toEqual(['erase 100,100']);
    g.move(finger(1, 140, 100));
    wait(600);
    g.up(finger(1, 140, 100));
    expect(log).toEqual(['erase 100,100']);
  });

  test('a one-finger drag orbits: no tap, no long press', () => {
    g.down(finger(1, 100, 100));
    g.move(finger(1, 100, 111));
    g.move(finger(1, 110, 121));
    wait(600);
    g.up(finger(1, 110, 121));
    expect(log).toEqual(['orbit 10,10']);
  });

  test('two fingers pan with their middle and zoom with their spread', () => {
    g.down(finger(1, 100, 100));
    g.down(finger(2, 200, 100));
    g.move(finger(1, 110, 120));
    g.move(finger(2, 210, 120)); // both moved by 10,20: the spread is 100 again
    g.move(finger(2, 310, 120)); // spread 100 → 200, the middle moves by 50,0
    wait(700);
    g.up(finger(2, 310, 120));
    g.move(finger(1, 0, 0)); // the finger left behind does nothing
    g.up(finger(1, 0, 0));
    // Whatever the order the fingers reported in, the sum is what the hand did.
    let panX = 0, panY = 0, zoom = 1;
    for (const line of log) {
      const pan = /^pan (-?[\d.]+),(-?[\d.]+)$/.exec(line);
      const z = /^zoom ([\d.]+) @/.exec(line);
      if (pan) [panX, panY] = [panX + Number(pan[1]), panY + Number(pan[2])];
      else if (z) zoom *= Number(z[1]);
      else throw new Error(`unexpected: ${line}`);
    }
    expect([panX, panY]).toEqual([60, 20]);
    expect(zoom).toBeCloseTo(2, 1);
    expect(log.at(-1)).toBe('zoom 2 @210,120');
  });

  test('a second finger cancels the tap and the long press', () => {
    g.down(finger(1, 100, 100));
    wait(100);
    g.down(finger(2, 200, 100));
    wait(600);
    g.up(finger(1, 100, 100));
    g.up(finger(2, 200, 100));
    expect(log).toEqual([]);
    // And the next tap works as usual.
    g.down(finger(3, 50, 50));
    g.up(finger(3, 50, 50));
    expect(log).toEqual(['use 50,50']);
  });

  test('a cancelled touch uses nothing', () => {
    g.down(finger(1, 100, 100));
    g.cancel(finger(1, 100, 100));
    wait(600);
    expect(log).toEqual([]);
  });

  test('fingers never hover', () => {
    g.down(finger(1, 100, 100));
    g.move(finger(1, 101, 100));
    g.up(finger(1, 101, 100));
    expect(log.some((l) => l.startsWith('hover'))).toBe(false);
  });
});
