// A real piano for the game's music (tools/music.mjs): notes in, sound out.
//
// The piano is FreePats' "Upright Piano KW" (a Kawai upright recorded in a living room, CC0,
// http://freepats.zenvoid.org/Piano/acoustic-grand-piano.html): a SoundFont played by fluidsynth
// (brew install fluid-synth) from a MIDI file written here. The SoundFont lives outside the
// repository; $PIANO_SF2 or --sf2 says where. After the piano: a little warmth, softer hammers and
// a room, all done here.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SR = 44100;
const TAU = Math.PI * 2;
const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C4' → 60. */
export const midi = (s) => 12 * (Number(s.slice(-1)) + 1) + STEP[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0);

/** A standard MIDI file of timed events ({ t seconds, order, bytes }). */
function smf(events) {
  const TICKS = 1920; // a second: 960 to the beat at 120 BPM
  const vlq = (n) => {
    const b = [n & 0x7f];
    while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80);
    return b;
  };
  const ev = events.map((e) => ({ ...e, tick: Math.round(e.t * TICKS) })).sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, 0, 0xc0, 0];
  let last = 0;
  for (const e of ev) {
    body.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  body.push(0, 0xff, 0x2f, 0);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 960 >> 8, 960 & 255, 0x4d, 0x54, 0x72, 0x6b, (body.length >>> 24) & 255, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255];
  return globalThis.Buffer.from([...head, ...body]);
}

/** Reads fluidsynth's float WAV: [left, right]. */
function readFloatWav(file) {
  const b = fs.readFileSync(file);
  let off = 12;
  let channels = 2;
  let data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') channels = b.readUInt16LE(off + 10);
    if (id === 'data') data = b.subarray(off + 8, Math.min(b.length, off + 8 + size));
    off += 8 + size + (size & 1);
  }
  if (!data || channels !== 2) throw new Error(`${file}: expected a stereo float WAV`);
  const n = Math.floor(data.length / 8);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    l[i] = data.readFloatLE(i * 8);
    r[i] = data.readFloatLE(i * 8 + 4);
  }
  return [l, r];
}

/** Writes 16-bit stereo PCM, dithered. */
export function writeWav(file, [l, r]) {
  const n = l.length;
  const b = globalThis.Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n * 4, 4);
  b.write('WAVEfmt ', 8, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n * 4, 40);
  let seed = 0x2545f491;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const q = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767 + (rnd() - rnd()))));
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(q(l[i]), 44 + i * 4);
    b.writeInt16LE(q(r[i]), 46 + i * 4);
  }
  fs.writeFileSync(file, b);
}

/** A biquad (RBJ), in place. */
function biquad(x, type, f0, q = 0.707, gainDb = 0) {
  const w = (TAU * f0) / SR;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const al = sw / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') [b0, b1, b2, a0, a1, a2] = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + al, -2 * cw, 1 - al];
  else if (type === 'hp') [b0, b1, b2, a0, a1, a2] = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + al, -2 * cw, 1 - al];
  else if (type === 'peak') [b0, b1, b2, a0, a1, a2] = [1 + al * A, -2 * cw, 1 - al * A, 1 + al / A, -2 * cw, 1 - al / A];
  else if (type === 'highshelf') {
    const s = 2 * Math.sqrt(A) * al;
    [b0, b1, b2, a0, a1, a2] = [A * (A + 1 + (A - 1) * cw + s), -2 * A * (A - 1 + (A + 1) * cw), A * (A + 1 + (A - 1) * cw - s), A + 1 - (A - 1) * cw + s, 2 * (A - 1 - (A + 1) * cw), A + 1 - (A - 1) * cw - s];
  } else throw new Error(type);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let k = 0; k < x.length; k++) {
    const y = (b0 * x[k] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x[k];
    y2 = y1;
    y1 = y;
    x[k] = y;
  }
  return x;
}

/**
 * The room: a pre-delay, four all-passes to smear the attack, then eight delay lines fed back through
 * a Householder matrix, each losing its top faster than its bottom. Returns [left, right], decorrelated.
 */
