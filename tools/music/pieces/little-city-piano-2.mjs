// The second piece: chords over a falling bass.
//
// C major, 60 beats a minute, four beats to a bar, one chord a bar. The bass walks down a step at a
// time (C, B, A, G, F, E, D) and turns back at G; over it the chords hardly move, one note at a time:
// C with its ninth, G over B, A minor seventh, C over G, F major seventh, C over E, D minor ninth, G
// with its fourth. Each bar is a slow wave: the bass, then the chord softly rolled, then the tune.
// The first time the tune is one note a bar, climbing C D E G A while the bass falls, and sinking
// back. The tune keeps to C D E G A (the notes the game plays); F is only ever deep in the left hand
// and B only the bass of G over B or the soft third that G's fourth falls to (tools/music/score.mjs).
//
//   bars 1–8     the wave: bass, chord, one note of the tune a bar
//   bars 9–16    the tune sung out over the same chords
//   bars 17–24   the middle, from F: the hands higher and lighter, single notes like bells falling
//                by fourths, then sinking back to the deep bass
//   bars 25–32   the tune again, the chords struck whole with the bass and echoed, up to a high C
//   bars 33–38   home: the wave again from F, a last C with its ninth left to ring

import { evened } from '../score.mjs';

/** The falling bass's chords: the bass, the chord above it, and how many of the chord's notes are struck with the bass. */
const VOICED = {
  Cadd9: ['C3', ['G3', 'D4', 'E4']],
  // The sixth goes down with the bass, so a B is never heard alone.
  'G/B': ['B2', ['G3', 'D4', 'G4'], 1],
  Am7: ['A2', ['G3', 'C4', 'E4']],
  'C/G': ['G2', ['G3', 'C4', 'E4']],
  Fmaj7: ['F2', ['A3', 'C4', 'E4']],
  'C/E': ['E2', ['G3', 'C4', 'E4']],
  Dm9: ['D2', ['F3', 'C4', 'E4']],
  Gsus: ['G2', ['G3', 'C4', 'D4']],
};
const ROUND = ['Cadd9', 'G/B', 'Am7', 'C/G', 'Fmaj7', 'C/E', 'Dm9', 'Gsus'];

/** The wave: the bass on the first beat, the chord rolled on the second. [beat, note, velocity, beats held]. */
const waveOf = (bass, chord, vb, vc, early = 0) => [
  [0, bass, vb, 4],
  ...chord.map((n, i) => (i < early ? [0, n, vc, 4] : [1, n, vc + (i === chord.length - 1 ? 1 : 0), 3])),
];
const wave = (name, vb = 41, vc = 36) => waveOf(VOICED[name][0], VOICED[name][1], vb, vc, VOICED[name][2] ?? 0);
/** The chord struck whole with the bass, rolled, and its upper two notes again on the third beat. */
const whole = (name, vb = 42, vc = 36) => {
  const [bass, chord] = VOICED[name];
  return [[0, bass, vb, 4], ...chord.map((n, i) => [0, n, vc, i === 0 ? 4 : 1.8]), ...chord.slice(1).map((n) => [2, n, 35, 2])];
};
/** G with its fourth, the fourth falling to the third on the third beat under the held bass (the pedal changes there). */
const falls = (vb, vc, struck) =>
  struck
    ? { chord: 'Gsus→G', pedal: [2], lh: [[0, 'G2', vb, 4], [0, 'G3', vc, 4], [0, 'C4', vc, 1.9], [0, 'D4', vc, 4], [2, 'B3', 36, 2]] }
    : { chord: 'Gsus→G', pedal: [2], lh: [[0, 'G2', vb, 4], [1, 'G3', vc, 3], [1, 'C4', vc, 0.9], [1, 'D4', vc + 1, 3], [2, 'B3', 36, 2]] };

