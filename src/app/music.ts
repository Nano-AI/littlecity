// The background music: one slow piano piece (public/music, made by tools/music.mjs), played
// quietly while the town is built, with a pause before it comes round again. Owner: Interface.
//
// It belongs to the page, not to a town: a new island does not start it over. It starts on the
// player's first click or key (browsers allow sound only from a gesture), fades in, stops while the
// page is hidden, and follows the menu's Music slider ('lc:music-volume'; 0 is off).
//
// The level is a gain node where there is Web Audio (an iPhone ignores an audio element's own
// volume), and the element's volume otherwise.

import { MUSIC_VOLUME_DEFAULT, MUSIC_VOLUME_EVENT, MUSIC_VOLUME_KEY, readVolume } from '@/life/sound/volume';

/** The pause between one playing and the next, seconds. */
const GAP = 24;
/** The fade in when it first starts, and when it comes back after being off: seconds to most of the way. */
const FADE = 1.6;

export interface Music {
  /** The level in use, 0–1. */
  readonly volume: number;
  /** The piece has been started (after the first gesture, with the level above 0). */
  readonly started: boolean;
  dispose(): void;
}

export function createMusic(url: string = `${import.meta.env.BASE_URL}music/little-city-piano.mp3`): Music {
  let volume = readVolume(MUSIC_VOLUME_KEY, MUSIC_VOLUME_DEFAULT);
  let element: HTMLAudioElement | null = null;
  let gain: GainNode | null = null;
  let context: AudioContext | null = null;
  let again: ReturnType<typeof setTimeout> | null = null;
  /** Between two playings: nothing sounds until `again` fires. */
  let resting = false;
  let gestured = false;

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
  const start = (): void => {
    if (element || volume <= 0) return;
    try {
      element = new Audio();
      element.preload = 'auto';
      element.src = url;
      const Ctx = window.AudioContext;
      if (typeof Ctx === 'function') {
        context = new Ctx();
        gain = context.createGain();
        gain.gain.value = 0;
        context.createMediaElementSource(element).connect(gain).connect(context.destination);
      } else element.volume = 0;
      element.addEventListener('ended', () => {
        resting = true;
        again = setTimeout(() => {
          resting = false;
          again = null;
          play();
        }, GAP * 1000);
      });
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
  const changed = (e: Event): void => {
    const was = volume;
    volume = Math.min(1, Math.max(0, (e as CustomEvent<number>).detail));
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
  const visibility = (): void => {
    if (document.hidden) element?.pause();
    else play();
  };
  window.addEventListener('pointerdown', gesture);
  window.addEventListener('keydown', gesture);
  window.addEventListener(MUSIC_VOLUME_EVENT, changed);
  document.addEventListener('visibilitychange', visibility);

  return {
    get volume() {
      return volume;
    },
    get started() {
      return element !== null;
    },
    dispose() {
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('keydown', gesture);
      window.removeEventListener(MUSIC_VOLUME_EVENT, changed);
      document.removeEventListener('visibilitychange', visibility);
      if (again !== null) clearTimeout(again);
      element?.pause();
      element = null;
      void context?.close();
    },
  };
}
