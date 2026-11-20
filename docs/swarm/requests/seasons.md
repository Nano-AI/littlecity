# Seasons and weather: requests and changes to shared or frozen files

## Frozen files touched (additive only)
- `src/scenario/scenario.ts` (frozen): `ScenarioDef.season`, `ScenarioDef.weather`, `CameraSpec.season`,
  `CameraSpec.weather`, types `SeasonOfYear`, `WeatherOfDay` (exported from `@/scenario`). Optional; absent means summer
  and clear. Nothing existing changes meaning.
- `tools/shot/main.ts` (frozen page): `show(..., { season, weather })`, `bench(name, frames, { season, weather })`; it now
  holds summer and clear unless asked, and settles the weather before a shot.
- `src/life/api.ts` (frozen) is not edited: `Signals.season` and `Signals.weather` are added by module augmentation in
  `src/life/season.ts`, optional, so every fake `Signals` in tests still compiles.
- `src/render/api.ts`: untouched.

## Shared shader code (Look's) touched
- `shaders/surface.ts`: five hooks, all behind `uSeasonOn` or the new `BARE` define: imports from `./season`, a
  `vRest` varying under `BARE`, a `discard` under `BARE`, `seasonGrass` in the grass branch, `seasonWater` in the water
  branch, `seasonSurface` before hatching. Nothing else moved; the walk-mode perspective define should merge cleanly.
- `shaders/ground.ts`: the height vertex reads the `ink` attribute and `uBare` to leave bare crowns out.
- `shaders/composite.ts`: halo loop also sums colour (used only while `uFestive > 0`); mist (`uFog`); ink density eased
  on glowing pixels while the festival is up.
- `index.ts`: season uniforms, the BARE material swap, precip pass after the composite, `PAGE_STYLES` gains
  `season`, `weather`, `season-look`.

## Other owners' files touched
- `src/gen/tree/species.ts`: `edge` foliage codes; branches inside broadleaf crowns (hidden in leaf).
  `tree.test.ts` budgets +160 triangles for those.
- `src/life/wind/smoke.behaviour.ts`: one line, the plume is "busy" when `cold > 0.5`.
- `src/ui/interface.ts`, `icons.ts`, `src/app/main.ts`: season and weather buttons (optional `seasons` host).
- `tests/helpers/browser.ts`: `pinCalendar` adds `season=summer&weather=clear` to app URLs that name neither.

## Requests
- **Boats** (owner of `src/life/boats/**`, `src/life/ships/**`): fewer boats out in winter and in storms. Wanted: the
  boat systems read `seasonOf(signals).weights.winter` and `weatherOf(signals).gust` (both in `src/life/season.ts`) and
  keep that share of boats moored (say up to 60% in deep winter, all small boats in a storm). Not edited here.
- **People**: scarves and hats when `seasonOf(signals).cold > 0.5`, umbrellas and hurrying when `weatherOf(signals).rain
  > 0.3`, laundry (L-laundry) taken in when it rains. Not done.
- **Sound**: rain on roofs (`weather.rain`), wind (`weather.gust`), snow hush (`weather.snow`), thunder (`weather.flash`
  rising edge, delayed). Not done.
