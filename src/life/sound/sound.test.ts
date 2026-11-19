// F06: the choices sound makes, without audio (Node has no AudioContext, so the system is inert here).

import { describe, expect, test } from 'vitest';
import { createLife } from '../runtime';
import { createSignals, partPhases, timeAt } from '../signals';
import { recordingStage, step } from '../testing/stage';
import sound, { bellNow, gullGap } from './sound.system';
import { noteFor, partialsOf, timbreFor } from './synth';

describe('sound (F06)', () => {
  test('a higher piece sings a higher note; kinds have their own timbres', () => {
    for (let y = 1; y < 12; y++) expect(noteFor(y)).toBeGreaterThan(noteFor(y - 1));
    expect(noteFor(40)).toBe(noteFor(11));
    expect(timbreFor('tower')).toBe('bell');
    expect(timbreFor('house')).toBe('wood');
    expect(timbreFor('marble')).toBe('stone');
    expect(timbreFor('dock')).toBe('plank');
    expect(timbreFor(undefined)).toBe('soft');
    for (const t of ['wood', 'bell', 'stone', 'leaf', 'plank', 'soft'] as const) expect(partialsOf(t).length).toBeGreaterThan(0);
  });

  test('the bell rings once, on the step the evening begins', () => {
    const p = partPhases().dusk;
    let rings = 0;
    let prev = null;
    for (let i = 0; i <= 600; i++) {
      const now = timeAt(p.start + ((p.end - p.start) * i) / 600, i);
      if (bellNow(prev, now)) rings++;
      prev = now;
    }
    expect(rings).toBe(1);
  });

  test('gulls call every 9 to 25 seconds; with no audio the system is quiet and harmless', () => {
    for (let n = 0; n < 50; n++) {
      expect(gullGap(7, n)).toBeGreaterThanOrEqual(9);
      expect(gullGap(7, n)).toBeLessThan(25);
    }
    const rec = recordingStage();
    const signals = createSignals(3);
    const life = createLife(rec.stage, signals, { behaviours: [], systems: [sound] });
    step(life, signals, 2);
    life.dispose();
    expect(rec.spawned).toHaveLength(0);
  });
});
