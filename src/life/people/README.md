# People

The residents: who they are, where they go, how they get there, how they are
drawn. Owner: People (Stage 3). Catalogue L21–L28, L32; design section 13.

## The pieces

| File | What it is |
|---|---|
| `src/resolve/nav.ts` | The walking graph, built in the dressing stage from the shape plan. Pure. |
| `route.ts` | A* over the graph with the L24 costs; remembers routes. Pure. |
| `walk.ts` | Turns a route into the line actually walked: one piece per cell, curves at turns, keep right, heights on stairs, steps and stoops, doors, time hidden inside. Pure. |
| `crowd.ts` | The simulation: every person's mode, goal and position. No drawing, no clock of its own. |
| `people.system.ts` | Runs the crowd and draws it through the `LifeStage`. The only file that touches the stage. |
| `home.ts` | Who is at home, for the window lights; the `residentHome` and `lampReached` events. |
| `testing.ts` | A watcher for tests: fails if anyone leaves the graph, walks backwards or gets stuck. |
| `src/parts/people/person.ts`, `pose.ts` | The drawn person (five rigid pieces) and its poses. |
| `src/rules/life/L2*.rule.ts`, `L32*` | What the plan says: residents, haunts, queue points, landings, ways out, stoops. |
| `src/style/people.ts` | Every number: `nav` (costs), `people` (crowd), `person` (drawing and motion). |

Rules decide **what a town offers** (pure, in the plan, as actors and
sockets). The crowd decides **what people do with it** at run time. Nothing
random: every choice is `rand(person seed, name, counter)`, and time comes
only from `signals.time`.

## Motion style

Written here because `src/life/MOTION.md` did not exist when this was made;
if the Animation owner's file says otherwise for shared things, that wins.

- **Poses are held, places glide.** A figure's position moves smoothly
  along its line. Its *drawing* steps: a walk is four held drawings a
  stride (contact, passing, contact, passing: "on twos"), an idle changes
  drawing about three times a second. Nothing is blended between poses.
- **Fifteen drawings a second.** The crowd is simulated every frame but its
  picture changes `PERSON.drawRate` (15) times a second. It suits the held
  poses, and every frame in which something moves costs the renderer a
  second pass for the ground shade, so it also keeps the page light.
- **A step is a step.** Stride phase advances with distance walked
  (`PERSON.stepsPerCell`), never with time, so feet do not slide. Somebody
  held up stands; they do not march on the spot.
- **Turn, then go.** A walker more than about 60° off their line turns on
  the spot first. Nobody moves backwards or sideways.
- **Small bob, no squash.** The body rises 0.014 on the passing pose. People
  are rigid pieces; squash and stretch belongs to buildings landing.
- **One accent at a time.** An idle is mostly still, with one small event
  every few seconds (a head turn, a swung foot, a tug on the line).
