// How loud: the player's two volumes, kept in the browser (not in the town).
//
//   sounds   the game's own sound (placing notes, the sea, bells…), a level on top of Sound: on/off
//   music    the background piano (src/app/music.ts); 0 is off
//
// The menu writes them (src/ui/interface.ts) and says so with an event; whoever makes the sound
// listens: 'lc:sound-volume' and 'lc:music-volume', detail the new level 0–1.

export const SOUND_VOLUME_KEY = 'little-city.sound-volume';
export const MUSIC_VOLUME_KEY = 'little-city.music-volume';
export const SOUND_VOLUME_EVENT = 'lc:sound-volume';
export const MUSIC_VOLUME_EVENT = 'lc:music-volume';
/** Until the player says otherwise: sounds at full (once turned on), the music quiet. */
export const SOUND_VOLUME_DEFAULT = 1;
export const MUSIC_VOLUME_DEFAULT = 0.4;

/** A stored level as a number 0–1; anything else is the fallback. */
export function parseVolume(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

export function readVolume(key: string, fallback: number): number {
  try {
    return parseVolume(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

/** Keeps a level and tells whoever is listening. */
export function writeVolume(key: string, event: string, value: number): number {
  const v = Math.min(1, Math.max(0, value));
  try {
    window.localStorage.setItem(key, String(Math.round(v * 100) / 100));
  } catch {
    // No storage: the level lasts until the page closes.
  }
  window.dispatchEvent(new CustomEvent(event, { detail: v }));
  return v;
}
