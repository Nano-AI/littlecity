import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMusic, nextRound } from './music';

/** Numbers in [0, 1), the same every run. */
function seeded(seed: number): () => number {
  let s = Math.imul(seed + 1, 0x9e3779b1) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('the order of the pieces', () => {
  test('the first round is every piece once', () => {
    for (let seed = 0; seed < 200; seed++) expect([...nextRound(null, 3, seeded(seed))].sort()).toEqual([0, 1, 2]);
  });

  test('any piece may open a visit, in any order', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) seen.add(nextRound(null, 3, seeded(seed)).join(''));
    expect([...seen].sort()).toEqual(['012', '021', '102', '120', '201', '210']);
  });

  test('a later round is every piece once, and never begins with the piece just heard', () => {
    const seen = new Set<string>();
    for (let previous = 0; previous < 3; previous++) {
      for (let seed = 0; seed < 300; seed++) {
        const round = nextRound(previous, 3, seeded(seed));
        expect([...round].sort()).toEqual([0, 1, 2]);
        expect(round[0]).not.toBe(previous);
        seen.add(`${previous}:${round.join('')}`);
      }
    }
    // Four of the six orders are open after any piece, and all of them turn up.
    expect(seen.size).toBe(12);
  });

  test('a long listen: nothing twice in a row, every piece in every round', () => {
    const random = seeded(7);
    const heard: number[] = [];
    let previous: number | null = null;
    for (let k = 0; k < 400; k++) {
      const round = nextRound(previous, 3, random);
      heard.push(...round);
      previous = round[round.length - 1]!;
    }
    for (let i = 1; i < heard.length; i++) expect(heard[i]).not.toBe(heard[i - 1]);
    for (let i = 0; i < heard.length; i += 3) expect(heard.slice(i, i + 3).sort()).toEqual([0, 1, 2]);
  });

  test('one piece is played over and over; none is nothing; an unlucky 1 from the dice still gives an order', () => {
    expect(nextRound(null, 1)).toEqual([0]);
    expect(nextRound(0, 1)).toEqual([0]);
    expect(nextRound(null, 0)).toEqual([]);
    expect([...nextRound(2, 3, () => 1)].sort()).toEqual([0, 1, 2]);
    expect(nextRound(2, 3, () => 1)[0]).not.toBe(2);
  });
});

describe('the player', () => {
  /** What stands in for the browser's audio element. */
  class FakeAudio {
    static made: FakeAudio[] = [];
    src = '';
    preload = '';
    volume = 1;
    paused = true;
    /** Every file it was told to play, in order. */
    played: string[] = [];
    private readonly listeners = new Map<string, (() => void)[]>();
    constructor() {
      FakeAudio.made.push(this);
    }
    addEventListener(type: string, fn: () => void): void {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
    }
    play(): Promise<void> {
      this.paused = false;
      this.played.push(this.src);
      return Promise.resolve();
    }
    pause(): void {
      this.paused = true;
    }
    /** The piece comes to its end, or its file will not load. */
    emit(type: 'ended' | 'error'): void {
      this.paused = true;
      for (const fn of this.listeners.get(type) ?? []) fn();
    }
  }
  const page = new EventTarget();
  const URLS = ['one.mp3', 'two.mp3', 'three.mp3'];

  beforeEach(() => {
    vi.useFakeTimers();
    FakeAudio.made = [];
    // No localStorage and no Web Audio here: the default level, on the element's own volume.
    vi.stubGlobal('window', page);
    vi.stubGlobal('document', { hidden: false, addEventListener: () => undefined, removeEventListener: () => undefined });
    vi.stubGlobal('Audio', FakeAudio);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('nothing until the first gesture; then a piece', () => {
    const music = createMusic(URLS, seeded(3));
    expect(music.started).toBe(false);
    expect(FakeAudio.made).toHaveLength(0);
    page.dispatchEvent(new Event('pointerdown'));
    expect(music.started).toBe(true);
    expect(FakeAudio.made).toHaveLength(1);
    expect(FakeAudio.made[0]!.played).toEqual([URLS[music.track]]);
    expect(FakeAudio.made[0]!.volume).toBe(music.volume);
    music.dispose();
  });

  test('after a piece, a pause, then another piece: one element, one file at a time, never the same twice running', () => {
    const music = createMusic(URLS, seeded(11));
    page.dispatchEvent(new Event('keydown'));
    const audio = FakeAudio.made[0]!;
    for (let k = 1; k < 30; k++) {
      audio.emit('ended');
      // The pause: the next file is in hand, and nothing plays, whatever the player does.
      expect(audio.src).toBe(URLS[music.track]);
      expect(audio.played).toHaveLength(k);
      page.dispatchEvent(new Event('pointerdown'));
      vi.advanceTimersByTime(20_000);
      expect(audio.played).toHaveLength(k);
      vi.advanceTimersByTime(10_000);
      expect(audio.played).toHaveLength(k + 1);
      expect(audio.played[k]).toBe(audio.src);
      expect(audio.played[k]).not.toBe(audio.played[k - 1]);
    }
    expect(FakeAudio.made).toHaveLength(1);
    for (let i = 0; i < audio.played.length; i += 3) expect(audio.played.slice(i, i + 3).sort()).toEqual([...URLS].sort());
    music.dispose();
  });

  test('a piece whose file will not load is passed over', () => {
    const music = createMusic(URLS, seeded(5));
    page.dispatchEvent(new Event('pointerdown'));
    const audio = FakeAudio.made[0]!;
    // While it should be playing: on to the next, after the pause.
    const first = audio.src;
    audio.emit('error');
    const second = audio.src;
    expect(second).not.toBe(first);
    // And the next one's file fails during the pause: that pause ends in another, and the third piece plays.
    audio.emit('error');
    vi.advanceTimersByTime(25_000);
    expect(audio.played).toEqual([first]);
    expect(audio.src).not.toBe(second);
    vi.advanceTimersByTime(25_000);
    expect(audio.played).toEqual([first, audio.src]);
    music.dispose();
  });

  test('the Music slider: 0 stops it, and it comes back where it was', () => {
    const music = createMusic(URLS, seeded(1));
    page.dispatchEvent(new Event('pointerdown'));
    const audio = FakeAudio.made[0]!;
    const playing = audio.src;
    page.dispatchEvent(new CustomEvent('lc:music-volume', { detail: 0 }));
    expect(music.volume).toBe(0);
    expect(audio.paused).toBe(true);
    page.dispatchEvent(new CustomEvent('lc:music-volume', { detail: 0.75 }));
    expect(music.volume).toBe(0.75);
    expect(audio.volume).toBe(0.75);
    expect(audio.paused).toBe(false);
    expect(audio.src).toBe(playing);
    music.dispose();
  });
});
