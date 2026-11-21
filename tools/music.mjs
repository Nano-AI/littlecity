#!/usr/bin/env node
// The game's background music: slow pieces for solo piano, two to three minutes each, that the game
// plays quietly one after another with a pause between (src/app/music.ts).
//
//   npm run music            writes public/music/little-city-piano.mp3, -2.mp3 and -3.mp3 (and a WAV
//                            and a MIDI file of each under .context/music/); needs fluidsynth, ffmpeg
//                            and the piano SoundFont
//   npm run music -- 2       just the second piece
//   npm run music -- --dry   prints the pieces bar by bar, checks them, and renders nothing
//   --sf2 <file> or $PIANO_SF2 says where the SoundFont is (see tools/music/piano.mjs)
//
// Each piece is written down in its own file under tools/music/pieces; tools/music/score.mjs turns
// one into timed notes and pedal and checks what every piece keeps to (white notes only, a tune of
// C D E G A, nothing that rubs against the notes the game plays); tools/music/piano.mjs is the piano.
// The first piece is the measure of how loud: the others are brought to its loudness.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, renderPiano, writeWav } from './music/piano.mjs';
import first from './music/pieces/little-city-piano.mjs';
import second from './music/pieces/little-city-piano-2.mjs';
import third from './music/pieces/little-city-piano-3.mjs';
import { describe, perform } from './music/score.mjs';

const PIECES = [first, second, third];

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const flag = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const SF2 = flag('sf2') ?? process.env.PIANO_SF2 ?? path.join(ROOT, '.context/capture/piano/UprightPianoKW-SF2-20220221/UprightPianoKW-20220221.sf2');
const DRY = args.includes('--dry');
const asked = args.filter((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--sf2').map(Number);
const wrong = asked.filter((n) => n < 1 || n > PIECES.length);
if (wrong.length > 0) throw new Error(`no piece ${wrong.join(', ')}: there are ${PIECES.length}`);
const chosen = asked.length > 0 ? PIECES.filter((_, i) => asked.includes(i + 1)) : PIECES;

const dbOf = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
/** How loud a sound file is: integrated loudness (LUFS, EBU R 128) and true peak (dBFS), by ffmpeg. */
function loudness(file) {
  const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  const number = (re) => Number(re.exec(summary)?.[1] ?? NaN);
  const out = { lufs: number(/I:\s+(-?[\d.]+) LUFS/), peak: number(/Peak:\s+(-?[\d.]+) dBFS/) };
  if (Number.isNaN(out.lufs)) throw new Error(`ffmpeg could not measure ${file}`);
  return out;
}

const work = path.join(ROOT, '.context/music');
const mp3Of = (piece) => path.join(ROOT, 'public/music', `${piece.name}.mp3`);

for (const piece of chosen) {
  const score = perform(piece);
  // ── what it is ──────────────────────────────────────────────────────────────────────────────────
  describe(piece, score);
  if (DRY) continue;

  // ── the sound ───────────────────────────────────────────────────────────────────────────────────
  fs.mkdirSync(work, { recursive: true });
  const [l, r] = renderPiano({ notes: score.notes, pedal: score.pedal, seconds: score.seconds, sf2: SF2, midFile: path.join(work, `${piece.name}.mid`), peakDb: -3, fade: 3 });
  const wav = path.join(work, `${piece.name}.wav`);
  writeWav(wav, [l, r]);
  let peak = -3;
  if (piece !== first) {
    // As loud as the first piece (its file in public/music is the measure), with a decibel left above the peaks:
    // a piece of struck chords and long silences peaks higher than a flowing one for the same loudness.
    const gain = Math.min(loudness(mp3Of(first)).lufs - loudness(wav).lufs, -1 - peak);
    for (let k = 0; k < l.length; k++) {
      l[k] *= 10 ** (gain / 20);
      r[k] *= 10 ** (gain / 20);
    }
    peak += gain;
    writeWav(wav, [l, r]);
  }
  const out = mp3Of(piece);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-q:a', '5', '-ar', String(SR), out]);
  let s = 0;
  for (let k = 0; k < l.length; k++) s += l[k] * l[k] + r[k] * r[k];
  console.log(`  → ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB), ${path.relative(ROOT, wav)}; peak ${peak.toFixed(1).replace(/\.0$/, '')} dBFS, RMS ${(10 * Math.log10(s / (2 * l.length))).toFixed(1)} dBFS`);
  const edge = (from, to) => {
    let top = 0;
    for (let k = Math.max(0, Math.round(from * SR)); k < Math.min(l.length, Math.round(to * SR)); k++) top = Math.max(top, Math.abs(l[k]), Math.abs(r[k]));
    return dbOf(top);
  };
  const heard = loudness(out);
  const quiet = (d) => (d < -90 ? 'silent' : `${d.toFixed(0)} dBFS`);
  console.log(`  the mp3: ${heard.lufs.toFixed(1)} LUFS, true peak ${heard.peak.toFixed(1)} dBFS; its first 0.3 s ${quiet(edge(0, 0.3))}, its last 0.5 s ${quiet(edge(score.seconds - 0.5, score.seconds))}`);
}
