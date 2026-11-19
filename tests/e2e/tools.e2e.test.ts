// The three CLIs, run as real processes the way agents run them.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';

const run = promisify(execFile);
const ROOT = path.resolve(__dirname, '../..');
const node = (args: string[]) => run(process.execPath, args, { cwd: ROOT, maxBuffer: 16 << 20 });

function pngSize(file: string): { width: number; height: number } {
  const buf = fs.readFileSync(file);
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('tools', () => {
  test('shots CLI writes a PNG', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-shots-'));
    try {
      const { stdout } = await node(['tools/shots.mjs', 'hello-town', '--out', out, '--size', '640x400']);
      expect(stdout).toContain('hello-town-front.png');
      expect(stdout).toContain('hello-town-back.png');
      for (const camera of ['front', 'back']) {
        const file = path.join(out, `hello-town-${camera}.png`);
        expect(pngSize(file)).toEqual({ width: 640, height: 400 });
        // A drawn scene compresses far worse than a blank canvas (about 1.5 kB at this size).
        expect(fs.statSync(file).size).toBeGreaterThan(4000);
      }
      const dusk = await node(['tools/shots.mjs', 'hello-town', '--out', out, '--size', '640x400', '--time', 'night']);
      expect(dusk.stdout).toContain('hello-town-front-night.png');
      expect(fs.readFileSync(path.join(out, 'hello-town-front-night.png')).equals(fs.readFileSync(path.join(out, 'hello-town-front.png')))).toBe(false);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  test('shots CLI fails clearly when nothing matches', async () => {
    await expect(node(['tools/shots.mjs', 'no-such-scenario'])).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("No scenario matches 'no-such-scenario'") });
  });

  test('inspect CLI prints what town logic decided, through the same discovery', async () => {
    const overview = (await node(['tools/inspect.mjs'])).stdout;
    expect(overview).toContain('hello-town');
    expect(overview).toContain('townFacts');
    expect(overview).toMatch(/Layers: .*terrain/);
    const { stdout } = await node(['tools/inspect.mjs', 'hello-town']);
    for (const heading of ['Kinds (placed → resolved)', 'Structures (', 'Supports (', 'Features (', 'Sockets (', 'Props (', 'Actors (', 'Walking graph', 'Rules (']) {
      expect(stdout).toContain(heading);
    }
    expect(stdout).toContain('expect(): passed');
    const json = JSON.parse((await node(['tools/inspect.mjs', 'hello-town', '--json'])).stdout);
    expect(json.kinds).toHaveLength(11);
    await expect(node(['tools/inspect.mjs', 'nope'])).rejects.toMatchObject({ code: 1 });
  });

  test('bench CLI reports both logic stages and frame statistics', async () => {
    const { stdout } = await node(['tools/bench.mjs', '--frames', '20']);
    expect(stdout).toMatch(/bench-2000 \(\d{4} blocks/);
    expect(stdout).toMatch(/resolveShape\(\) after one edit\s+[\d.]+ ms/);
    expect(stdout).toMatch(/resolveDressing\(\) after one edit\s+[\d.]+ ms/);
    expect(stdout).toMatch(/frame rate over 20 frames\s+[\d.]+ fps/);
    expect(stdout).toMatch(/draw calls per frame\s+\d+/);
    expect(stdout).toMatch(/geometry rebuild after one edit\s+[\d.]+ ms/);
  });
});
