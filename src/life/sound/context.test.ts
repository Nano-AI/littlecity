import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdAudio, releaseAudio } from './context';

let made = 0;
let closed = 0;
class Fake {
  state = 'running';
  constructor() {
    made++;
  }
  close() {
    closed++;
    this.state = 'closed';
    return Promise.resolve();
  }
}

afterEach(() => {
  // Let go of anything a test left held, so the module state starts clean.
  releaseAudio();
  releaseAudio();
  releaseAudio();
  vi.unstubAllGlobals();
  made = 0;
  closed = 0;
});

describe('shared audio context', () => {
  it('three holders share one context', () => {
    vi.stubGlobal('AudioContext', Fake);
    const a = holdAudio();
    expect(holdAudio()).toBe(a);
    expect(holdAudio()).toBe(a);
    expect(made).toBe(1);
  });

  it('closes only when the last holder lets go', () => {
    vi.stubGlobal('AudioContext', Fake);
    holdAudio();
    holdAudio();
    releaseAudio();
    expect(closed).toBe(0);
    releaseAudio();
    expect(closed).toBe(1);
  });

  it('a fresh context after every holder released it', () => {
    vi.stubGlobal('AudioContext', Fake);
    const first = holdAudio();
    releaseAudio();
    const second = holdAudio();
    expect(made).toBe(2);
    expect(second).not.toBe(first);
    expect(second.state).not.toBe('closed');
  });
});
