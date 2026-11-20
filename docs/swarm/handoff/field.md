# Field (handoff)

A new floor piece, `field` (Ground drawer, after Plaza). What a patch becomes is read
from its shape; residents come and play on it. Frozen and shared files touched:
`docs/swarm/requests/field.md`.

- **Shape table** `src/rules/roles/field.lib.ts` (documented at the top; tests in
  `field.test.ts`): the largest clear rectangle (≥ 3 cells and ≥ 3/4 of the region, else a
  kickabout green), then by short × long side: 1×3–4 boules, 1×5+ track, 2×3 basketball,
  2×4–6 tennis, 2×7+ track, 3×3–4 basketball, 3×5–6 tennis, 3×7+ football, 4×4 bowling
  green, 4×5 croquet, 4×6+ and 5+ football. A field never climbs a terrain step (each level
  is its own region). R-G03 pins the role and a `field-court` feature (the rectangle).
- **Looks** `src/gen/floor/field.gen.ts`, `courts.ts` (chalk lines lifted a hair per layer;
  `field-courts` is in the coplanar scan); furniture D40 + `src/parts/props/court.part.ts`
  (hoops, net, goals, umpire's chair); a bench off one side; two lamps in town.
- **Games** `src/life/field/`: `kit.ts` (players, ball physics, movement), `basketball.ts`,
  `tennis.ts`, `football.ts` (also the kickabout green), `lawn.ts` (bowls, boules, croquet,
  races), `sports.ts` (who plays what, how many). Pure, fixed-step: `games.test.ts`.
- **The chain** `src/life/town/chains/field.ts`: calls games by day and dusk, gathers free
  empty-handed residents (children only on a school playground, greens and tracks), runs
  the game, keeps players' graph cells current, watchers at the edge follow the ball and
  clap/groan, routes avoid a court in play, handshakes then home or the inn. Stops for
  night/rain/snow at the next break, at once on an edit. At most 30% of residents play.
- **Watch**: scenarios `field-courts`, `field-basketball`, `field-tennis`, `field-football`,
  `field-four-courts`. Sequences: `node src/life/testing/sequence.mjs field-basketball
  --warm 75000 --frames 24 --every 166 --zoom 13 --aim '[26, 0.6, 14.5]'`.
  `window.__lcTown.board.chains.find(c => c.id === 'field').call()` calls games now.
- **Not done / thin**: no skating rink in winter, no dog chasing the ball, no scoreboard;
  basketball players bunch near the key on small courts; the tennis partner at the net
  stands still; football goals are a flat white net; lamps are not lit early in dusk.
