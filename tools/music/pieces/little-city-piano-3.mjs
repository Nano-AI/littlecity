// The third piece: a slow lilt in three, from A minor home to C.
//
// 66 beats a minute, three beats to a bar, one chord a bar, broken. It leans on A minor (A minor
// seventh, F major seventh, D minor seventh, E minor seventh with no fifth, so there is no B in the
// piece at all) and comes to rest in C only at the end. The left hand either lilts (the bass, then
// two notes of the chord late in the bar) or rocks in quavers up the chord and back. The tune keeps to
// C D E G A, which from A is the minor pentatonic: the same five notes the game plays, turned sad.
//
//   bars 1–4     the left hand alone, lilting
//   bars 5–12    the tune, low and plain
//   bars 13–20   the tune again over rocking quavers, rising to a high A
//   bars 21–28   the middle, from F: both hands an octave up, lighter, towards C major
//   bars 29–32   a breath: the left hand lilting, two single notes
//   bars 33–40   the tune again as it first was, the lilt a note fuller, turned at its end to arrive in C
//   bars 41–48   home: the tune's first notes over F and C, a last soft chord of C left to ring

import { evened } from '../score.mjs';

/** Rocking: the bass and three notes above it, played up and back in quavers. */
const ROCK = {
  Am7: ['A2', 'E3', 'G3', 'C4'],
  Fmaj7: ['F2', 'C3', 'A3', 'E4'],
  'C/E': ['E2', 'C3', 'G3', 'C4'],
  Gsus: ['G2', 'D3', 'G3', 'C4'],
  Dm7: ['D2', 'A2', 'F3', 'C4'],
  Em7: ['E2', 'E3', 'G3', 'D4'],
  // The middle's, an octave up.
  'Fmaj7^': ['F3', 'C4', 'E4', 'A4'],
  'Gsus^': ['G3', 'C4', 'D4', 'G4'],
  'C/E^': ['E3', 'C4', 'E4', 'G4'],
  'Am7^': ['A3', 'C4', 'E4', 'G4'],
  'Dm9^': ['D3', 'A3', 'C4', 'E4'],
};
/** Lilting: the bass, and the two notes that follow it. */
const LILT = {
  Am7: ['A2', 'G3', 'C4'],
  Fmaj7: ['F2', 'A3', 'E4'],
  'C/E': ['E2', 'G3', 'C4'],
  Gsus: ['G2', 'C4', 'D4'],
  Dm7: ['D2', 'F3', 'C4'],
  Em7: ['E2', 'G3', 'D4'],
  C: ['C3', 'G3', 'E4'],
  'F/C': ['C3', 'F3', 'A3'],
};
/** [beat, note, velocity, beats held]: six quavers, up the chord and back. */
const rock = (chord, v = 38) => {
  const [r, a, b, c] = ROCK[chord];
  return [r, a, b, c, b, a].map((n, i) => [i * 0.5, n, i === 0 ? v + 3 : v - (i === 5 ? 2 : 0), 0.5]);
};
/** The bass on the first beat, then a quaver and a crotchet leading to the next bar. */
const lilt = (chord, v = 40) => {
  const [r, a, b] = LILT[chord];
  return [[0, r, v + 2, 1.5], [1.5, a, v - 3, 0.5], [2, b, v - 2, 1]];
};
/** The lilt with the chord's low note on the second beat: four notes climbing, the last two quicker. */
const fuller = (chord, v = 39) => {
  const [r, a] = ROCK[chord];
  const [, b, c] = LILT[chord];
  return [[0, r, v + 2, 1], [1, a, v - 3, 0.5], [1.5, b, v - 3, 0.5], [2, c, v - 2, 1]];
};
const bar = (name, lh, rh) => ({ chord: name.replace('^', ''), lh, rh });

