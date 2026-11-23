# Loading Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A small ink drawing (a house and a lighthouse inking themselves in, with "Drawing your town…") shows at the browser's first paint and fades out once the town is dressed.

**Architecture:**
- The loader is inline markup and CSS in `index.html`, so it needs no game code.
- `src/app/loader.ts` dismisses it after the first frame that drew a dressing.
- A tiny inline classic script turns it into a failure line if the game dies before the town shows.

**Tech Stack:** HTML, CSS, inline SVG, TypeScript (Vite), Vitest e2e with Playwright (`tests/helpers/browser.ts`, `startApp`/`app.open`).

**Spec:** `docs/superpowers/specs/2026-11-23-loading-screen-design.md`

## Global Constraints

- **Inline only.** The loader lives in `index.html`: inline `<style>` and inline SVG. Nothing is fetched for it (no fonts, images or scripts).
- **Clicks pass through.** `pointer-events: none` on the loader at all times, so `document.elementFromPoint` passes through it.
- **Colours and font.** Ink `#3a2f2a` on the page's `#f2ede3`. Font: the UI's stack, copied from `--lc-font` in `src/ui/ui.css:14`.
- **Exact copy.** `Drawing your town…` (one `…` character). On failure: `This browser couldn't draw the town. Try reloading, or another browser.`
- **Leaving.** Fades out over about 0.4 s, after the first frame that drew a dressing, then is removed from the DOM.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, the drawing shows finished with no animation, and leaving is a plain removal.
- **The gate.** No new dependencies. Typecheck, lint, unit and e2e stay green.
- **Commits** end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A very slow load.** The drawing finishes and holds finished (`animation-fill-mode: forwards`), never stuck half-drawn or blinking. *Pinned by "the drawing finishes and holds" (Task 1).*
2. **A pointer or e2e click while the loader is still up or fading** reaches the canvas. *Pinned by "it never takes a click" (Task 1).*
3. **A phone (390×844).** The drawing and its line fit inside the viewport. *Pinned by "it fits a phone" (Task 1).*
4. **A start that dies (no WebGL)** says so instead of loading forever. *Pinned by "a start that fails says so" (Task 2).*
5. **An error after the town has shown** never brings the loader back. *Pinned by "a later error leaves the town alone" (Task 2).*

---

### Task 1: The drawing, and its hand-over to the town

**Files:**
- Modify: `index.html` (markup after `<canvas id="town">`, CSS in the existing inline `<style>`)
- Create: `src/app/loader.ts`
- Modify: `src/app/main.ts` (`frame()`, about line 382 `const ready = game.poll();` and line 398 `render();`)
- Test: `tests/e2e/loading.e2e.test.ts`

**Interfaces:**
- Produces:
  - `export function dismissLoader(doc?: Document): void` in `src/app/loader.ts`. It's idempotent. It sets `data-state="done"` on `.lc-loading` at once, starts the fade, and removes the element on `transitionend`, with a 600 ms timeout fallback. Under reduced motion it removes the element at once.
  - The markup contract: `<div class="lc-loading" role="status" data-state="loading">`, holding an `<svg aria-hidden="true">` with the strokes and a `<p class="lc-loading-line">` with the copy.

- [ ] **Step 1: Write the failing e2e tests** in `tests/e2e/loading.e2e.test.ts`. Use `startApp()` from `../helpers/browser`, as `tests/e2e/welcome.e2e.test.ts` does.
  - `the drawing is in the page before any game code runs`: `app.open('/?seed=1', { javaScriptEnabled: false })`. Then expect `.lc-loading` to be visible and `.lc-loading-line` to have the text `Drawing your town…`.
  - `the drawing finishes and holds`: JS disabled. Wait 3000 ms. Then expect every `.lc-loading svg path` to have a computed `stroke-dashoffset` of `0px`.
  - `the drawing stays still when motion is reduced`: JS disabled, with `reducedMotion: 'reduce'`. Expect `document.querySelector('.lc-loading').getAnimations({ subtree: true }).length === 0`, and every path's `stroke-dashoffset` to be `0px` at once.
  - `it fits a phone`: JS disabled, `{ width: 390, height: 844 }`. The `.lc-loading svg` and `.lc-loading-line` bounding boxes lie within `0..390 × 0..844`.
  - `it never takes a click, and leaves once the town is dressed`:
    - Open `/?seed=1` normally and wait for `window.__lc !== undefined && window.__lc.ui !== null`.
    - Expect `document.elementFromPoint(640, 400) === window.__lc.view.canvas`, whether or not the loader is still there.
    - Then `waitForFunction('!document.querySelector(".lc-loading")', { timeout: 15000 })`.
    - Expect `errors` to equal `[]`.