function room(input, { rt60 = 1.7, damp = 0.32, pre = 0.02 } = {}) {
  const n = input.length;
  const x = new Float32Array(n);
  const p = Math.round(pre * SR);
  for (let k = p; k < n; k++) x[k] = input[k - p];
  biquad(x, 'hp', 180);
  biquad(x, 'lp', 6000);
  for (const [d, g] of [[142, 0.7], [107, 0.7], [379, 0.6], [277, 0.6]]) {
    const buf = new Float32Array(d);
    let i = 0;
    for (let k = 0; k < n; k++) {
      const out = buf[i] - g * x[k];
      buf[i] = x[k] + g * out;
      x[k] = out;
      if (++i >= d) i = 0;
    }
  }
  const D = [1319, 1637, 1933, 2311, 2707, 3089, 3491, 3917];
  const N = D.length;
  const bufs = D.map((d) => new Float32Array(d));
  const idx = new Int32Array(N);
  const g = D.map((d) => 10 ** ((-3 * d) / (rt60 * SR)));
  const lp = new Float64Array(N);
  const v = new Float64Array(N);
  const sl = [1, -1, 1, -1, 1, -1, 1, -1];
  const sr = [1, 1, -1, -1, 1, 1, -1, -1];
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let sum = 0, a = 0, b = 0;
    for (let i = 0; i < N; i++) {
      v[i] = bufs[i][idx[i]];
      sum += v[i];
      a += sl[i] * v[i];
      b += sr[i] * v[i];
    }
    for (let i = 0; i < N; i++) {
      lp[i] = (v[i] - (2 / N) * sum) * (1 - damp) + lp[i] * damp;
      bufs[i][idx[i]] = (i % 2 ? -x[k] : x[k]) + lp[i] * g[i];
      if (++idx[i] >= D[i]) idx[i] = 0;
    }
    l[k] = a;
    r[k] = b;
  }
  return [l, r];
}

const rmsOf = (c) => {
  let s = 0;
  for (let k = 0; k < c.length; k++) s += c[k] * c[k];
  return Math.sqrt(s / Math.max(1, c.length));
};

/**
 * Plays notes ({ t, len, m, v }: seconds, seconds the key is held, MIDI note, velocity) with the
 * sustain pedal ({ t, on }) and returns `seconds` of sound as [left, right], peak at `peakDb` dBFS,
 * the last `fade` seconds faded to nothing. Also writes the MIDI file if `midFile` is given.
 */
