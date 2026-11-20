// A fright that goes on is one fright (scare.ts): a burning building is
// reported every 0.4 s, and each report used to put every bird near it up
// again, or another step of height on it.

import { expect, test } from 'vitest';
import { key } from '@/core/grid';
import { ScareTable, SCARE_FRESH } from './scare';

test('a fright reported again while it is fresh is the same fright; birds keep away while it lasts', () => {
  const t = new ScareTable();
  const fire = key(10, 1, 10);
  t.add(fire, 6, false, 0);
  expect(t.seq).toBe(1);
  for (let s = 0.4; s < 10; s += 0.4) t.add(fire, 6, false, s);
  expect(t.seq).toBe(1); // ten seconds of burning: one event
  expect(t.danger(12.5, 10.5, 9.8)).toBe(true); // a bird should not come down by it yet
  expect(t.danger(30.5, 10.5, 9.8)).toBe(false);
  expect(t.danger(12.5, 10.5, 10 + SCARE_FRESH)).toBe(false); // out: it may come back
  // Somewhere else, or the same place once the first has gone stale: a new fright.
  t.add(key(20, 1, 20), 6, false, 10);
  t.add(fire, 6, false, 10 + SCARE_FRESH + 0.1);
  expect(t.seq).toBe(3);
  // A person walking by is never a danger to keep away from.
  t.add(key(30, 1, 30), 3, true, 20);
  expect(t.danger(30.5, 30.5, 20)).toBe(false);
});
