// Browser tests without a second test runner: a dev server on a free port
// plus headless Chromium, from inside Vitest. Name the file *.e2e.test.ts.
//
//   const app = await startApp();                         // in beforeAll
//   const { page, errors } = await app.open('/?seed=1', { width: 390, height: 844, hasTouch: true });
//   ...
//   await app.close();                                    // in afterAll

import type { Browser, BrowserContextOptions, Page } from 'playwright';
import { launchBrowser, openPage } from '../../tools/lib/browser.mjs';
import { startServer } from '../../tools/lib/vite.mjs';

export interface OpenOptions extends BrowserContextOptions {
  width?: number;
  height?: number;
  scale?: number;
  /** Show the first-visit welcome card (it is marked as already seen by default). */
  welcome?: boolean;
}

export interface App {
  url: string;
  browser: Browser;
  /** Opens a path of the dev server in a fresh context. `errors` collects page errors. */
  open(path?: string, opts?: OpenOptions): Promise<{ page: Page; errors: string[] }>;
  close(): Promise<void>;
}

/**
 * The app's pages open in summer under a clear sky, held (seasons, design section 13a), so a test
 * sees the town it was written against however long it runs. A path that names a season keeps it.
 */
export function pinCalendar(path: string): string {
  const [head, hash = ''] = path.split('#') as [string, string?];
  const [route, query = ''] = head.split('?') as [string, string?];
  if (route !== '/' && route !== '/index.html') return path;
  const params = new URLSearchParams(query);
  if (!params.has('season')) params.set('season', 'summer');
  if (!params.has('weather')) params.set('weather', 'clear');
  return `${route}?${params}${hash ? `#${hash}` : ''}`;
}

export async function startApp(): Promise<App> {
  const server = await startServer();
  const browser: Browser = await launchBrowser();
  return {
    url: server.url,
    browser,
    open: (path = '/', opts = {}) => openPage(browser, server.url + pinCalendar(path), opts) as Promise<{ page: Page; errors: string[] }>,
    async close() {
      await browser.close();
      await server.close();
    },
  };
}
