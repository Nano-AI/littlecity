#!/usr/bin/env node
/* global console, document, process */
// Opens the app, opens the guide and screenshots it scrolled to the happenings, on a desktop and a phone:
//   node src/life/testing/guide-look.mjs   → .context/shots/guide-<desktop|phone>-<n>.png
import { launchBrowser, openPage } from '../../../tools/lib/browser.mjs';
import { startServer } from '../../../tools/lib/vite.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [name, width, height] of [['desktop', 1280, 800], ['phone', 390, 844]]) {
    const { page } = await openPage(browser, `${server.url}/?seed=7`, { width, height });
    await page.waitForFunction(() => document.querySelector('[aria-label="Guide to special buildings"]') !== null, null, { timeout: 60_000 });
    await page.click('[aria-label="Guide to special buildings"]');
    await page.waitForTimeout(800);
    for (const [i, group] of ['big-days', 'every-day'].entries()) {
      await page.evaluate((g) => document.querySelector(`[data-group="${g}"]`)?.scrollIntoView(), group);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `.context/shots/guide-${name}-${i}.png` });
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close?.();
  process.exit(0);
}
