# People (Stage 3) handoff

Branch `swarm/people`. Brief: the orchestrator's original message (residents who walk real routes). Read `src/life/people/README.md` first; it maps every file.

## Done and verified
- Walking graph `src/resolve/nav.ts` (types reshaped in `src/resolve/plan.ts`, listed in `docs/swarm/requests/people.md`), 21 tests in `nav.test.ts`.
- Routing `src/life/people/route.ts` (A*, cached), the walked line `walk.ts`, the simulation `crowd.ts`, drawing `people.system.ts`, the census for window lights `home.ts`.
- The person: `src/parts/people/{person,pose}.ts`, parts `resident`, `figure`.
- Rules with fixtures in `scenarios/rules/`: L21, L22, L23 (jobs, includes the L08 lamplighter round and the `lampReached` / `bellRung` events), L24, L25, L27, L28 (children, kites, pigeon spots), L32.
- L26 reactions (look, hop, chat bubble, hand to hat) are runtime only in `crowd.ts` / `people.system.ts`: no rule file, by design.
- Watched (stairs, viaduct, roof hatch, square, dusk) and benchmarked: see README "How to watch".

## In progress
- Nothing half-done at the last commit. If this line is stale, `git status` is the truth.

## Next, in order
1. Merge `yaoderek/bloom-s-monkey-city-builder` into the branch, `npm run check` green, final report.
2. Nice-to-have after that: props in workers' hands (broom, rod, sack), a drawn roof hatch (Houses), seats once Dressing's benches exist.

## Decisions and gotchas
- The worktree guard refuses compound shell commands (`mkdir` + heredoc, `for` loops, `cat > file`). One plain command per call; write files with the Write tool.
- Heavy loops of `npm run bench`/shots in one call get killed (exit 137). One camera per call.
- `check.structure(x, y, z)` returns the Structure; compare `.id`.
- Rule ids must look like `L21.name` or `X-PEOPLE.sheet`.
- A house whose door opens onto nothing walkable has `resident/indoors` people: never drawn, not counted toward the cap of 60. Without this the bench town had 14 walkers.
- Resident ids anchor on the house's founding block (seq = structure id), so a moved door does not re-roll the household.
- A sky bridge (R-A02) is a covered gallery: people crossing it are hidden, correctly. No lookout is placed there.
- Frame drops with walkers come from the renderer's ground-shade redraw (every other frame while anything moves), not from the crowd (0.03 ms a step). Raised with Look in the requests file.
- `src/resolve/engine/run.test.ts` had one assertion loosened (it pinned an empty nav graph).
- A job is a `workplace` socket (`name` = `job|order|ref`), not a new actor; the crowd assigns residents (live-in first, then nearest). Workers carry no props (no broom, rod or sack is drawn).
- `scenarioTown()` in `testing.ts` resolves with the scenario's own rules (the L23 fixture brings its own lamps; D01 is Dressing's).
- After a chat both rest 40 s (`PEOPLE.chatRest`); without it a pair on a busy street chatted for minutes.
- Timing assertions flake under load: assert means loosely, never a worst case.

## How walking is verified
- `npm test`: `crowd.test.ts` steps the crowd at 30 Hz with a watcher (`testing.ts`) that fails on leaving a cell, crossing with no link, wrong height, walking backwards, or being stuck.
- By eye: `scenarios/people/people-town.scenario.ts`; `npm run shots -- people-town`; frame sequences with the untracked helper `.context/watch.mjs` (`--until x,y,z` waits for a walker in a cell), reading `window.__lcPeople`.