- **Nobody passes through anything.** Through a door: its leaf swings open
  first (the crowd's door table, `doors.ts`), they walk into the dark
  doorway, it shuts after them. Up through a hatch: its lid flops open first.
  At the shore: they climb up out of the water, or walk off into it
  (`edgeX/edgeZ`). Only with no water or edge anywhere do they still shrink
  out of sight.
- **People are solid** (the owner's request). Each walker looks at the
  nearest person in its way and makes one decision: oncoming, both keep
  right; slower ahead, overtake on the outside if there is room, else fall
  in behind; crossing, give way to whoever comes from the right; standing,
  go round the side away from them (a tie by id). The step aside is a world
  offset (`offX`, `offZ`) eased at `AVOID.rate`, turned into by the body,
  kept inside the cell, away from door walls, never into anybody beside, and
  back to the line before doorways, single-file stretches and the walk's
  end. Nobody steps closer than `KEEP` to anybody ahead. Standing spots are
  spread (`freeSpot`); nobody comes out of a door onto an occupied doorstep;
  walks leave and reach doors square to the wall. A knot is undone by
  thinking again once, then by squeezing past (counted honestly by
  `overlap.ts`; see `solid.test.ts`).
- **Castle life** (L36, L37): `troop.ts`, `rider.ts` on `track.ts`, drawn by
  `garrison.system.ts`.

## For other owners

- **Window lights (L07).** `homeCensus(signals).lit(structureId)` says
  whether anyone is in that house now; `.ready` is false until the crowd has
  seen a town (treat that as "light them all"); `.version` changes on every
  change. Or listen: `signals.on('residentHome', ({ home, count }) => …)`.
- **`personPassed`** is emitted with the cell each time a walker enters one.
- **Seats.** Any socket of type `seat` (shape or dressing stage) becomes a
  `haunt-bench`, or a `haunt-cafe` when its owner prop's type contains
  "table" or "cafe". The sitter uses the socket's frame: origin = where they
  sit, +Z = the way they face. A town with no seats simply has no sitters.
- **Lamps.** `lampReached` (`{ lamp: propId }`) is declared in `home.ts`.
- **Debug.** `window.__lcPeople` is the running crowd (`people`, `haunts`,
  `atHome`, `nav`).

## How to watch

```sh
npm run shots -- people-sheet      # every pose and forty looks, close and far
npm run shots -- people-town       # the town with every kind of route
npm run shots -- people-town --time dusk
```

`people-town` has a square, a pier, carved steps up a hill, a stairs flight
to a marble terrace, an open viaduct, a covered sky bridge and a roof garden
reached only through its house.

## Jobs, reactions, children

- **Jobs (L23, with L08's lamplighter).** A job is a place: `workplace`
  sockets named `job|order|ref`. The crowd gives each to one grown-up
  resident (whoever lives there, else nearest) and they keep it across
  edits. By day workers are mostly at their stations; at dusk the
  lamplighter walks to every lamp in order (`lampReached`, with the lamp
  prop's id), the bell ringer goes in to ring (`bellRung`), the keeper goes
  up the lighthouse until day; the baker is out at dawn. Lamps the
  lamplighter cannot reach never get an event: light those on a timer.
- **Reactions (L26)** are run time only, so there is no rule file: a block
  landing within 4 cells makes people stop and turn to look (three in ten
  add a hop); two people meeting stop for a chat two times in ten, taking
  turns under a bubble, then leave each other alone for 40 seconds; in a
  strong gust anyone in a hat puts a hand to it.
- **Children (L28)** run, and prefer `haunt-play` sockets: a kite spot on
  every square and viewpoint (the kite flies only while the wind is above
  `PEOPLE.kiteWind`) and every pigeon's cell.

## Props in the way

Decoration props are not blocks, so the graph reads them itself
(`FOOTPRINTS` in `src/resolve/nav.ts`). Runs along a side (fence, hedge,
retaining wall) cut the link; their gates and gaps are single-file ways
through. A post on a side (a lamp) is walked round. Wide things on a side
and anything solid in the middle of a cell cost 20 more and are passed to
one side: dear, but never a cut, so only a real fence can shut a place off.
Nobody is sent to linger in a cluttered cell, except to sit at its seats.

## Readings of the catalogue worth knowing

- **Shut-ins do not use the cap.** A house whose door opens onto nothing
  walkable has `resident/indoors` people: at home for good, never drawn.
- **The phone cap** is applied by the crowd (it knows the viewport), not by
  L21, which is pure and always emits up to 60.
- **Through a stranger's house** costs 12 extra, so houses are a way up only
  when there is no other.
- **A roof terrace with no door onto it** gets a hatch the graph derives
  (`door/hatch` is in the vocabulary but no rule emits one).
- **Garden** costs 2 a cell and **stairs** 1.5 (the catalogue names neither).

## The living town (L50–L57)

- **The scuffle (L50)** is a run-time reaction in `scuffle.ts`: two walkers
  who bump head on (or squeeze past) now and then vanish into a cartoon dust
  cloud (`src/parts/people/scuffle-art.ts`, drawn by `people.system.ts`); a
  ring watches; they sit dazed, dust off, and stomp off or go to the inn
  together. `crowd.scuffles.provoke()` starts one at once (sequences).
- **Errands** (`errand.ts`): the crowd can be sent on a few steps of visible
  work, each with a load carried in the hands (`Person.load`, drawn from
  `src/parts/people/loads.ts`) and something done on arrival. The crowd asks
  `CrowdOptions.errands` first whenever somebody chooses what to do. A failed
  step takes the load home; nobody keeps a load into a haunt.
- **The town's chains** live in `src/life/town/`: `board.ts` runs plans and keeps the stores where things lie once
  set down; `chains/` holds bread (L51), water (L52), the catch (L53),
  builders (L54), the night watchman (L55), market day (L56) and the wedding
  (L57). Their posts are `errand` sockets from `src/rules/life/L5*.rule.ts`.
  `people.system.ts` runs a `LivingTown` (crowd + board);
  `window.__lcTown` is it, for sequences.
- **The wedding (L57)** dresses its party in finery drawn over the person
  (`src/parts/people/finery.ts`, placed by `people.system.ts` with the body)
  and marches them as one body on a track (`track.ts`), holding them in
  `linger` while it moves them; see `src/life/town/chains/wedding.ts`.
  Bystanders stop to watch it pass: `Person.admire` is the pose they show
  while `startled` (a wave, a clap).
- **No extra people**: every chain takes its hands from the residents, so the
  cap (60, 30 on a phone) holds.

## Scenes (L63 and up)

- Beach day, snow day, harvest supper, picnics: chains in `src/life/town/chains/`
  (`beach.ts`, `snow-day.ts`, `supper.ts`, `picnic.ts`), sharing a cadence and a
  note through `src/life/town/scenes.ts`; design section 13c.
- `Person.drawX/drawZ` (L63): the figure drawn out past the edge of the cell it
  stands in (a paddler in the shallows, a bather wading in); drawing only.
- New poses `lie`, `lounge`, `read`, `dig`, `splash`; tools `book`, `spade`;
  loads for the beach, the supper and picnics in `loads.ts`.
- Watch: `node src/life/testing/sequence.mjs L63.beach --season summer --warm 140000`,
  `L64.snow-day --season winter --weather snow --settle --warm 45000`,
  `L65.supper --season autumn --time dusk --warm 40000`, `L66.picnic --season spring --warm 75000`.
  Frame cost: `node src/life/testing/scene-cost.mjs grown-town-4 --season summer`.
