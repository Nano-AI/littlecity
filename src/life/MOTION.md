# How things move in Little City

One motion style for the whole game, so that smoke, sails, birds, boats and
the bounce of a landing block all look drawn by the same hand. Read this
before you animate anything (people included). The numbers live in
`src/style/animation.ts`; the helpers in `src/life/motion/`.

## 1. Poses on twos, travel on ones, answers at once

The game looks like a drawing, so it moves like drawn animation.

- **Poses are redrawn 12 times a second** ("on twos": `MOTION.poseFps`). A
  pose is the drawing of the thing itself: a wing beat, the angle of a sail
  wheel, the bob and heel of a boat, the size and place of a smoke puff, a
  pigeon's peck. Between drawings the pose is held.
- **Travel is smooth** (every frame). Travel is where a thing is along its
  way: a boat on its loop, a gull on its circle, a person on a street, the
  lighthouse beam's sweep. A thing that travels on twos looks like it is
  stuttering; a thing that poses on ones looks like plastic.
- **Answers to the player are smooth and immediate** (every frame): the
  landing bounce, the wobble, the pop-in. They start on the frame of the
  click and are posed at once, never a frame late.

`motion/twos.ts` has both tools: `onTwos(seconds, phase)` for a pose that is
a pure function of time, and `new Twos(phase).tick(dt)` for one that is
integrated. Always pass a `phase` from the item's seed (`ctx.rand('twos')`):
it spreads the drawings of a street of chimneys over different frames, which
reads as many hands and spreads the work.

## 2. One easing family

`motion/ease.ts`. Nothing eases any other way.

| Function | Shape | Use |
|---|---|---|
| `easeIn` | cubic, slow start | a fall, a take-off, something shrinking away |
| `easeOut` | cubic, gentle arrival | coming to rest, dust flying out |
| `easeInOut` | cubic both ends | a move from rest to rest |
| `pop` | 0 → 1 past 1 by about 10% and back (back ease, `MOTION.overshoot`) | anything that appears |
| `settle` | a swing that dies away, 0 at both ends | a wobble, a sign after a gust |
| `arc` | 0 → 1 → 0 | a hop |
| `glide(rate, dt)` | exponential follow, frame-rate independent | chasing a moving target (a vane to the wind) |

Squash and stretch keeps bulk: when a thing is drawn `tall` high it is drawn
`1 + (1 − tall) × 0.55` wide (`motion/pose.ts`, `squash`). A big thing moves
less than a small one: amplitudes fall with size (`FEEDBACK.landHeavy`).

## 3. Everything reads the same signals

No `Math.random`, no clock. Time is `signals.time.seconds` and the `dt`
handed to `update`; chance is `ctx.rand(...)` (seeded per item) or
`rand(ctx.seed, ...)` in a system. The same town at the same time moves the
same way.

The wind is one field (`signals.wind(x, z)`): baked cloth and trees sway in
the shader from it, and smoke, sails, vanes, boats and birds sample the same
field, so a gust is seen crossing the town. Sample it where the thing is.

Day and night: `signals.time` and, for anything that glows, `glowOf(time)`
in `dusk/glow.ts` (the page's own measure of how lit lamps are).

## 4. How to add a moving thing

- A rule in `src/rules/life/` emits an actor; a part in `src/parts/actors/`
  draws it; a behaviour (`*.behaviour.ts`) or system (`*.system.ts`) in
  `src/life/` moves it. Discovery finds all three.
- State follows the socket: an actor anchored to a socket keeps its state
  across re-resolves for as long as the socket id survives (`runtime.ts`).
- Extra instances (wings, puffs, a sail) come from `ctx.stage.spawn`; release
  them in `dispose`. Short-lived ones go through `fxOf(stage).play(...)`
  (`fx/fx.ts`), which pools them.
- Anything fixed to a building multiplies its matrix by
  `carryOf(ctx.stage, structureId)` when that is not null
  (`feedback/carry.ts`), so it moves with the building's landing bounce.
- Matrices: `motion/pose.ts` (`place`, `fly`, `squash`). A thing built
  facing +Z heads along `(sin yaw, cos yaw)`.

- **Things in the air** (birds, insects, leaves, sparkles) draw with the
  AIRBORNE pattern bit, and smoke and clouds with MIST (`src/gen/airborne.ts`):
  no smear of shade on the ground, and moving them never makes the renderer
  redraw its grounding picture. Anything else that moves on the ground costs
  a redraw: set its matrix only when its drawing actually changed.

## 5. Looking at motion

One screenshot shows nothing. `src/life/testing/sequence.mjs` runs the real
app with its clock taken over and lays N frames out as one contact sheet:

```sh
node src/life/testing/sequence.mjs fx-feedback --edit 'place:house@24,1,22' --frames 12 --every 33 --name land --zoom 11 --target 24.5,1,23
node src/life/testing/sequence.mjs fx-feedback --edit 'erase@22,3,26' --frames 8 --every 50 --name erase
```

Tests step the simulation with fixed time steps against a recording stage
(`src/life/testing/stage.ts`); `feedback/feedback.test.ts` is the worked
example.
