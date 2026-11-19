#!/usr/bin/env node
/* global process, console, window */
// Motion cannot be judged from one screenshot. This renders a SEQUENCE: the
// real app, with its clock taken over so every frame is exactly 1/60 s, an
// optional edit, and N frames laid out as one contact sheet you can read
// left to right, top to bottom.
//
//   node src/life/testing/sequence.mjs <scenario> [options]
//
//   --time day|dusk|night|dawn|<phase 0..1>   hold that time of day (default day)
//   --run                    let the dusk cycle run from that time instead of holding it
//   --warm 2000              milliseconds of life to play before the sequence starts
//   --edit 'place:house@10,1,10; erase@12,1,10; floor:path@9,1,9; kind:tower@10,1,10; edge:fence@10,1,10,E'
//                            edits applied at the first frame (x,y,z are grid cells; y is the level)
//   --then '<edits>' --after 400   a second batch of edits, that many ms into the sequence
//   --frames 8 --every 100   how many frames to keep, and the milliseconds between them
//   --zoom 3 --target 10,1,10 --yaw 45 --pitch 35   move the camera (the app opens on the scenario's first camera)
//   --size 640x400 --scale 1 --cols 4
//   --name bounce            output: .context/shots/seq/<scenario>-<name>.png (and each frame beside it with --keep)
//
// Examples
//   node src/life/testing/sequence.mjs fx-landing --edit 'place:house@24,1,24' --frames 12 --every 33 --name land
//   node src/life/testing/sequence.mjs L07.window-light --time 0.6 --run --frames 12 --every 3000 --name dusk
//
// It drives window.__lc (the app's debug handle) and nothing else.

import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../tools/lib/browser.mjs';
import { parseArgs, ROOT, startServer } from '../../../tools/lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const scenario = positional[0];
if (!scenario) {
  console.error('usage: node src/life/testing/sequence.mjs <scenario> [--edit ...] [--frames 8] [--every 100] (see the file header)');
  process.exit(1);
}
const [width, height] = String(flags.size ?? '640x400').split('x').map(Number);
const scale = Number(flags.scale ?? 1);
const frames = Number(flags.frames ?? 8);
const every = Number(flags.every ?? 100);
const warm = Number(flags.warm ?? 2000);
const cols = Number(flags.cols ?? 4);
const name = String(flags.name ?? 'seq');
const outDir = path.resolve(ROOT, String(flags.out ?? '.context/shots/seq'));
const FRAME = 1000 / 60;

/** 'place:house@10,1,10; erase@3,1,4' → edit descriptions the page turns into Edits. */
function parseEdits(text) {
  if (!text || text === true) return [];
  return String(text)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [head, where] = s.split('@');
      const [verb, what] = head.split(':');
      const parts = where.split(',').map((p) => p.trim());
      return { verb, what, x: Number(parts[0]), y: Number(parts[1]), z: Number(parts[2]), side: parts[3] };
    });
}