- [ ] **Step 2: Run the tests and see them fail.** Run: `npx vitest run --project e2e tests/e2e/loading.e2e.test.ts`. Expected: FAIL, because `.lc-loading` is not found.
- [ ] **Step 3: Implement.**
  - The markup and CSS in `index.html`, centred.
  - About 6–10 hand-drawn-looking strokes (slightly uneven paths), each drawn with `stroke-dasharray`/`stroke-dashoffset` keyframes, staggered, about 1.5–2 s in all, with `forwards`.
  - A `prefers-reduced-motion` block with no animation and offsets at 0.
  - `.lc-loading[data-state="done"]` fades to opacity 0 over 0.4 s.
  - `dismissLoader` in `src/app/loader.ts`. In `main.ts`, call it once, after `render()`, in the first frame where `ready` was non-null.
- [ ] **Step 4: Run the tests and see them pass.** Run the same command. Expected: 5 passed. Then run `npm run typecheck && npm run lint`, then `npx vitest run --project e2e tests/e2e/interface.e2e.test.ts tests/e2e/welcome.e2e.test.ts` (the clicks and the first visit). Expected: all pass.
- [ ] **Step 5: Commit.**
  ```bash
  git add index.html src/app/loader.ts src/app/main.ts tests/e2e/loading.e2e.test.ts
  git commit -m "A little drawing inks itself in while the town loads, and steps aside once the town is dressed"
  ```

### Task 2: A start that fails says so

**Files:**
- Modify: `index.html` (an inline classic `<script>`, before the module script)
- Test: `tests/e2e/loading.e2e.test.ts`

**Interfaces:**
- Consumes: Task 1's markup contract (`.lc-loading`, `data-state`, `.lc-loading-line`). `dismissLoader` sets `data-state="done"`, which the failure script reads.
- Produces: `data-state="failed"` on `.lc-loading`, which stops the animation in CSS.

- [ ] **Step 1: Write the failing tests** in the same file.
  - `a start that fails says so`:
    - Open `/?seed=1`, then `page.addInitScript` overriding `HTMLCanvasElement.prototype.getContext` to return `null` for `'webgl2'` and `'webgl'`, then `page.reload()`.
    - Expect `.lc-loading-line` to have the text `This browser couldn't draw the town. Try reloading, or another browser.`, and `.lc-loading` to have `data-state="failed"`.
  - `a later error leaves the town alone`:
    - Open `/?seed=1` and wait until `.lc-loading` is gone.
    - `page.evaluate(() => setTimeout(() => { throw new Error('later') }))`. Wait 300 ms.
    - Expect `.lc-loading` to have count 0.
- [ ] **Step 2: Run the tests and see them fail.** Run: `npx vitest run --project e2e tests/e2e/loading.e2e.test.ts`. Expected: the first new test FAILs (the line still reads `Drawing your town…`).
- [ ] **Step 3: Implement** the inline script. On `error` and `unhandledrejection` it does the following. If `.lc-loading` exists and its `data-state` is `loading`, set `data-state="failed"` and the failure copy. Otherwise do nothing. Add the CSS to stop the animation (show the strokes finished) under `[data-state="failed"]`.
- [ ] **Step 4: Run the tests and see them pass.** Run the same command. Expected: 7 passed. Then run `npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit.**
  ```bash
  git add index.html tests/e2e/loading.e2e.test.ts
  git commit -m "If the town cannot be drawn, the loading drawing says so instead of waiting forever"
  ```

### Task 3: Measure and gate (controller)

- [ ] **Measure.** Run `vite build` for base (`6df52d6`) and for the branch. With the CDP harness, on a quiet machine (load ≤ 4), interleave 3 runs each, on unthrottled and on DevTools "Slow 4G" (`Network.emulateNetworkConditions`: latency 150 ms, 1.6 Mbps down, 750 kbps up). Record:
  - first contentful paint;
  - time until something drawn is visible (a screenshot filmstrip every 250 ms);
  - time until the town is dressed.
- [ ] **Gate.** Run `npm run check` once. Expected: green.
