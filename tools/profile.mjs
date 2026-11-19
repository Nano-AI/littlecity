#!/usr/bin/env node
// node tools/profile.mjs [scenario] [--runs 20] [--shape-only]
//
// With --shape-only it just resolves shapes (run it under node --cpu-prof).
//
// Where the logic time goes after one edit: passes, facts and rules (medians).

import { loadModule, parseArgs } from './lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const { mod, close } = await loadModule('/tools/profile.main.ts');
try {
  mod.main(positional[0], Number(flags.runs ?? 20), console.log, Boolean(flags['shape-only']));
} finally {
  await close();
}