const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.stack ?? e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.clock.install({ time: 0 });
  await page.goto(`${server.url}/?scenario=${encodeURIComponent(scenario)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lc !== undefined, null, { timeout: 60_000 });
  // The interface is not what is being looked at.
  await page.addStyleTag({ content: 'body > *:not(#town) { display: none !important; }' });
  // The page's clock has been running since it loaded (a slow start can take seconds): stop it just ahead of now.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);

  /** Plays `ms` of the app's frame loop, one 60 fps frame at a time. */
  const play = async (ms) => {
    const n = Math.max(0, Math.round(ms / FRAME));
    for (let i = 0; i < n; i++) await page.clock.runFor(FRAME);
  };

  await play(200);
  await page.evaluate(
    ([time, run, cam]) => {
      const lc = window.__lc;
      const s = lc.signals;
      if (typeof time === 'number') {
        s.hold('day');
        s.setPhase(time);
        // hold('day') parks the cycle; setPhase moves it. With --run it is released below.
      } else s.hold(time);
      if (run) {
        const phase = s.time.phase;
        s.hold('run');
        s.setPhase(phase);
      }
      const pose = {};
      if (cam.zoom !== undefined) pose.zoom = cam.zoom;
      if (cam.yaw !== undefined) pose.yaw = cam.yaw;
      if (cam.pitch !== undefined) pose.pitch = cam.pitch;
      if (cam.target) pose.target = cam.target;
      if (Object.keys(pose).length) lc.view.setCamera(pose);
    },
    [
      flags.time === undefined ? 'day' : Number.isNaN(Number(flags.time)) ? flags.time : Number(flags.time),
      Boolean(flags.run),
      {
        zoom: flags.zoom === undefined ? undefined : Number(flags.zoom),
        yaw: flags.yaw === undefined ? undefined : Number(flags.yaw),
        pitch: flags.pitch === undefined ? undefined : Number(flags.pitch),
        target: flags.target === undefined ? undefined : String(flags.target).split(',').map(Number),
      },
    ],
  );
  await play(warm);

  const applyEdits = (list) =>
    page.evaluate((edits) => {
      const lc = window.__lc;
      const key = (x, y, z) => x | (z << 6) | (y << 12);
      const done = [];
      for (const e of edits) {
        const cell = key(e.x, e.y, e.z);
        let edit;
        if (e.verb === 'place') edit = { type: 'placeBlock', cell, kind: e.what, color: 'auto', from: null };
        else if (e.verb === 'erase') edit = { type: 'eraseBlock', cell };
        else if (e.verb === 'floor') edit = { type: 'placeFloor', cell, floor: e.what };
        else if (e.verb === 'nofloor') edit = { type: 'eraseFloor', cell };
        else if (e.verb === 'kind') edit = { type: 'setKind', cell, kind: e.what };
        else if (e.verb === 'paint') edit = { type: 'paint', cell, color: Number(e.what) };
        else if (e.verb === 'edge') edit = { type: 'placeEdge', edge: cell * 2 + (e.side === 'S' ? 1 : 0), kind: e.what };
        else if (e.verb === 'noedge') edit = { type: 'eraseEdge', edge: cell * 2 + (e.side === 'S' ? 1 : 0) };
        else throw new Error(`unknown edit '${e.verb}'`);
        const verdict = lc.game.edit(edit);
        done.push(verdict.ok ? 'ok' : `refused: ${verdict.reason}`);
      }
      return done;
    }, list);

  const first = parseEdits(flags.edit);
  const second = parseEdits(flags.then);
  const after = Number(flags.after ?? 0);
  if (first.length) console.log(`edits: ${(await applyEdits(first)).join(', ')}`);

  const shots = [];
  let secondDone = second.length === 0;
  for (let i = 0; i < frames; i++) {
    // The first frame is the very next one after the edit: what the player sees first.
    await play(i === 0 ? FRAME : every);
    const at = i === 0 ? FRAME : FRAME + i * every;
    if (!secondDone && at >= after) {
      secondDone = true;
      console.log(`then: ${(await applyEdits(second)).join(', ')}`);
      await play(FRAME);
    }
    const png = await page.locator('#town').screenshot();
    shots.push({ png, label: `${Math.round(at)} ms` });
    if (flags.keep) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, `${scenario}-${name}-${String(i).padStart(2, '0')}.png`), png);
    }
  }

  // The contact sheet: every frame in one picture.
  const sheet = await ctx.newPage();
  const rows = Math.ceil(shots.length / cols);
  await sheet.setViewportSize({ width: cols * width + (cols + 1) * 6, height: rows * (height + 22) + 6 });
  await sheet.setContent(
    `<body style="margin:0;background:#2b2622;font:12px/16px system-ui;color:#f2ede3"><div style="display:grid;grid-template-columns:repeat(${cols},${width}px);gap:6px;padding:6px">${shots
      .map((s) => `<div><img width="${width}" height="${height}" style="display:block" src="data:image/png;base64,${s.png.toString('base64')}"><div style="height:16px">${s.label}</div></div>`)
      .join('')}</div></body>`,
  );
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${scenario}-${name}.png`);
  await sheet.screenshot({ path: file });
  console.log(`${path.relative(ROOT, file)}  (${shots.length} frames, ${every} ms apart)`);
  if (errors.length > 0) {
    console.error(`\nThe page reported ${errors.length} error(s):\n${errors.slice(0, 10).join('\n')}`);
    failed = true;
  }
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
