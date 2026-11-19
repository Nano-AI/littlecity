# Polish handoff (branch `swarm/polish`)

## Speed: how a resolve reuses work (read before touching resolve or a fact)
- `src/resolve/facts/content-keys.fact.ts`: a 64-bit content key per column (blocks, resolved kinds, structure ids, floors, edges, terrain, seed) and O(1) rectangle keys. `RegionMemo` keeps per-structure values across resolves (last two resolves, so a ghost preview does not flush them). `withoutMemos(fn)` = a cold resolve.
- Kept by region key: `structureInfo`, `roofRegions` (reach 1), `facades` (reach 3; alley flags kept with the exact rectangle their corridor walk read), floor regions, `streets`, `gardens`, structure hashes (reach 1 + own outputs + supports).
- Engine (`src/resolve/engine/reuse.ts`): `RuleDef.local` (reach), `localAlso`, `findEach()`, `localReplay`. A local rule's apply output is replayed, and a `findEach` rule's candidates are kept, while the key (columns around the structure and its block neighbours, their outputs so far, style version) is unchanged. Local now: J04, J09, J10, J11 (replay); J06, J07, J24, J26 (find). Read the `local` doc in `engine/api.ts` before marking a rule: everything apply reads must be inside the reach or in `localAlso`.
- `staged.ts`: placing the piece just previewed reuses the ghost's shape (`sameWorld`).
- Path generator draws cell by cell and keeps each cell's mesh by exactly what it reads (a town's streets are one structure).
- Guards: `src/resolve/incremental.test.ts` (360 random legal edits, warm plan == cold plan, facts included), `src/gen/floor/path-cache.test.ts`. All 189 scenarios gave identical shape/dressing hashes and meshes before and after (checked with throwaway scripts against the base commit).
- Tools: `node tools/profile.mjs [scenario] [--shape-only]` (passes, rules; run under `node --cpu-prof`), `node tools/phone-bench.mjs`, `npm run bench -- <any scenario>` (legal edits via `src/scenario/edits.ts`).

## Small fixes done
Walls take `run-bare` (J20-F); button press no longer shrinks the touch box; square bunting has glowing bulbs (`bunting` is a lamp type, 0.55 bright); L20 rower; fishing boat legs routed through water (`src/rules/life/waterway.ts`); bench works on any scenario; sound off by default; cloud shadows are a soft hue-keeping darkening.

## Not done / watch
- resolveShape on bench-2000 is about 8–10 ms in the browser on a loaded machine (7.9 ms when quieter): at the budget, not clearly under. Next: find-heavy shape rules that read giant floor structures (J21, U09), R-H01, buildStructures.
- Floor structures (streets) defeat per-region keys: any edit inside a street's box recomputes its street fact.
- Phone: emulated only (Playwright, 4× CPU throttle, this Mac's GPU). Steady frames are 60 fps; an edit costs 30–55 ms and the dressing frame 50–67 ms. Defaults unchanged (half ink and 30 walkers already automatic); `?ink=` / `?density=` override for measuring.
