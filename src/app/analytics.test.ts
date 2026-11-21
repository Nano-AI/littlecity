import type { CaptureResult } from 'posthog-js';
import { describe, expect, it } from 'vitest';
import { scrub, tally, track } from './analytics';

describe('analytics', () => {
  it('cuts a share link town out of every URL it sends', () => {
    const event = {
      uuid: 'x',
      event: '$pageview',
      properties: { $current_url: 'https://littlecity.io/#t=AbCdEf', $pathname: '/', seconds: 30 },
      $set_once: { $initial_current_url: 'https://littlecity.io/?a=1#t=AbCdEf' },
    } as unknown as CaptureResult;
    const out = scrub(event)!;
    expect(out.properties.$current_url).toBe('https://littlecity.io/');
    expect(out.properties.seconds).toBe(30);
    expect(out.$set_once!.$initial_current_url).toBe('https://littlecity.io/?a=1');
  });

  it('does nothing until it is started', () => {
    expect(() => {
      track('town_opened', { how: 'new' });
      tally('uses');
    }).not.toThrow();
  });
});
