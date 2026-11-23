// The ghost is worked out once a frame, and not in a frame that already
// carried a whole-town dressing.

import { expect, test } from 'vitest';
import { createGhostPace } from './ghost';

const counter = () => {
  let n = 0;
  return { run: () => void n++, get n() { return n; } };
};

test('runs once per frame however many wants came in', () => {
  const p = createGhostPace(), c = counter();
  p.want(); p.want(); p.want();
  p.frame(c.run); expect(c.n).toBe(1);
  p.frame(c.run); expect(c.n).toBe(1);
});

test('waits one frame when that frame carried a dressing', () => {
  const p = createGhostPace(), c = counter();
  p.want(); p.heavy();
  p.frame(c.run); expect(c.n).toBe(0);
  p.frame(c.run); expect(c.n).toBe(1);
});

test('a want during a heavy frame is kept, not lost', () => {
  const p = createGhostPace(), c = counter();
  p.heavy(); p.want();
  p.frame(c.run); expect(c.n).toBe(0);
  p.frame(c.run); expect(c.n).toBe(1);
  p.frame(c.run); expect(c.n).toBe(1);
});
