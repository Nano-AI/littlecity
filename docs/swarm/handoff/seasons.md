# Seasons and weather: handoff

Branch `swarm/seasons`. Spec: design section 13a. Requests and frozen-file notes: `docs/swarm/requests/seasons.md`.

## State
- **Signals** (`src/life/season.ts`, wired in `signals.ts`): `signals.season` (year 0..1 from spring, weights blended over
  `SEASON.blend` loops, cold, tree turn/bare/blossom, festival 0..1) and `signals.weather` (spell kind; rain, snow, cloud,
  fog, gust; settled `cover`, `thaw`, `wet`; lightning `flash`). Optional on `Signals` (module augmentation): read through
  `seasonOf` / `weatherOf`, which fall back to summer and clear. Year = 3 dusk loops a season (24 min, 1.5 h a year),
  turns only while time runs. Spells ~160 s, seeded, weighted by season; first spell clear; winter opens with snow.
- **Holds**: `holdSeason`, `setYear`, `holdWeather`, `settleWeather` on `TownSignals`. URL `?season=winter|festival|0.8
  &weather=snow&settle=1`; scenario/camera `season`, `weather`; `npm run shots -- x --season festival --weather snow`;
  sequence `--season --weather --settle --year 0.74 --year-run`; bench `--season --weather --phone`; flicker `--season`.
- **Pinned**: shot page, probe, guide tool, gallery and every e2e app page (tests/helpers/browser.ts) hold summer+clear.
- **Look** (`src/render/shaders/season.ts`, `src/render/season.ts`): behind `uSeasonOn` (0 in summer clear). Grass, crowns
  per tree (ink id = seed), crops, sea; snow and wet from the grounding height picture (sky-open), inked snow edge,
  corners/eaves first, melts sunny faces first; ice on still water and the shore rim; puddles, rain rings; grade and paper.
- **Bare trees**: broadleaves carry branches inside the crown (`species.ts`, `FOLIAGE` codes in `edge`, `src/gen/foliage.ts`);
  the crown dissolves in the `BARE` shader variant (the only one with a discard, swapped in only while leaves are down);
  the height pass drops bare crowns so snow lies under them.
- **Falling** (`src/render/precip.ts`, `shaders/weather.ts`): world-anchored tiles, made from the vertex number, hidden
  under cover and behind the page; cap `WEATHER.capDesktop/capPhone`. One draw call per kind falling.
- **Festival**: rule D35 (eaves, wreaths, street and square strings, the main square's tree), parts in
  `src/parts/props/festival.part.ts`, `src/life/seasons/festival.system.ts` (up/down house by house, lit from dusk).
- **Mist** in the composite (`uFog`), smoke from every chimney when cold, season/weather buttons + icons.

## Not done
People in scarves/umbrellas, laundry taken in, fewer boats (request filed), seasonal props (stooks, pumpkins, woodpiles,
snowman, icicles, leaf drifts), falling leaves on gusts beyond L05, candles in windows, lanterns on bridges/gate, rainbow,
roof snow slides, trodden tracks (only patchy), sound for weather, lambs.

## Gotchas
- GLSL: `vec3(vec2, float)` puts the float in z (cost an hour in precip). Rain quads wind both ways: DoubleSide.
- `patch` is a reserved word in GLSL.
- Summer clear is not bit-identical: ≤26 isolated ink-edge pixels per 1280x800 still differ by ≤6/255 (recompiled shader).
- D35 must stay last in decoration (priority 650) and claim only its own slots, or summer dressing changes.
