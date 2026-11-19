#!/usr/bin/env node
/* global console, process */
// Faces drawn in one plane on top of each other with different ink ids (Look). Such pairs used to
// flicker as the camera moved; the view now settles most of them (docs/swarm/steady-ink.md) but the
// fix that always works is in the geometry: lift the detail a hair (0.004) or leave the hidden face out.
// `src/render/testing/coplanar.test.ts` holds the dense towns to their allow-list.
//
//   node src/render/testing/coplanar.mjs [scenario ...] [--min 0.0005] [--pairs]   default: everything
//
// --pairs (last, or --pairs=1) lists every pair: who drew each side (kind#structure id), the ink group
// names, the two triangles. --min leaves out pairs whose smaller triangle is under that area.

import { loadModule, parseArgs } from '../../../tools/lib/vite.mjs';

const { positional, flags } = parseArgs(process.argv.slice(2));
const { mod, close } = await loadModule('/src/render/testing/coplanar.main.ts');
try {
  for (const name of positional.length ? positional : ['everything']) {
    mod.main(name, (line) => console.log(line), { pairs: Boolean(flags.pairs), min: Number(flags.min ?? 0) });
  }
} finally {
  await close();
}
