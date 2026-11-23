# Loading screen: a little drawing while the town loads

**Status:** approved (2026-11-23). A small change, with its own PR off `yaoderek/bloom-s-monkey-city-builder`.

## Intent

Today the page is blank cream (`#f2ede3`) until the game's code (about 1.1 MB gzipped, 3.4 MB raw) downloads and runs, and the first town frame is drawn. Then the bare island appears, and its trees and props pop in a moment later. On a phone connection that blank lasts several seconds. The user wants something on screen from the first moment, so the page never looks empty or broken.

## What you see

```
        /\          |▲|
       /  \   ⌂    |  |
      ──────────────────
       Drawing your town…
```

- **The drawing.** A small ink drawing, a house and a lighthouse on a shoreline, inks itself in stroke by stroke (SVG `stroke-dashoffset`), centred on the cream page, in the game's ink colour (`#3a2f2a`). Under it: "Drawing your town…".
- **Leaving.** It fades out over about 0.4 s once the first frame with the dressing (trees and props) has been drawn, so you never see the bare island pop in. It is then removed from the page.
- **Reduced motion.** With `prefers-reduced-motion`, the drawing shows finished and doesn't animate. The fade becomes a plain removal.
- **If the game fails to start** (an uncaught error before the town is shown, e.g. no WebGL), the line changes to "This browser couldn't draw the town. Try reloading, or another browser." The drawing never claims to be loading something that has died.

## Goals

1. Something drawn appears at the browser's first paint, before any game code has loaded.
2. It hands over to the town without a flash or a bare-island pop.
3. A failed start says so instead of loading forever.

## Non-goals

- A progress bar or percentage, which would need a loader script reporting download progress (option C, not chosen).
- Making the download itself smaller (code-splitting the 2.9 MB chunk). That's a different change.

## Anti-goals (a failure even if it works)

- It delays the game. The drawing must not wait for anything (no fonts, images or scripts to fetch), and must not hold the town back once it's ready.
- It gets in the way. It never takes a click, and never sits between the pointer and the canvas (the e2e tests check `elementFromPoint(...) === canvas`).
- It weighs anything: inline markup and CSS only, a few KB.

## Constraints

- The loader lives in `index.html` itself: inline `<style>` and inline SVG. Anything drawn by the game's code would wait for that same 1.1 MB.
- `pointer-events: none` throughout, so `document.elementFromPoint` passes through it, both during the fade and before it.
- Plain HTML/CSS. One tiny inline script for the failure line, no dependencies.
- Typecheck, lint, unit and e2e stay green.

## Approaches

| | What | Trade-off |
|---|---|---|
| A | The name "Little City" with a pencil line drifting under it | The smallest, but plain |
| **B (chosen)** | **A house and a lighthouse that ink themselves in, plus "Drawing your town…"** | **It matches the hand-drawn look, and weighs a few KB of inline SVG** |
| C | A progress bar | Says how long is left, but needs loader code, and feels least like the game |

Picked by the user ("B is good").

## How it works (decided)

- `index.html`: a `<div class="lc-loading" role="status">` after the canvas, holding the inline SVG and the line of text, with its CSS in the existing inline `<style>`.
- `src/app/main.ts`: in `frame()`, after `render()`, in the first frame where `ready` (the polled dressing) was non-null, add a class that starts the fade, then remove the element on `transitionend`, with a timeout fallback.
- Failure: an inline classic `<script>` registered before the module script listens for `error` and `unhandledrejection`. Until the town has shown, either swaps the text to the failure line and stops the animation. Once the loader is gone, the listener does nothing.

## Left to the builder

- The drawing's exact paths. They should be hand-drawn-looking: slightly uneven lines, about 6–10 strokes, about 1.5–2 s to draw. Loop it, or hold it finished, if loading runs long.
- The font: the same stack the UI uses, with no webfont fetch.
- The sizing on phones.
- The tests: e2e that the loader is in the served HTML and gone once the town is dressed; `elementFromPoint` at the centre is the canvas once the town is up.
- Measure the blank before and after, on a fast connection and on throttled "Slow 4G": time to first visible thing and time to town. The numbers go in the PR.
