// A piece as written (tools/music/pieces) becomes a piece as played: timed notes and pedal for the
// piano (tools/music/piano.mjs). Also what the piece is, printed bar by bar, and what it must keep to.
//
// A piece: { name, title, bpm, beats (to a bar, 4 unless said), seed, bars, and optionally start
// (seconds of silence before the first note), ring (seconds the last chord is left), roll (seconds
// between the notes of a rolled chord), tuneLast (the tune's note lands on top of a rolled chord) }.
// A bar: { chord, lh, rh, hold, pedal }. `lh` is the accompaniment and `rh` the tune, each a list of
// [beat, note, velocity, beats held]. The pedal changes at every bar line unless the bar says
// `hold`; `pedal: [2]` changes it again at that beat within the bar, and keys still held ring on
// through that change (a suspension resolving under a held bass).
//
// What every piece keeps to (check):
//   · white notes only, and the tune only C D E G A: the notes the game plays when a piece is placed
//     (C4 to D6, src/life/sound/synth.ts), which may sound at any moment over the music;
//   · nothing sounding together, the pedal counted, makes a minor second or ninth (E under F, B
//     under C, at any octave) or a tritone (F with B);
//   · against the game's five notes the only possible rubs are an F at or above the game's lowest E,
//     and a B under the game's C (no tritone can form: none of C D E G A has a white-note tritone
//     but through F–B). So F stays at or below F3, where every E the game has is a major seventh or
//     more above it, and B is only ever a soft bass or inner note, at or below B3, never the top.

import { midi } from './piano.mjs';

const GAME = [0, 2, 4, 7, 9];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const F3 = midi('F3');
const B3 = midi('B3');
/** The loudest a B may be written. */
const B_SOFT = 44;

/**
 * This piano is not even: measured one note at a time at one velocity (after tools/music/piano.mjs's
 * warmth and room), its A5 comes out about 3 dB above the notes either side and its G4 nearly 2,
 * its E5 over 1 dB under, and its lowest D and E ring some 4 dB fuller than the F and G above them.
 * A velocity step is a little under half a decibel here. The new pieces are written as if it were
 * even and touched up with this; the first piece is left exactly as it was made.
 */
const TOUCH = { A5: -4, G4: -3, E5: 2, D2: -4, E2: -4 };
/** The bars with each note's velocity touched up for this piano. */
export const evened = (bars) => {
  const hand = (list) => list?.map(([at, note, vel, len]) => [at, note, vel + (TOUCH[note] ?? 0), len]);
  return bars.map((bar) => ({ ...bar, ...(bar.lh ? { lh: hand(bar.lh) } : {}), ...(bar.rh ? { rh: hand(bar.rh) } : {}) }));
};