export function renderPiano({ notes, pedal, seconds, sf2, midFile, peakDb = -3, fade = 2, wetDb = -13 }) {
  if (!fs.existsSync(sf2)) throw new Error(`no piano at ${sf2}: get FreePats' "Upright Piano KW" (SF2, CC0) from http://freepats.zenvoid.org/Piano/acoustic-grand-piano.html and point --sf2 or $PIANO_SF2 at it`);
  const TAIL = 4;
  const events = [];
  for (const n of notes) {
    events.push({ t: n.t, order: 2, bytes: [0x90, n.m, n.v] });
    events.push({ t: n.t + n.len, order: 0, bytes: [0x80, n.m, 0] });
  }
  for (const p of pedal) events.push({ t: p.t, order: 1, bytes: [0xb0, 64, p.on ? 127 : 0] });
  events.push({ t: seconds + TAIL, order: 3, bytes: [0xb0, 123, 0] }); // keeps fluidsynth running to here
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'piano-'));
  const mid = midFile ?? path.join(tmp, 'piece.mid');
  fs.writeFileSync(mid, smf(events));
  const rawFile = path.join(tmp, 'piano.wav');
  try {
    execFileSync('fluidsynth', ['-ni', '-q', '-F', rawFile, '-T', 'wav', '-O', 'float', '-r', String(SR), '-g', '1', '-o', 'synth.reverb.active=0', '-o', 'synth.chorus.active=0', sf2, mid], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    throw new Error(`fluidsynth failed (is it installed? brew install fluid-synth): ${e.stderr?.toString() || e.message}`, { cause: e });
  }
  const raw = readFloatWav(rawFile);
  fs.rmSync(tmp, { recursive: true });

  const NS = Math.ceil(seconds * SR);
  const LEN = NS + TAIL * SR;
  const take = (c) => {
    const o = new Float32Array(LEN);
    o.set(c.subarray(0, LEN));
    return o;
  };
  const L = take(raw[0]);
  const R = take(raw[1]);

  // The recording is two microphones at the player's head, and single notes lean left or right by up
  // to 9 dB: most of the way to mono, so the tune stays put (the room gives the width back).
  const WIDTH = 0.35;
  for (let k = 0; k < LEN; k++) {
    const m = (L[k] + R[k]) / 2;
    const s = ((L[k] - R[k]) / 2) * WIDTH;
    L[k] = m + s;
    R[k] = m - s;
  }
  // Soft and warm: the top rolled off, a little body, the rumble out.
  for (const c of [L, R]) {
    biquad(c, 'hp', 32);
    biquad(c, 'peak', 240, 0.7, 1.5);
    biquad(c, 'highshelf', 3200, 0.707, -1.5);
    biquad(c, 'lp', 8000, 0.707);
  }
  // The hammers a little softer: a gentle 2:1 on the loudest 9 dB (it sees a note 5 ms before it
  // lands, and lets go slowly) takes the edge off each note's first instant and leaves the ring.
  {
    let top = 0;
    for (let k = 0; k < LEN; k++) top = Math.max(top, Math.abs(L[k]), Math.abs(R[k]));
    const [under, ratio, knee] = [9, 2, 6];
    const thr = db(top) - under;
    const ahead = Math.round(0.005 * SR);
    const hold = Math.exp(-1 / (0.03 * SR));
    const ca = Math.exp(-1 / (0.0015 * SR));
    const cr = Math.exp(-1 / (0.25 * SR));
    const env = new Float32Array(LEN + ahead);
    let e = 0;
    for (let k = 0; k < LEN; k++) env[k] = e = Math.max(Math.abs(L[k]), Math.abs(R[k]), e * hold);
    let g = 0;
    for (let k = 0; k < LEN; k++) {
      const over = db(env[k + ahead] + 1e-9) - thr;
      const want = over <= -knee / 2 ? 0 : over >= knee / 2 ? over * (1 - 1 / ratio) : ((1 - 1 / ratio) * (over + knee / 2) ** 2) / (2 * knee);
      g = want > g ? ca * g + (1 - ca) * want : cr * g + (1 - cr) * want;
      const a = 10 ** (-g / 20);
      L[k] *= a;
      R[k] *= a;
    }
  }
  // The room, a modest amount of it.
  const send = new Float32Array(LEN);
  for (let k = 0; k < LEN; k++) send[k] = (L[k] + R[k]) / 2;
  const [wl, wr] = room(send);
  const wet = (10 ** (wetDb / 20) * Math.hypot(rmsOf(L), rmsOf(R))) / Math.hypot(rmsOf(wl), rmsOf(wr));
  for (let k = 0; k < LEN; k++) {
    L[k] += wl[k] * wet;
    R[k] += wr[k] * wet;
  }

  const outL = L.slice(0, NS);
  const outR = R.slice(0, NS);
  const F = Math.round(fade * SR);
  for (let k = 0; k < F; k++) {
    const g = Math.cos((Math.PI / 2) * ((k + 1) / F)) ** 2;
    outL[NS - F + k] *= g;
    outR[NS - F + k] *= g;
  }
  let peak = 0;
  for (let k = 0; k < NS; k++) peak = Math.max(peak, Math.abs(outL[k]), Math.abs(outR[k]));
  const norm = 10 ** (peakDb / 20) / peak;
  for (let k = 0; k < NS; k++) {
    outL[k] *= norm;
    outR[k] *= norm;
  }
  return [outL, outR];
}
