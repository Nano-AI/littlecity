// Shared by the CLIs (Stage 0, frozen). Two ways to use the project's Vite
// config from Node, both safe to run from several worktrees at once:
//
//   loadModule(entry)  runs a TypeScript module through Vite without opening
//                      any port, so import.meta.glob discovery and the '@/'
//                      alias work exactly as in the app and in Vitest.
//   startServer()      serves the app on a free port chosen by the OS.

import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

/** The checkout this file lives in. Output paths are relative to it, not to the cwd. */
export const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const configFile = path.join(ROOT, 'vite.config.ts');
// A cache of its own, so a tool never fights a running `npm run dev` over node_modules/.vite.
const cacheDir = path.join(ROOT, 'node_modules', '.vite-tools');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Imports a module (path from the repo root, e.g. '/tools/inspect.main.ts') through Vite. */
export async function loadModule(entry) {
  const server = await createServer({
    root: ROOT,
    configFile,
    cacheDir,
    appType: 'custom',
    logLevel: 'error',
    clearScreen: false,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const mod = await server.ssrLoadModule(entry);
    return { mod, close: () => server.close() };
  } catch (err) {
    await server.close();
    throw err;
  }
}

/** Starts the dev server on a free port. Returns its base URL and a close function. */
export async function startServer() {
  for (let attempt = 0; ; attempt++) {
    const port = await freePort();
    const server = await createServer({
      root: ROOT,
      configFile,
      cacheDir,
      logLevel: 'error',
      clearScreen: false,
      server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
    });
    try {
      await server.listen();
      const address = server.httpServer.address();
      return { url: `http://127.0.0.1:${address.port}`, close: () => server.close() };
    } catch (err) {
      await server.close();
      // Another process took the port between the probe and the listen: pick again.
      if (attempt >= 5) throw err;
    }
  }
}

/** Parses `--flag value` and `--flag=value` pairs; everything else is positional. */
export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}
