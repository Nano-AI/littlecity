#!/usr/bin/env node
// npm run inspect -- <scenario> [--cells] [--json] [--rules]
//
// Prints what town logic decided for a scenario: kinds, structures and their
// roles, features, sockets, props, actors, the walking graph, and which rule
// produced each. With no scenario it lists the scenarios and everything
// discovery found (rules, facts, generators, parts, behaviours).

import { loadModule, parseArgs } from './lib/vite.mjs';

const { flags, positional } = parseArgs(process.argv.slice(2));
const { mod, close } = await loadModule('/tools/inspect.main.ts');
let code;
try {
  code = mod.main(positional[0], flags, (line) => console.log(line));
} catch (err) {
  console.error(err);
  code = 1;
} finally {
  await close();
}
// Exit only once stdout has drained: on macOS a piped stdout is asynchronous, and process.exit()
// cut any output longer than the 64 KB pipe buffer (a dressed town's --json is longer than that).
process.stdout.write('', () => process.exit(code));
