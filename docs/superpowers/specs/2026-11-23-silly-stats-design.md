# Silly Stats — Design

Approved 2026-11-23. A small change; short design.

## Intent

A strip of town stats along the top of the screen, there for fun, not for winning. City builders show population and happiness; Little City should too, in its own voice, with a happiness face the player can wreck with the Mischief tab and watch recover ("a living dummy" the player can be mean to). Nothing here is a goal or a score.

## Goals

- Always visible, top centre, out of the way of the menu (top left) and the time/season/weather/undo buttons (top right).
- **Population**: residents of the town now (the live crowd, not raiders or visitors).
- **Happiness**: 0–100, starts about 70, shown as a face drawn in the game's ink style (not emoji), with the number on hover/tap.
  - Up: the town's good days, the scenes it already plays (wedding, market day, picnic, carols, beach day, festival, supper and the like).
  - Down: Mischief and its after-effects (fires, raids, nukes or bombs, ruined buildings, scuffles).
  - Drifts back towards its resting level over a minute or two: the town forgives.
- **One rotating silly stat**, counted from what the simulation already does: e.g. "Loaves baked: 37", "Times nuked: 3", "Scuffles: 2", "Buildings on fire: 4". Rotates every few seconds; only shows stats that are above zero.

## Non-goals and anti-goals

- No money, net worth, prices or economy (the design spec's "Pure toy: no money, no goals").
- No score, no fail state, no nagging. A happiness of 0 is a joke, not a loss.
- Not saved: counts and happiness are for this session (a later addition if wanted).
- Must not cost frames: stats update a few times a second at most, from signals or cheap counts, never a whole-town scan per frame.

## Constraints

- Plain DOM via the repo's `el()` helper (src/ui/dom.ts) and its CSS; no framework, no new dependency.
- Works on phones (narrow strip, fewer chips) and desktop; hidden in fly mode and screenshots/scenario captures like the rest of the HUD.
- Copy in the game's voice: short, plain, a little dry.

## Approaches

- **A. Top strip of live chips (chosen):** always visible, matches "silly metrics on the top".
- B. A stats panel behind a button like the guide: tidier but hidden; loses the instant reaction to mischief.
- C. Stats drawn in the 3D scene: heavy, fights the hand-drawn look, costs frames.

## Left to the builder

Exact happiness weights and recovery rate (tune by playing: a nuke should crater it, a wedding should visibly lift it), which events map to which signals, the face's few expressions, the silly-stat list and wording, and the phone layout.