const BARS = [
  // The left hand alone.
  bar('Am7', lilt('Am7', 38)),
  bar('Fmaj7', lilt('Fmaj7', 38)),
  bar('Dm7', lilt('Dm7', 38)),
  bar('Em7', lilt('Em7', 38)),
  // The tune, low and plain.
  bar('Am7', lilt('Am7'), [[0, 'A4', 50, 3]]),
  bar('Fmaj7', lilt('Fmaj7'), [[0, 'G4', 48, 1], [1, 'A4', 50, 1], [2, 'C5', 52, 1]]),
  bar('C/E', lilt('C/E'), [[0, 'D5', 54, 2], [2, 'E5', 53, 1]]),
  bar('Gsus', lilt('Gsus'), [[0, 'D5', 51, 3]]),
  bar('Am7', lilt('Am7'), [[0, 'E5', 54, 2], [2, 'D5', 51, 1]]),
  bar('Fmaj7', lilt('Fmaj7'), [[0, 'C5', 52, 2], [2, 'A4', 49, 1]]),
  bar('Dm7', lilt('Dm7'), [[0, 'D5', 52, 2], [2, 'C5', 50, 1]]),
  bar('Em7', lilt('Em7'), [[0, 'G4', 48, 3]]),
  // Again over rocking quavers, and up to a high A.
  bar('Am7', rock('Am7'), [[0, 'A4', 52, 3]]),
  bar('Fmaj7', rock('Fmaj7'), [[0, 'G4', 50, 1], [1, 'A4', 52, 1], [2, 'C5', 54, 1]]),
  bar('C/E', rock('C/E'), [[0, 'D5', 55, 2], [2, 'E5', 55, 1]]),
  bar('Gsus', rock('Gsus'), [[0, 'D5', 53, 3]]),
  bar('Am7', rock('Am7'), [[0, 'E5', 56, 2], [2, 'G5', 57, 1]]),
  bar('Fmaj7', rock('Fmaj7'), [[0, 'A5', 57, 3]]),
  bar('Dm7', rock('Dm7'), [[0, 'G5', 54, 1], [1, 'E5', 52, 1], [2, 'D5', 52, 1]]),
  bar('Em7', rock('Em7'), [[0, 'E5', 52, 3]]),
  // The middle: an octave up, lighter, towards C major.
  bar('Fmaj7^', rock('Fmaj7^'), [[0, 'A5', 55, 2], [2, 'G5', 53, 1]]),
  bar('Gsus^', rock('Gsus^'), [[0, 'E5', 53, 3]]),
  bar('C/E^', rock('C/E^'), [[0, 'G5', 55, 2], [2, 'E5', 52, 1]]),
  bar('Am7^', rock('Am7^'), [[0, 'D5', 52, 1], [1, 'C5', 51, 2]]),
  bar('Dm9^', rock('Dm9^'), [[0, 'D5', 53, 2], [2, 'E5', 54, 1]]),
  bar('C/E^', rock('C/E^'), [[0, 'G5', 56, 3]]),
  bar('Fmaj7^', rock('Fmaj7^'), [[0, 'A5', 56, 2], [2, 'C6', 52, 1]]),
  bar('Gsus^', rock('Gsus^'), [[0, 'A5', 54, 3]]),
  // A breath.
  bar('Am7', lilt('Am7', 38)),
  bar('Fmaj7', lilt('Fmaj7', 38), [[1, 'E5', 44, 2]]),
  bar('Dm7', lilt('Dm7', 38)),
  bar('Em7', lilt('Em7', 38), [[1, 'D5', 43, 2]]),
  // The tune again, turned to arrive in C.
  bar('Am7', fuller('Am7'), [[0, 'A4', 51, 3]]),
  bar('Fmaj7', fuller('Fmaj7'), [[0, 'G4', 49, 1], [1, 'A4', 51, 1], [2, 'C5', 53, 1]]),
  bar('C/E', fuller('C/E'), [[0, 'D5', 54, 2], [2, 'E5', 53, 1]]),
  bar('Gsus', fuller('Gsus'), [[0, 'D5', 51, 3]]),
  bar('Am7', fuller('Am7'), [[0, 'E5', 54, 2], [2, 'D5', 51, 1]]),
  bar('Fmaj7', fuller('Fmaj7'), [[0, 'C5', 52, 2], [2, 'A4', 49, 1]]),
  bar('Gsus', lilt('Gsus', 39), [[0, 'D5', 51, 2], [2, 'E5', 50, 1]]),
  bar('C', lilt('C', 39), [[0, 'C5', 49, 3]]),
  // Home.
  bar('Fmaj7', lilt('Fmaj7', 38), [[0, 'A4', 48, 3]]),
  bar('C/E', lilt('C/E', 38), [[0, 'G4', 46, 1], [1, 'A4', 47, 1], [2, 'C5', 49, 1]]),
  bar('Dm7', lilt('Dm7', 38), [[0, 'D5', 49, 2], [2, 'C5', 47, 1]]),
  bar('Gsus', lilt('Gsus', 38), [[0, 'D5', 46, 3]]),
  bar('C', lilt('C', 38), [[0, 'E5', 47, 3]]),
  bar('F/C', lilt('F/C', 38), [[0, 'C5', 45, 2], [2, 'A4', 43, 1]]),
  bar('C', [[0, 'C3', 38, 3], [1, 'G3', 35, 2], [2, 'E4', 35, 1]], [[0, 'G4', 43, 3]]),
  bar('C', [[0, 'C2', 36, 3], [0, 'G2', 35, 3]], [[0, 'E4', 35, 3], [0, 'G4', 35, 3], [0, 'C5', 39, 3]]),
];

export default { name: 'little-city-piano-3', title: 'the third piece: a slow lilt in three, from A minor home to C', bpm: 66, beats: 3, seed: 0x3c4d, start: 0.4, ring: 8, bars: evened(BARS) };
