// Global setup of the e2e project (vitest.config.ts): ONE dev server for every browser test file.
// Each file used to start its own, and each server transformed every module of the app again on its
// first page load, all at once, on a machine shared with other work. startApp() (./browser.ts) uses
// this one when it is there; run a file outside Vitest's e2e project and it starts its own.

import type { TestProject } from 'vitest/node';
import { startServer } from '../../tools/lib/vite.mjs';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Base URL of the shared dev server, or '' when there is none. */
    lcServerUrl: string;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const server = await startServer();
  // Warm the module graph once (index.html and the modules it pulls in are transformed on first request).
  await fetch(server.url + '/').catch(() => undefined);
  project.provide('lcServerUrl', server.url);
  return () => server.close();
}
