#!/usr/bin/env node
// The art guide's picture of the ghost preview. The ghost only exists while
// the pointer hovers, so `npm run shots` cannot take it; this drives the view
// through its test probe (src/render/testing/probe.ts) instead.
//
//   node docs/swarm/art/ghost-shot.mjs        # writes .context/art/ghost.png

import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { ROOT, startServer } from '../../../tools/lib/vite.mjs';
import fs from 'node:fs';
import path from 'node:path';

const out = path.join(ROOT, '.context', 'art', 'ghost.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const { page, errors } = await openPage(browser, `${server.url}/tools/shot/index.html`, { width: 1280, height: 800, scale: 2 });
  await page.addScriptTag({ type: 'module', url: `${server.url}/src/render/testing/probe.ts` });
  await page.waitForFunction('window.__look !== undefined');
  await page.evaluate(() => {
    window.__look.open('look-primitives', { ink: 'full', pixelRatio: 2, width: 1280, height: 800 });
    window.__look.camera({ yaw: 45, pitch: 32, zoom: 8, target: [18, 1.6, 19] });
    window.__look.ghost(true);
    window.__look.frame(2);
    window.__look.frame();
  });
  await page.locator('canvas').last().screenshot({ path: out });
  console.log(path.relative(ROOT, out), errors.length ? errors : '');
} finally {
  await browser.close();
  await server.close();
}