const BARS = [
  // The wave: one note of the tune a bar, climbing as the bass falls.
  ...['C5', 'D5', 'E5', 'G5', 'A5', 'G5', 'E5', 'D5'].map((note, i) => ({
    chord: ROUND[i],
    lh: wave(ROUND[i], 40, 35),
    rh: [[2, note, [47, 47, 48, 49, 50, 48, 47, 46][i], 2]],
  })),
  // The tune sung out.
  { chord: 'Cadd9', lh: wave('Cadd9'), rh: [[0, 'E5', 53, 2], [2, 'G5', 55, 2]] },
  { chord: 'G/B', lh: wave('G/B'), rh: [[0, 'D5', 54, 3], [3, 'E5', 51, 1]] },
  { chord: 'Am7', lh: wave('Am7'), rh: [[0, 'C5', 53, 3], [3, 'D5', 51, 1]] },
  { chord: 'C/G', lh: wave('C/G'), rh: [[0, 'E5', 54, 2], [2, 'G5', 56, 2]] },
  { chord: 'Fmaj7', lh: wave('Fmaj7'), rh: [[0, 'A5', 56, 3], [3, 'G5', 53, 1]] },
  { chord: 'C/E', lh: wave('C/E'), rh: [[0, 'E5', 54, 2], [2, 'D5', 52, 1], [3, 'C5', 51, 1]] },
  { chord: 'Dm9', lh: wave('Dm9'), rh: [[0, 'D5', 53, 3], [3, 'E5', 51, 1]] },
  { ...falls(41, 36, false), rh: [[0, 'D5', 51, 4]] },
  // The middle: higher and lighter, bells falling by fourths; then the deep bass again.
  { chord: 'Fadd9', lh: waveOf('F3', ['C4', 'G4', 'A4'], 39, 35), rh: [[2, 'C6', 44, 2]] },
  { chord: 'C/E', lh: waveOf('E3', ['C4', 'D4', 'G4'], 39, 35), rh: [[2, 'G5', 46, 2]] },
  { chord: 'Dm9', lh: waveOf('D3', ['F3', 'C4', 'E4'], 39, 35), rh: [[2, 'A5', 46, 2]] },
  { chord: 'Am7', lh: wave('Am7', 40, 35), rh: [[2, 'E5', 46, 2]] },
  { chord: 'Fadd9', lh: waveOf('F2', ['A3', 'C4', 'G4'], 40, 35), rh: [[2, 'G5', 47, 2]] },
  { chord: 'C/E', lh: waveOf('E2', ['G3', 'C4', 'D4'], 40, 35), rh: [[2, 'D5', 47, 2]] },
  { chord: 'Dm9', lh: wave('Dm9'), rh: [[0, 'E5', 50, 2], [2, 'C5', 49, 2]] },
  { ...falls(41, 36, false), rh: [[0, 'D5', 50, 4]] },
  // The tune again, the chords struck whole.
  { chord: 'Cadd9', lh: whole('Cadd9'), rh: [[0, 'E5', 54, 2], [2, 'G5', 56, 2]] },
  { chord: 'G/B', lh: whole('G/B'), rh: [[0, 'D5', 55, 3], [3, 'E5', 52, 1]] },
  { chord: 'Am7', lh: whole('Am7'), rh: [[0, 'C5', 54, 3], [3, 'D5', 52, 1]] },
  { chord: 'C/G', lh: whole('C/G'), rh: [[0, 'E5', 55, 2], [2, 'G5', 56, 2]] },
  { chord: 'Fmaj7', lh: whole('Fmaj7'), rh: [[0, 'A5', 57, 2], [2, 'C6', 53, 2]] },
  { chord: 'C/E', lh: whole('C/E'), rh: [[0, 'G5', 55, 3], [3, 'E5', 52, 1]] },
  { chord: 'Dm9', lh: whole('Dm9'), rh: [[0, 'D5', 54, 2], [2, 'E5', 52, 2]] },
  { ...falls(42, 37, true), rh: [[0, 'D5', 51, 4]] },
  // Home.
  { chord: 'Fmaj7', lh: wave('Fmaj7', 40, 35), rh: [[2, 'C5', 47, 2]] },
  { chord: 'C/E', lh: wave('C/E', 40, 35), rh: [[2, 'E5', 47, 2]] },
  { chord: 'Dm9', lh: wave('Dm9', 40, 35), rh: [[2, 'D5', 46, 2]] },
  { chord: 'Gsus', lh: wave('Gsus', 39, 35) },
  { chord: 'Cadd9', lh: wave('Cadd9', 39, 35), rh: [[2, 'C5', 43, 2]] },
  { chord: 'Cadd9', lh: [[0, 'C2', 37, 4], [1, 'G3', 35, 3], [1, 'D4', 35, 3], [1, 'E4', 35, 3]], rh: [[2, 'G4', 37, 2]] },
];

export default { name: 'little-city-piano-2', title: 'the second piece: chords over a falling bass', bpm: 60, beats: 4, seed: 0x2b1e, start: 0.4, ring: 8, roll: 0.045, tuneLast: true, bars: evened(BARS) };
