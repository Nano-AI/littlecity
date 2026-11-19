#!/usr/bin/env node
/* global console, process */
// Faces drawn in one plane on top of each other with different ink ids (Look). Such pairs used to
// flicker as the camera moved; the view now settles most of them (docs/swarm/steady-ink.md) but the
// fix that always works is in the geometry: lift the detail a hair (0.004) or leave the hidden face out.
//
//   node src/render/testing/coplanar.mjs [scenario ...]        default: everything

import { loadModule } from '../../../tools/lib/vite.mjs';

const names = process.argv.slice(2);
const { mod, close } = await loadModule('/src/render/testing/coplanar.main.ts');
try {
  for (const name of names.length ? names : ['everything']) mod.main(name, (line) => console.log(line));
} finally {
  await close();
}
