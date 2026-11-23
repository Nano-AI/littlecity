import { describe, expect, test } from 'vitest';
import { createMood, createTally } from './mood';

describe('mood', () => {
  test('starts at rest', () => {
    expect(createMood().value).toBe(70);
  });

  test('a nuke dents it and a wedding lifts it', () => {
    const m = createMood();
    m.hit('nuke');
    expect(m.value).toBe(66);
    m.hit('scene');
    expect(m.value).toBe(70);
  });

  test('never below 0 or above 100', () => {
    const m = createMood();
    m.hit('ruin', 4);
    expect(m.value).toBe(0);
    const h = createMood(98);
    h.hit('festival');
    expect(h.value).toBe(100);
  });

  test('mending lifts it a little', () => {
    const m = createMood();
    m.hit('mend');
    expect(m.value).toBe(71);
  });

  test('drifts back to rest', () => {
    const m = createMood();
    m.hit('ruin', 1);
    m.step(90);
    expect(m.value).toBeGreaterThan(45);
    expect(m.value).toBeLessThan(50);
    m.step(600);
    expect(Math.abs(m.value - 70)).toBeLessThan(0.5);
    const h = createMood();
    h.hit('festival', 10);
    expect(h.value).toBe(100);
    h.step(600);
    expect(Math.abs(h.value - 70)).toBeLessThan(0.5);
  });

  test('step(0) and negative dt change nothing', () => {
    const m = createMood();
    m.hit('nuke');
    m.step(0);
    m.step(-5);
    expect(m.value).toBe(66);
  });

  test('drag lowers where it settles', () => {
    const m = createMood();
    m.drag(40);
    m.step(600);
    expect(Math.abs(m.value - 30)).toBeLessThan(0.5);
    m.drag(0);
    m.step(600);
    expect(Math.abs(m.value - 70)).toBeLessThan(0.5);
  });
});

describe('tally', () => {
  test('rotates through the non-zero counts in order, wrapping', () => {
    const t = createTally();
    expect(t.next()).toBeNull();
    t.add('nukes');
    t.add('loaves', 3);
    expect(t.next()).toEqual({ key: 'loaves', n: 3 });
    expect(t.next()).toEqual({ key: 'nukes', n: 1 });
    expect(t.next()).toEqual({ key: 'loaves', n: 3 });
  });

  test('set to zero removes it from the rotation', () => {
    const t = createTally();
    t.set('burning', 4);
    t.add('fish');
    t.set('burning', 0);
    expect(t.get('burning')).toBe(0);
    expect(t.next()).toEqual({ key: 'fish', n: 1 });
    expect(t.next()).toEqual({ key: 'fish', n: 1 });
  });
});
