// The first piece, the one the game began with (tools/music.mjs renders it; src/app/music.ts starts
// every visit with it).
//
// C major, 64 beats a minute, four beats to a bar, one chord a bar: F, C over E, A minor, G with its
// fourth, home to C. The tune uses only C D E G A, the notes the game itself plays when a piece is
// placed, so nothing a player does can rub against it. The left hand plays slow broken chords; the
// right hand a few long notes. It begins and ends in silence, so it needs no seam.
//
//   bars 1–4     the left hand alone, two high notes
//   bars 5–12    the tune
//   bars 13–14   a breath on C
//   bars 15–22   a second strain, from A minor, higher and then sinking
//   bars 23–26   the left hand in flowing quavers, a few single high notes over it
//   bars 27–34   the tune again over the flowing left hand
//   bars 35–38   home: slower, a last soft chord of C left to ring

// ── the left hand's patterns ──────────────────────────────────────────────────────────────────────
const CHORDS = {
  F: { slow: ['F2', 'C3', 'F3', 'A3'], flow: ['F2', 'C3', 'F3', 'A3', 'C4', 'A3', 'F3'] },
  'C/E': { slow: ['E2', 'C3', 'G3', 'C4'], flow: ['E2', 'C3', 'E3', 'G3', 'C4', 'G3', 'E3'] },
  Am7: { slow: ['A2', 'E3', 'G3', 'C4'], flow: ['A2', 'E3', 'G3', 'C4', 'E4', 'C4', 'G3'] },
  Gsus: { slow: ['G2', 'D3', 'G3', 'C4'], flow: ['G2', 'D3', 'G3', 'C4', 'D4', 'C4', 'G3'] },
  C: { slow: ['C3', 'G3', 'C4', 'E4'], flow: ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4'] },
};
/** Crotchets: [beat, note, velocity, beats held]. */
const slow = (chord, v = 42) => CHORDS[chord].slow.map((n, i) => [i, n, i === 0 ? v + 3 : v - (i === 3 ? 2 : 0), 1]);
/** Quavers up the chord and back, a crotchet to end. */
const flow = (chord, v = 42) => CHORDS[chord].flow.map((n, i) => [i * 0.5, n, i === 0 ? v + 3 : v + (i === 4 ? 2 : 0) - (i === 6 ? 2 : 0), i === 6 ? 1 : 0.5]);
/** Minims: the root, then the fifth above it. */
const half = (chord, v = 40) => CHORDS[chord].slow.slice(0, 2).map((n, i) => [i * 2, n, v - i * 3, 2]);

// ── the piece ─────────────────────────────────────────────────────────────────────────────────────
// Right hand: [beat, note, velocity, beats held].
const PIECE = [
  // The left hand alone, and two high notes.
  { chord: 'F', lh: slow('F', 39) },
  { chord: 'C/E', lh: slow('C/E', 39) },
  { chord: 'Am7', lh: slow('Am7', 40), rh: [[2, 'E5', 45, 2]] },
  { chord: 'Gsus', lh: slow('Gsus', 39), rh: [[1, 'D5', 43, 3]] },
  // The tune.
  { chord: 'F', lh: slow('F'), rh: [[2, 'A4', 51, 1], [3, 'C5', 54, 1]] },
  { chord: 'C/E', lh: slow('C/E'), rh: [[0, 'E5', 57, 3], [3, 'D5', 52, 1]] },
  { chord: 'Am7', lh: slow('Am7'), rh: [[0, 'C5', 54, 3], [3, 'G4', 49, 1]] },
  { chord: 'Gsus', lh: slow('Gsus'), rh: [[0, 'A4', 51, 2], [2, 'G4', 48, 2]] },
  { chord: 'F', lh: slow('F'), rh: [[1, 'A4', 51, 1], [2, 'C5', 54, 1], [3, 'E5', 57, 1]] },
  { chord: 'C/E', lh: slow('C/E'), rh: [[0, 'G5', 60, 2], [2, 'E5', 55, 2]] },
  { chord: 'Am7', lh: slow('Am7'), rh: [[0, 'D5', 55, 2], [2, 'C5', 52, 1], [3, 'A4', 49, 1]] },
  { chord: 'C', lh: slow('C', 41), rh: [[0, 'G4', 50, 4]] },
  // A breath.
  { chord: 'C', lh: [[0, 'C2', 40, 4], [0, 'G2', 37, 4], [2, 'E3', 36, 2]] },
  { chord: 'C', hold: true, rh: [[1, 'C5', 42, 3]] },
  // The second strain.
  { chord: 'Am7', lh: slow('Am7'), rh: [[0, 'E5', 55, 2], [2, 'G5', 58, 2]] },
  { chord: 'F', lh: slow('F'), rh: [[0, 'A5', 60, 2], [2, 'G5', 55, 1], [3, 'E5', 52, 1]] },
  { chord: 'C/E', lh: slow('C/E'), rh: [[0, 'D5', 54, 3], [3, 'E5', 51, 1]] },
  { chord: 'Gsus', lh: slow('Gsus'), rh: [[0, 'D5', 52, 4]] },
  { chord: 'Am7', lh: slow('Am7', 41), rh: [[1, 'C5', 50, 1], [2, 'E5', 54, 2]] },
  { chord: 'F', lh: slow('F', 41), rh: [[0, 'A4', 51, 2], [2, 'C5', 52, 2]] },
  { chord: 'C/E', lh: slow('C/E', 40), rh: [[0, 'G4', 49, 2], [2, 'E4', 46, 2]] },
  { chord: 'Gsus', lh: [[0, 'G2', 42, 2], [1, 'D3', 38, 2], [2, 'G3', 37, 2]], rh: [[0, 'D4', 46, 4]] },
  // The left hand flows; single high notes.
  { chord: 'F', lh: flow('F', 39), rh: [[2, 'E6', 40, 2]] },
  { chord: 'C/E', lh: flow('C/E', 39) },
  { chord: 'Am7', lh: flow('Am7', 40), rh: [[1, 'C6', 41, 2], [3, 'G5', 40, 1]] },
  { chord: 'Gsus', lh: flow('Gsus', 39), rh: [[2, 'D6', 39, 2]] },
  // The tune again, over the flowing left hand.
  { chord: 'F', lh: flow('F'), rh: [[0, 'C5', 56, 2], [2, 'A4', 52, 1], [3, 'C5', 55, 1]] },
  { chord: 'C/E', lh: flow('C/E'), rh: [[0, 'E5', 59, 3], [3, 'D5', 53, 1]] },
  { chord: 'Am7', lh: flow('Am7'), rh: [[0, 'C5', 55, 3], [3, 'G4', 50, 1]] },
  { chord: 'Gsus', lh: flow('Gsus'), rh: [[0, 'A4', 52, 2], [2, 'G4', 49, 2]] },
  { chord: 'F', lh: flow('F'), rh: [[1, 'A4', 52, 1], [2, 'C5', 55, 1], [3, 'E5', 58, 1]] },
  { chord: 'C/E', lh: flow('C/E'), rh: [[0, 'G5', 61, 2], [2, 'E5', 56, 2]] },
  { chord: 'Am7', lh: flow('Am7', 41), rh: [[0, 'D5', 55, 2], [2, 'E5', 53, 1], [3, 'C5', 50, 1]] },
  { chord: 'C', lh: slow('C', 40), rh: [[0, 'C5', 50, 4]] },
  // Home.
  { chord: 'F', lh: half('F'), rh: [[2, 'A4', 47, 1], [3, 'G4', 45, 1]] },
  { chord: 'C/E', lh: half('C/E', 39), rh: [[0, 'E4', 46, 4]] },
  { chord: 'C', lh: [[0, 'C3', 40, 3], [0, 'G3', 37, 3]], rh: [[0, 'C4', 45, 1], [1, 'E4', 44, 1], [2, 'G4', 43, 2]] },
  { chord: 'C', lh: [[0, 'C2', 37, 4], [0, 'G2', 35, 4]], rh: [[0, 'E4', 36, 4], [0, 'C5', 40, 4]] },
];

export default { name: 'little-city-piano', title: 'the first piece', bpm: 64, beats: 4, seed: 0x51ce, start: 0.4, ring: 7.5, bars: PIECE };
