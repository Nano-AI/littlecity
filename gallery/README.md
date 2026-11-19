# The gallery

`npm run dev`, then open `/gallery/index.html`. It shows every registered
generator, layer, part and scenario by itself, with orbit controls (the same
pointer reading as the game), and sliders bound to the style modules in
`src/style/*.ts` so values can be tuned live.

Nothing is listed by hand. Add a generator, a part, a scenario or a style
module and it appears.

## What a gallery entry is (decision)

**A gallery entry is a scenario under `scenarios/gallery/**`.** This confirms
the convention CONTRACTS section 16 proposed, with two additions that make
the list complete without anyone writing files first.

1. **Hand-made entries.** Any `scenarios/gallery/**/<name>.scenario.ts` is
   listed under "Gallery entries", and `npm run shots -- 'gallery/**'`
   renders them all. Use the scenario's own `rules` to show a part whatever
   the real rules decide (`scenarios/examples/pipeline-demo.scenario.ts` is
   the pattern). `scenarios/gallery/tray-pieces.scenario.ts` is an example.

2. **Named entries replace the automatic ones.** Every kind in the kind
   table and every registered part gets a row whether or not a file exists.
   The row shows:
   - the scenario named **`gen.<kind>`** (for example `gen.house`, in
     `scenarios/gallery/gen.house.scenario.ts`) or
     **`part.<category>.<type>`** (for example `part.prop.lamp`,
     `part.feature.door`, `part.actor.gull`), if one exists;
   - otherwise an **automatic specimen** from `gallery/specimens.ts`: for a
     kind, a few pieces laid out the ways a player would build them; for a
     part, three plain houses and open ground with a gallery rule that emits
     that feature (on a ground-floor wall, an upstairs wall, and a roof
     cell), prop or actor (on open ground).

   The automatic specimens are stand-ins: good enough to see that something
   draws, not composed. The owner of a generator or part should add the
   named scenario, with the cameras and neighbours that show it properly;
   props on a line or at a socket (a laundry line, smoke on a chimney) need
   one, because the automatic rule only knows cell anchors.

3. **Everything else discovery finds** (rules, facts, behaviours, systems,
   all scenarios, style modules) is in the registry tables under the viewer.

A scenario that the current placement rules refuse is shown as a message in
the viewer, not as a broken page; the scenario test (`npm test`) is what
fails for it.

## The page

- **Left:** the list, with a filter. An entry's address is its URL fragment:
  `/gallery/index.html#gen.house`, `#part.prop.lamp`,
  `#scenario.hello-town`, `#icons`.
- **Middle:** the town, drawn through `TownView` only (like `tools/shot`).
  Drag to orbit, right-drag or two fingers to pan, scroll or pinch to zoom.
  Buttons switch between the scenario's cameras and hold the time of day.
- **Right:** one group of sliders per style module. A value with a declared
  range gets a slider, other numbers a number box, `#rrggbb` strings a colour
  well. A change calls `setStyle()`, resolves the scenario again (the Auto
  numbers are style values too) and redraws in a fresh view, so it shows
  whatever the renderer caches. Changed values are underlined; **Copy** puts
  them on the clipboard as JSON to paste into the style files; **Reset**
  puts everything back. Nothing is saved.
- **`#icons`:** every icon the interface draws (`src/ui/icons.ts`), large
  and at tray size.

The same slider panel is the game's dev tuning panel (☰ → Tuning).

`window.__gallery` (`entries()`, `show(id)`, `current()`, `problem()`,
`view`) is the debug handle the browser test uses.
