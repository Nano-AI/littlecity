# Seasons and weather: handoff
Branch `swarm/seasons`. Spec: design 13a and section 7 (sliders). Requests: `docs/swarm/requests/seasons.md`.
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
- **Mist** in the composite (`uFog`), smoke from every chimney when cold.
- **Sliders** (`src/ui/slider.ts`, one component for time, season, weather): scrub live, settle on release.
  Eased signals: `glideTime`/`scrubTime` (forward through the hours), `glideSeason`/`scrubYear` (short way
  round, weather `hurry` makes snow settle/melt in seconds). `hold`/`setPhase`/`holdSeason` stay instant (tools).
- **Festival bug fixed**: feedback's pop-in (F05) showed new props; festival system now holds them down
  every frame (`src/life/seasons/festival.test.ts`). Snowman shown while cover > 0.65. Coats, woolly hats,
  umbrellas: `wrapLook` and `UMBRELLAS` in people.system / extras (additive).

## Not done
Scarves, fewer boats (request filed), icicles, leaf drifts, pumpkins, woodpiles (stooks: the harvest errand's),
footprint tracks, candles in windows, bridge/gate lanterns, rainbow, roof snow slides, warm light pools on snow
(only a stronger halo), weather sounds, lambs.

## Gotchas
- GLSL: `vec3(vec2, float)` puts the float in z; `patch` is reserved. Rain quads wind both ways: DoubleSide.
- Summer clear is not bit-identical: ≤26 isolated ink-edge pixels per 1280x800 still differ by ≤6/255 (recompiled shader).
- D35 stays last in decoration (650), own slots, socket anchors only, or summer dressing/life changes.
