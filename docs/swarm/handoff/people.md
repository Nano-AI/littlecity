# People (Stage 3) handoff

Branch `swarm/people`. Brief: the orchestrator's original message (residents who walk real routes). Read `src/life/people/README.md` first; it maps every file.

## Done and verified
- Walking graph `src/resolve/nav.ts` (types reshaped in `src/resolve/plan.ts`, listed in `docs/swarm/requests/people.md`), 21 tests in `nav.test.ts`.
- Routing `src/life/people/route.ts` (A*, cached), the walked line `walk.ts`, the simulation `crowd.ts`, drawing `people.system.ts`, the census for window lights `home.ts`.
- The person: `src/parts/people/{person,pose}.ts`, parts `resident`, `figure`.
- Rules with fixtures in `scenarios/rules/`: L21, L22, L23 (jobs, includes the L08 lamplighter round and the `lampReached` / `bellRung` events), L24, L25, L27, L28 (children, kites, pigeon spots), L32.
- L26 reactions (look, hop, chat bubble, hand to hat) are runtime only in `crowd.ts` / `people.system.ts`: no rule file, by design.
- Watched (stairs, viaduct, roof hatch, square, dusk, jobs, chat, kite) and benchmarked: see README "How to watch".
- Integrated with the real Dressing props and Animation actors (no stand-in lamp or pigeon rules left). Main (`yaoderek/bloom-s-monkey-city-builder`) is merged in. The only test that still fails in a full run is `interface.e2e` "phone: touch" (failed on the untouched baseline too; passes alone with `-t "phone: touch"`).

## In progress
- Nothing half-done at the last commit. If this line is stale, `git status` is the truth.

## Next, in order
1. Nothing owed. Nice-to-have: props in workers' hands (broom, rod, sack), a drawn roof hatch (Houses), seats once Dressing's benches exist.

## Decisions and gotchas
- Props in walkable cells (`FOOTPRINTS` in `src/resolve/nav.ts`): fences, hedges, retaining walls cut a side; their gates and gaps are gate links; posts on a side are steered round (`NavLink.post`); wide things on a side and anything solid at a cell's centre cost `NAV.clutter` (20) but never cut (`NavNode.clutter`). A new prop type defaults to "post". Only a run may disconnect a place: a net rack once cut a pier off.
- The lamplighter's round: lamp posts only (D01, D02, D20, pier), the ten nearest the biggest square, one connected part. Hanging and door lanterns are not on it. Lamps on the round wait for him via `deferLamp` (added to `src/life/dusk/lamps.system.ts`); window lights follow `setOccupied` (`src/life/dusk/occupancy.ts`), both called from `people.system.ts`.
- Kite and pigeons are separate choices for a child (the kite wins when windy); with them lumped together 14 pigeons drowned out the one kite spot.
- Fixtures must assert relations among their own things (each stop names a lamp post), never totals other owners' rules can change.
- The worktree guard refuses compound shell commands (`mkdir` + heredoc, `for` loops, `cat > file`). One plain command per call; write files with the Write tool.
- Heavy loops of `npm run bench`/shots in one call get killed (exit 137). One camera per call.
- A house whose door opens onto nothing walkable has `resident/indoors` people: never drawn, not counted toward the cap of 60. Without this the bench town had 14 walkers.
- Resident ids anchor on the house's founding block (seq = structure id), so a moved door does not re-roll the household.
- A sky bridge (R-A02) is a covered gallery: people crossing it are hidden, correctly. No lookout is placed there.
- Anything that moves makes the renderer redraw its ground-shade picture (a second scene pass). With walkers updated every frame, `tests/e2e/interface.e2e.test.ts` (about 25 app pages left open) timed out in two tests. Fix on our side: the crowd is DRAWN 15 times a second (`PERSON.drawRate`), simulated every frame. Do not raise it without rerunning that file. Raised with Look in the requests file.
- A job is a `workplace` socket (`name` = `job|order|ref`), not a new actor; the crowd assigns residents (live-in first, then nearest). Workers carry no props (no broom, rod or sack is drawn).
- After a chat both rest 40 s (`PEOPLE.chatRest`); without it a pair on a busy street chatted for minutes.
- Timing assertions flake under load: assert means loosely, never a worst case.

## Animation polish changes (2026-11-19)
- Doors open (L29): the crowd owns a door table (`doors.ts`, `crowd.doors`) and gates door pieces on it; `Piece.enter` marks a door piece going in. Shopkeepers sweep on the window side of a shop. Walkers going wide past a door go wide away from it (`towardDoor` in walk.ts).
- Thresholds: `Person.edgeX/edgeZ/fadeTime`: newcomers climb up out of the water at their landing before walking home; leavers walk off a dock's end or into the sea (way-outs over water preferred). people.system draws the step down/up instead of shrinking.
- Workers hold tools (`toolOf` in people.system.ts, meshes in `src/parts/people/extras.ts`).
- Castle life: `troop.ts`, `rider.ts`, `track.ts`, `garrison.system.ts`; walkers wait for soldiers and the horse (`CrowdOptions.obstacles`).

## How walking is verified
- `npm test`: `crowd.test.ts` steps the crowd at 30 Hz with a watcher (`testing.ts`) that fails on leaving a cell, crossing with no link, wrong height, walking backwards, or being stuck.
- By eye: `node src/life/testing/sequence.mjs everything --warm 25000 --zoom 8 --target x,y,z --frames 6 --every 3000 --name n` (Animation's tool; add `--time 0.6 --run` for the evening). Also `scenarios/people/people-town.scenario.ts`; `npm run shots -- people-town`; frame sequences with the untracked helper `.context/watch.mjs` (`--until x,y,z` waits for a walker in a cell), reading `window.__lcPeople`.