/** The piece as played: { notes, pedal, seconds, beat, barSeconds, start }. */
export function perform(piece) {
  const BEAT = 60 / piece.bpm;
  const BAR = (piece.beats ?? 4) * BEAT;
  const START = piece.start ?? 0.4;
  const RING = piece.ring ?? 7.5;
  const ROLL = piece.roll ?? 0.022;

  let seed = piece.seed;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const notes = [];
  const pedal = [{ t: START - 0.05, on: true }];
  /** The pedal changes within bars: keys held through them ring on. */
  const within = [];
  piece.bars.forEach((bar, b) => {
    const t0 = START + b * BAR;
    // A new harmony: the dampers come down on the old one as the new notes are struck.
    if (b > 0 && !bar.hold) pedal.push({ t: t0 - 0.012, on: false }, { t: t0 + 0.11, on: true });
    for (const at of bar.pedal ?? []) within.push({ t: t0 + at * BEAT - 0.012, on: false }, { t: t0 + at * BEAT + 0.11, on: true });
    const rolled = {};
    for (const [hand, list] of [['L', bar.lh ?? []], ['R', bar.rh ?? []]]) {
      const under = rolled.L ?? {};
      rolled[hand] = {};
      for (const [at, note, vel, len] of list) {
        const k = (rolled[hand][at] = (rolled[hand][at] ?? -1) + 1);
        // Chords rolled upwards, the right hand a touch behind the left, a few ms and a point or two of touch.
        const behind = hand === 'R' ? (piece.tuneLast && (under[at] ?? 0) >= 1 ? (under[at] + 1) * ROLL : 0.008) : 0;
        const t = t0 + at * BEAT + k * ROLL + behind + (rnd() - 0.5) * 0.008;
        notes.push({ t, len: len * BEAT, m: midi(note), v: Math.round(vel + (rnd() - 0.5) * 4), hand, bar: b + 1, note });
      }
    }
  });
  const seconds = START + piece.bars.length * BAR + RING;
  pedal.push({ t: seconds - 0.5, on: false });
  // Keys come up before the next change of pedal, so nothing is carried into the next harmony.
  notes.sort((a, b) => a.t - b.t);
  const offs = pedal.filter((p) => !p.on).map((p) => p.t);
  for (const n of notes) {
    const next = offs.find((t) => t > n.t + 0.05) ?? seconds;
    n.len = Math.max(0.12, Math.min(n.len, next - 0.01 - n.t));
  }
  pedal.push(...within);
  pedal.sort((a, b) => a.t - b.t);
  return { notes, pedal, seconds, beat: BEAT, barSeconds: BAR, start: START };
}

/** When each note stops sounding: when its key comes up, or, the pedal being down then, when the pedal next lifts. */
function soundingEnds({ notes, pedal, seconds }) {
  return notes.map((n) => {
    const up = n.t + n.len;
    let down = false;
    for (const p of pedal) {
      if (p.t > up) break;
      down = p.on;
    }
    return down ? (pedal.find((p) => !p.on && p.t > up)?.t ?? seconds) : up;
  });
}

