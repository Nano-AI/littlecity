// The background music: three slow piano pieces (public/music, made by tools/music.mjs), played
// quietly while the town is built, one after another with a pause between. Owner: Interface.
//
// The pieces are shuffled (Derek, 2026-11-21: "just shuffle the order"): a round in a shuffled
// order, then all of them shuffled again, and so on: every piece once a round, and never the same
// piece twice in a row (nextRound). One file is fetched at a time: the next piece's only when the
// one before it has ended.
//
// It belongs to the page, not to a town: a new island does not start it over. It starts on the
// player's first click or key (browsers allow sound only from a gesture), fades in, stops while the
// page is hidden, and follows the menu's Music slider ('lc:music-volume'; 0 is off) and its Sound
// switch ('lc:sound': off silences the music too; Derek, 2026-11-21).
//
// The level is a gain node where there is Web Audio (an iPhone ignores an audio element's own
// volume), and the element's volume otherwise. All the pieces play through the one audio element
// (the one the first gesture allowed to sound), so the gain node is made once.

import { MUSIC_VOLUME_DEFAULT, MUSIC_VOLUME_EVENT, MUSIC_VOLUME_KEY, SOUND_EVENT, readVolume, soundOn } from '@/life/sound/volume';

/** The pieces' files in public/music, the first the one the game began with. */
const PIECES = ['little-city-piano', 'little-city-piano-2', 'little-city-piano-3'];
/** The pause between one piece and the next, seconds. */
const GAP = 24;
/** The fade in when it first starts, and when it comes back after being off: seconds to most of the way. */
const FADE = 1.6;

/**
 * The order of the next round, every piece once (pieces are numbered from 0). Every round is a
 * shuffle of them all (any piece may open a visit); a later round does not begin with `previous`,
 * the piece just heard. `random` gives numbers in [0, 1).
 */
export function nextRound(previous: number | null, count: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length: Math.max(0, count) }, (_, i) => i);
  const swap = (a: number, b: number): void => {
    const held = order[a]!;
    order[a] = order[b]!;
    order[b] = held;
  };
  /** A whole number from `lo` to `hi`, both included. */
  const pick = (lo: number, hi: number): number => Math.min(hi, lo + Math.floor(random() * (hi - lo + 1)));
  for (let i = order.length - 1; i > 0; i--) swap(i, pick(0, i));
  // The piece just heard would be first: it changes places with one of the others.
  if (previous !== null && order.length > 1 && order[0] === previous) swap(0, pick(1, order.length - 1));
  return order;
}

export interface Music {
  /** The level in use, 0–1. */
  readonly volume: number;
  /** The music has been started (after the first gesture, with the level above 0). */
  readonly started: boolean;
  /** The piece playing, or the one waiting to play after the pause: its number, from 0. */
  readonly track: number;
  dispose(): void;
}

export function createMusic(urls: readonly string[] = PIECES.map((name) => `${import.meta.env.BASE_URL}music/${name}.mp3`), random: () => number = Math.random): Music {
  /** The slider's level, and the level in use: nothing while the menu's Sound switch is off. */
  let level = readVolume(MUSIC_VOLUME_KEY, MUSIC_VOLUME_DEFAULT);
  let muted = !soundOn();
  let volume = muted ? 0 : level;
  let element: HTMLAudioElement | null = null;
  let gain: GainNode | null = null;
  let context: AudioContext | null = null;
  let again: ReturnType<typeof setTimeout> | null = null;
  /** Between two pieces: nothing sounds until `again` fires. */
  let resting = false;
  /** The file of the piece waiting to play would not load. */
  let missing = false;
  let gestured = false;
  /** What is left of this round, and the piece playing (or waiting to). */
  const round = nextRound(null, urls.length, random);
  let track = round.shift() ?? 0;

  const setLevel = (seconds: number): void => {
    if (gain && context) gain.gain.setTargetAtTime(volume, context.currentTime, seconds / 3);
    else if (element) element.volume = volume;
  };
  const play = (): void => {
    if (!element || volume <= 0 || document.hidden || resting) return;
    void context?.resume();
    // A refusal (no gesture yet, the file missing) is not an error: the next gesture tries again.
    void element.play().catch(() => undefined);
  };
  /** A piece is over: the pause, with the next piece's file fetched meanwhile, then that piece. */
  const rest = (): void => {
    if (!element) return;
    resting = true;
    missing = false;
    if (round.length === 0) round.push(...nextRound(track, urls.length, random));
    track = round.shift() ?? 0;
    element.src = urls[track]!;
    again = setTimeout(() => {
      again = null;
      // A piece whose file would not come is passed over: another pause, and the one after it.
      if (missing) return rest();
      resting = false;
      play();
    }, GAP * 1000);
  };
  const failed = (): void => {
    if (resting) missing = true;
    else rest();
  };
  const start = (): void => {
    if (element || volume <= 0 || urls.length === 0) return;
    try {
      element = new Audio();
      element.preload = 'auto';
      element.src = urls[track]!;
      const Ctx = window.AudioContext;
      if (typeof Ctx === 'function') {
        context = new Ctx();
        gain = context.createGain();
        gain.gain.value = 0;
        context.createMediaElementSource(element).connect(gain).connect(context.destination);
      } else element.volume = 0;
      element.addEventListener('ended', rest);
      element.addEventListener('error', failed);
    } catch {
      // No audio here (or not this kind): the game is silent, as it was.
      element = null;
      gain = null;
      context = null;
      return;
    }
    setLevel(FADE);
    play();
  };

  const gesture = (): void => {
    gestured = true;
    if (!element) start();
    else if (element.paused) play();
  };
  /** The slider moved, or the Sound switch was flipped: the level in use follows. */
  const apply = (): void => {
    const was = volume;
    volume = muted ? 0 : level;
    if (volume <= 0) {
      setLevel(0.2);
      element?.pause();
      return;
    }
    if (!element) {
      if (gestured) start();
      return;
    }
    setLevel(was <= 0 ? FADE : 0.1);
    if (element.paused) play();
  };
  const changed = (e: Event): void => {
    level = Math.min(1, Math.max(0, (e as CustomEvent<number>).detail));
    apply();
  };
  const switched = (e: Event): void => {
    muted = (e as CustomEvent<boolean>).detail === false;
    apply();
  };
  const visibility = (): void => {
    if (document.hidden) element?.pause();
    else play();
  };
  window.addEventListener('pointerdown', gesture);
  window.addEventListener('keydown', gesture);
  window.addEventListener(MUSIC_VOLUME_EVENT, changed);
  window.addEventListener(SOUND_EVENT, switched);
  document.addEventListener('visibilitychange', visibility);

  return {
    get volume() {
      return volume;
    },
    get started() {
      return element !== null;
    },
    get track() {
      return track;
    },
    dispose() {
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('keydown', gesture);
      window.removeEventListener(MUSIC_VOLUME_EVENT, changed);
      window.removeEventListener(SOUND_EVENT, switched);
      document.removeEventListener('visibilitychange', visibility);
      if (again !== null) clearTimeout(again);
      element?.pause();
      element = null;
      void context?.close();
    },
  };
}
