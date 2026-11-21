# Raid handoff (branch `swarm/barbarians`)

Design section 13b ("Raid"), catalogue L69–L72. A longship of raiders comes in,
the band storms ashore, sets fires, loots, and sails off; or the player sinks
the ship and the town chases them into the sea.

## Try it
- `npm run dev`, a grown town (`/?seed=4242&mischief`, or Grow a town), the
  Mischief drawer's **Raid** (a longship icon): click near a shore. Menu:
  **Raiders: on/off** (raids on their own). Undo calls a raid off.
- Sequences: `raid-landing` and `raid-boats` scenarios (their headers have the
  commands). Verbs `raid@x,0,z`, `raidland@…`, `raidboats@…`, `shipsink@d,0,0`;
  `--follow-raid` keeps the camera on it. Frame cost:
  `node src/life/testing/scene-cost.mjs grown-harbour --raid landing`.
- `window.__lc.raids` (`summon({ at, kind })`, `current`, `auto`, `why`).

## How it is built (`src/life/raid/`)
- `site.ts` (pure): landings (walkable cells at the water's level with open
  sea beside them, how open the ground behind is, their neighbours), the town's
  heart, the landing raid's beach / turning point / route in and out
  (`ship-routes.ts`), the boats raid's stand-off point and boat paths.
- `raid.ts`: the `Raid` (beats, the ship and boats, the band, loot piles,
  targets, the town running, stopping them). Sea side in `stepSea` (called by
  the system), land side in `stepLand` / `offer` (called by the chain).
- `vessel.ts` (hull, yard and sail, oar banks, loot heap, posed on the swell,
  cut off at the map's edge), `figure.ts` (a raider drawn at sea with the
  crowd's own pieces and look: the hand-over at the water's edge does not show).
- `chain.ts`: the raid's chain on the board (first in `allChains`). Raiders
  ashore are crowd people from `crowd.ashore`, marked `raider`, claimed by it.
- `raid.system.ts`: plans on summons, steps and draws, war-cry balloons
  (`src/parts/raid/cry.ts`), flames on a burning ship, hears blasts and
  lightning, raids on their own. `sound.system.ts`: horn, alarm bell, cries,
  splashes, the keel on the sand.
- Parts: `src/parts/raid/longship.ts`, `src/parts/people/barbarian.ts`
  (costume), `raid-gear.ts` (brand, axe, club, horn), `loot.ts` (chest, pig,
  hen, ham, cloth, cheese, candlestick). Numbers: `src/style/raid.ts`.

## Hooks added in shared files (all additive)
- `crowd.ts`: `Person.raider?`, `Barbarian` in the costume union; a raider is
  not turned out as a non-resident at a town change; raiders and anybody
  running from them (`flee:` errands) run; raiders jostle through each other.
- `people.system.ts`: the barbarian costume and gear (`costumeLook`, the extra
  mesh, `toolOf`). `extras.ts`, `hands.ts` (`SHAFTS`), `loads.ts` (loot).
- `town/board.ts`: `assign` ignores any chain but the raid for a raider.
  `town/hands.ts`: `canWork` is false for a raider. `town/index.ts`: the chain.
- `town/scenes.ts`: `Scene.urgent`; `app/scene-note.ts` shows an urgent note
  whatever the gap, over a lesser one.
- `mischief/director.ts`: `hold(key, on)` (holds the act open: one undo step,
  undo mid-raid ends it via 'reset'), `threats` (raiders ashore),
  `extraVessels` (Lightning can strike the raid's ships).
- Scenes call themselves off near `threats`: wedding, beach, snow day, supper,
  carols (one line each).
- UI: `pieces.ts` (`raid`), `icons.ts`, `mischief.ts` (use + guide entry),
  `menu.ts` + `interface.ts` (Raiders switch, `little-city.raiders`),
  `app/main.ts` (`__lc.raids`), `sequence.mjs`, `scene-cost.mjs`.

## For the Hand / thrown bodies
Raiders ashore are ordinary crowd people: thrown and carried with no special
case. A thrown raider's plan fails and the raid gives him the next one; one
not back 40 s after the horn is left behind and runs for the sea. Raiders at
sea (`Figure`) and the longship and boats (`Vessel`) are the raid's own
drawings, not harbour ships: to lift them the Hand needs a hook in
`Raid`/`Vessel` (a pose override, as `critterPose`), not done.

## Not done / watch
- Garrison marching out, raid scuffles, bold villagers with brooms; hens and
  sheep scattering; livestock jumping ship and swimming home; stalls visibly
  emptied; people peeking from windows; castle gates keeping them out.
- In a dense harbour row the band still bunches on a one-cell strip.
- The boats raid's stand-off point is often near the map's edge (it needs a
  big clear circle), so from the town view its ship is small.
- p95 frame time mid-raid ~52 ms in the grown harbour (median 2.5 ms): mostly
  the town rebuilding as fires change blocks.