/** Prints the piece bar by bar and what was checked; throws if it breaks a rule every piece keeps. */
export function describe(piece, score) {
  const { notes, seconds, start, barSeconds } = score;
  const bars = piece.bars;
  console.log(`${piece.name}: ${bars.length} bars at ${piece.bpm} BPM, ${seconds.toFixed(1)} s with the last chord ringing; ${notes.length} notes`);
  const hand = (list) => (list ?? []).map(([at, n]) => `${n}@${at + 1}`).join(' ');
  const wide = (min, of) => Math.max(min, ...bars.map(of));
  const chordWide = wide(5, (bar) => bar.chord.length);
  const lhWide = wide(44, (bar) => hand(bar.lh).length);
  bars.forEach((bar, b) => {
    console.log(`  ${String(b + 1).padStart(2)}  ${(start + b * barSeconds).toFixed(1).padStart(6)} s  ${bar.chord.padEnd(chordWide)} LH ${hand(bar.lh).padEnd(lhWide)} RH ${hand(bar.rh)}`);
  });

  const problems = [];
  const where = (n) => `${n.note} in bar ${n.bar}`;
  const tune = notes.filter((n) => n.hand === 'R');
  const outside = tune.filter((n) => !GAME.includes(n.m % 12));
  if (outside.length > 0) throw new Error(`the tune leaves C D E G A: ${outside.map(where).join(', ')}`);
  let busiest = 0;
  for (let s = 0; s < seconds; s += 0.25) busiest = Math.max(busiest, notes.filter((n) => n.t >= s && n.t < s + 1).length);
  console.log(`  the tune keeps to C D E G A; the busiest second has ${busiest} notes; velocities ${Math.min(...notes.map((n) => n.v))}–${Math.max(...notes.map((n) => n.v))}`);

  // Soft throughout.
  const loud = notes.filter((n) => n.v < 30 || n.v > 64);
  if (loud.length > 0) problems.push(`velocities outside 30–64: ${loud.map((n) => `${where(n)} at ${n.v}`).join(', ')}`);

  // White notes only.
  const black = notes.filter((n) => !WHITE.includes(n.m % 12));
  if (black.length > 0) problems.push(`notes outside C major: ${black.map(where).join(', ')}`);

  // Nothing sounding together rubs.
  const ends = soundingEnds(score);
  const rubs = new Set();
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length && notes[j].t < ends[i] - 0.03; j++) {
      const [lo, hi] = notes[i].m <= notes[j].m ? [notes[i], notes[j]] : [notes[j], notes[i]];
      const d = (hi.m - lo.m) % 12;
      if (hi.m !== lo.m && d === 1) rubs.add(`${lo.note} under ${hi.note} in bar ${notes[j].bar} (a minor second or ninth)`);
      if (d === 6) rubs.add(`${lo.note} with ${hi.note} in bar ${notes[j].bar} (a tritone)`);
    }
  }
  if (rubs.size > 0) problems.push(`sounding together: ${[...rubs].join('; ')}`);

  // Against the game's five notes.
  const highF = notes.filter((n) => n.m % 12 === 5 && n.m > F3);
  if (highF.length > 0) problems.push(`F above F3 (a minor second or ninth with the game's E): ${highF.map(where).join(', ')}`);
  const bs = notes.filter((n) => n.m % 12 === 11);
  const topOf = (bar) => Math.max(...notes.filter((n) => n.bar === bar).map((n) => n.m));
  const loudB = bs.filter((n) => n.hand !== 'L' || n.m > B3 || n.v > B_SOFT + 2 || n.m === topOf(n.bar));
  if (loudB.length > 0) problems.push(`B in the open (it rubs with the game's C; a soft bass or inner note at or below B3 only): ${loudB.map(where).join(', ')}`);
  const fBars = new Set(notes.filter((n) => n.m % 12 === 5).map((n) => n.bar));
  const bBars = [...new Set(bs.map((n) => n.bar))];
  const both = bBars.filter((b) => fBars.has(b));
  if (both.length > 0) problems.push(`F and B in the same bar: ${both.join(', ')}`);
  let bSeconds = 0;
  notes.forEach((n, i) => {
    if (n.m % 12 === 11) bSeconds += ends[i] - n.t;
  });

  // How much is going on, and how the tune moves (its top line, where it plays more than one note at once).
  const line = [];
  for (const n of tune) {
    const last = line[line.length - 1];
    if (last && Math.abs(n.t - last.t) < 0.2) {
      if (n.m > last.m) line[line.length - 1] = n;
    } else line.push(n);
  }
  const moves = line.slice(1).map((n, i) => Math.abs(n.m - line[i].m));
  const count = (lo, hi) => moves.filter((d) => d >= lo && d <= hi).length;
  const pct = (k) => `${Math.round((100 * k) / Math.max(1, moves.length))}%`;
  if (busiest > 6) problems.push(`the busiest second has ${busiest} notes`);

  console.log(`  checks: all white notes; nothing sounding together (the pedal counted) makes a minor second, a minor ninth or a tritone; F never above F3; ${bs.length === 0 ? 'no B anywhere' : `B only as a soft bass or inner note (bars ${bBars.join(', ')}; ${bSeconds.toFixed(0)} s of ${seconds.toFixed(0)})`}`);
  console.log(`  ${(notes.length / (seconds - start)).toFixed(2)} notes a second on average; the tune has ${line.length} notes, ${line.reduce((a, n) => (n.m < a.m ? n : a), line[0]).note} to ${line.reduce((a, n) => (n.m > a.m ? n : a), line[0]).note}: ${pct(count(0, 0))} repeated, ${pct(count(1, 4))} by step or third, ${pct(count(5, 7))} by fourth or fifth, ${pct(count(8, 99))} wider (widest ${Math.max(0, ...moves)} semitones)`);
  if (problems.length > 0) throw new Error(`${piece.name}: ${problems.join('\n  ')}`);
}
