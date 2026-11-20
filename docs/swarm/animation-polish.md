# Animation polish (2026-11-19, branch `swarm/animation-polish`)

The standard: nothing passes through anything, pops in or out, slides, snaps or
hovers. This file lists the flaws found by watching sequences
(`src/life/testing/sequence.mjs`) and by reading the code, in the order they
were fixed, and what is still open.

## How to look

```sh
# somebody about to go through a door (n skips the first n doors found)
node src/life/testing/sequence.mjs everything --door --zoom 14 --size 200x150 --scale 3 --frames 12 --every 250 --cols 6
# every door swinging open after the first frame
node src/life/testing/sequence.mjs everything --open all --zoom 14 --target 27.5,1.8,29.2 --yaw 10
# somebody coming ashore or walking off into the sea (place a house to get newcomers)
node src/life/testing/sequence.mjs people-town --edit 'place:house@30,1,22' --shore --delay 2700 --zoom 14
# follow anything: an expression in the page giving [x, y, z]
node src/life/testing/sequence.mjs L36.garrison --aim '(s => [s.x, s.y, s.z])(window.__lcGarrison.list[0].troop.soldiers[2])' --follow
node src/life/testing/sequence.mjs everything --warm 30000 --zoom 14 --yaw 100 --aim '(r => [r.x, r.y, r.z])(window.__lcGarrison.list[0].ride)' --follow --every 125
# the frames after a gust front sets off across the map
node src/life/testing/sequence.mjs dressing-town --gust --zoom 3 --frames 12 --every 333
```

## Fixed, in order

1. **People walked through closed doors.** Every door leaf is now a `door-leaf`
   actor (L29, "doors open as people pass through") swung by the crowd's door
   table; the doorway behind it is dark. See "How doors work" in
   `docs/swarm/handoff/animation.md`. Tests: `src/life/people/doors.test.ts`
   (nobody within 0.06 of a leaf at any angle, open or shut, over 150 s of the
   people town and 90 s of the everything town; a door nobody is near is shut;
   a door somebody is stepping through is fully open),
   `src/parts/actors/doors/door-leaf.test.ts` (the moving leaf stands exactly
   where the still door drew it, every look and stoop).
2. **Roof hatches were not drawn**: people rose out of a bare roof. The hatch
   the walking graph derives now has a frame and a lid, which flops over
   onto the terrace as somebody comes up or goes down.
3. **Newcomers faded in, leavers faded out** (shrinking where they stood).
   Now a newcomer climbs up out of the water at the dock's end or wades out of
   the shallows, then walks home; somebody whose home is gone walks off the
   dock's end or down the beach into the sea (way-outs over water are
   preferred to street dead ends). Only with no water or map edge at all do
   people still fade. Tests: `crowd.test.ts`, "the town changes (L27)".
4. **Workers held nothing.** The shopkeeper sweeps with a broom, anyone
   fishing holds a rod and line, a gardener tends with a watering can, the
   miller carries a sack, the baker a tray of loaves, the lamplighter a pole
   (raised to the lamp when he lights it). `toolOf` in `people.system.ts`.
5. **The shopkeeper swept where the shop door swings** (now open all day):
   moved to the window side.
6. **Walkers going wide round clutter hugged the wall** in front of doors,
   where a leaf swings: they now go wide on the side away from a door.
7. **Swaying things shivered as a gust arrived** instead of leaning into it:
   the sway's rate followed the wind's strength, and with a large clock that
   spun its phase. The rate is fixed now (`src/render/shaders/surface.ts`, one
   line). The gust front is slower (6 columns a second, was 9) with a sharper
   leading edge and a shorter tail (`src/style/wind.ts`), so the front has
   time to be seen crossing.
8. (Added by request) **Castle life**: L36 garrison and L37 rider, see the
   handoff.

## Second pass (watching the rest)

Sequences: `seed:3 --grow` (Grow a town at 25 pieces a second, close on its
square), `fx-feedback` with eight houses and a block on a roof placed at
once, `people-town` row landing, `everything` lamplighter at dusk
(followed), a sitter on a garden bench, `L18.fishing-boat` at dawn,
`L36.garrison` marching from several quarters, the rider trotting close up,
`L05.leaves --gust`.

### Watched and fixed
- **Grow a town turned to noise.** A merged building took a new cell every
  few frames and jumped back to the top of its drop each time; every landing
  threw a full dust ring. Now a landing already under way carries on (a
  wobble or another landing joins it), and landings within a quarter second
  of the last throw a smaller puff and no ring. Test: feedback.test.ts, "a
  run of cells landing on one mass every 40 ms".
- **A whole terrace jumped when one cell was added.** A 19-cell mass dropped
  0.14 (45% of a block's drop, the old floor); it now drops 0.07, a hand's
  breadth. Test updated to say so.
- **Door glass lit with the clock, not with who is home.** The window
  behaviour publishes each house's light level; door leaves give it to their
  glass. Test: src/life/doors/door-leaf.test.ts.
- **Pigeons touched down where they were aiming, not where they were** (a
  last-frame jump of the trailing body). Test: birds.test.ts, "a pigeon comes
  down without a jump". The take-off is a burst on purpose and left as is.
- **The fishing boat crabbed sideways off the dock**: it gathered way along a
  leg while its bow was still swinging round. Its pace now follows how well
  it faces the leg, and it leans a little into turns. Test: fishing.test.ts,
  "it goes bow first".
- **The troop read as a clump** marching toward or away from the camera: the
  right-hand file now marches GARRISON.stagger (0.16) behind the left, so the
  two files separate from every quarter (watched: it reads as two files).
- **The rider's legs were inside the horse**: they are turned out about the
  hips and come down the flanks. Test: garrison.test.ts.
- **Gust texture**: the wind texture is 32 × 32 (two columns a texel), so the
  front's 2-column leading edge is no longer blurred away.

- **A keep on its own had no garrison** (no door or passage made a gate).
  Now a castle with no gate halts its troop at the foot of the side facing
  the nearest street, or else the most open side; the troop marches round
  the keep. A lone keep keeps its L23 guard on top too; a walled castle's
  keep does not. Tests: troop.test.ts, "a keep on its own"; L37 fixture.
- **The rider was drawn only where there was a plaza.** Every garrisoned
  castle now keeps a rider (L37). With a street from the gate and a square
  it can reach, it rides to the square and back; with a street and no
  square, along the street to its far end or the first crossing four or more
  cells on, and back; with no street, the horse stands tethered by the gate.
  Tests: rider.test.ts, "a rider for every castle"; the L37 fixture has all
  three. Guide entries `garrison` and `rider` say so, with recipes for each
  case, and their pictures are re-rendered.

- **Night was eerie: every window stayed lit.** Two causes. Homes went to
  bed at a random 30–85% of the night, and the sun button's "night" holds
  the cycle at its middle, so a held night froze with most homes still up;
  and owls were a chance each, so a small town drew too few or too many.
  Now (L07 "Windows through the night") homes go to bed through the first
  half of the night, downstairs first then upstairs (a new param d on the
  lifted house: panes below that height stay dark; one line in the glass
  shader, which also stops leaving one pane in seven dark for good), until
  only the owls are lit: one home in six, a fixed share by seed. Inns stay
  lit; shops go dark when they shut; the bakery lights before dawn, then
  early risers. Owls go dark for a spell now and then and a sleeper is up for
  one, in spells of life time, so a held night still changes a little.
  Watched: a whole evening into the night at playing zoom (the town goes
  dark house by house to a few lit windows), and a held night close up.
- **Silhouettes**: 4 slots, each playing one act every 8 s at a lit window
  chosen by seed: a dark head and shoulders crosses the pane, pauses in it,
  or a curtain is drawn half across and back. Only on a lit, awake storey
  (the system asks the same pure function the window behaviour does, so
  there is no frame's lag), never over the frame. Watched close up (zoom
  14, turned to face the window) and at zoom 6, where it reads as somebody
  at the window; at the widest zoom it is a pixel or two. Tests:
  silhouette.test.ts (only in lit windows, held and running night,
  deterministic, never spilling over the pane), dusk.test.ts (homes fall to
  about one in six; inns stay lit; a held night changes).
- **Fireflies removed** at the owner's request: rule, part, behaviour,
  vocabulary, fixture, tests, and the shader's point-of-light branch that
  only they used. Do not add them back.

### Watched and fine
- Eight separate houses landing in one go, and a block landing on a roof
  (the building under it bounces as one; its props are carried).
- A single house landing beside a row; the neighbour's wobble.
- The lamplighter at dusk walks his round with his pole; lamps on his round
  wait for him, the rest light street by street a few seconds apart (by
  design, lamps.system.ts).
- A resident sitting on a garden bench sits on it, facing out.
- Shop doors standing open by day, with dark doorways; house doors opening
  for people going in.
- Moored rowboats and their lines at the L18 quay at dawn.

### Checked in the code and its tests, not re-watched
- Smoke: puffs fade in at the pot and out at the end, and join or leave the
  plume only at the pot (wind.test.ts).
- Sails turn faster in more wind and face-on; the cap comes round slowly to
  the wind (wind.test.ts, mechanisms.test.ts).
- Clock hands: continuous through every part of the day (gameHour meets
  itself at each boundary); they only jump when the player jumps the time.
- Lighthouse beam: comes up over DUSKY.beamFade seconds at night, down at
  dawn.
- Flags, laundry, bunting: swayed in the shader, phased by place and per
  item, so neighbours are not in step.
- Sailboats heel to the wind already; rowboats tug their lines (taut).

## People are solid (the owner's request)

Walkers step round each other, give way, overtake on the outside, and
never step closer than a body and a hand's breadth to anyone ahead;
standing spots are spread; nobody comes out of a door onto an occupied
doorstep. Counted by `src/life/people/overlap.ts` (an overlap: centres
closer than 0.15 on one floor, both in the open; sustained: longer than a
quarter of a second). Seven and a half minutes of day and evening:

| Town | before | after |
|---|---|---|
| people-town (43 people) | 121 | ~20 |
| everything (59) | 162 | ~80 |
| a dense square (47 in it at once, 3 min) | 131 | ~27 |

Head on in a one-cell corridor, a two-cell street, an open square with
four walkers crossing, overtaking, and walking round somebody standing:
none. **Still wrong**: knots at single-file stretches in busy places (the
everything town's arch passage under the bridge beside the carved steps;
a mill-yard gate): somebody waits, thinks again once, and if still held up
squeezes past, which shows as two people overlapping for a moment. Watched:
a crowd by the mill house and a meeting on the street in the everything
town at zoom 12.

## Found and still open

- **Gust front by eye.** Even with the fixes (no shiver, slower and sharper
  front, finer texture) I cannot see the front cross in still contact sheets:
  a tree's sway is a pixel or two at any zoom the camera allows, and smoke is
  the only thing that visibly leans. It is one field numerically
  (signals.test.ts). Left as it is; it would take a much stronger sway, which
  would be busier than the style wants.
- **The everything town's castle** has no walkable loop round its walls: the
  cottage on the north-west point closes one corner, and the south side
  changes level with no steps. A wider search (5 cells out) found no loop
  either, so its troop still marches there and back along the longest side.
  The L36 fixture has a loop.
- **The bell** is small in its belfry; not changed.
- **Not watched**: pigeons scattering for walkers (tested in birds.test.ts),
  perching gulls and the smaller characters, sailboats near piers, the
  rower's route, the sky bridge (people on it stay hidden, by design).
- **Small creatures** (cats, sparrows, bees, leaves): left as they are, as
  rewards for zooming in. Making them read at the default zoom would mean
  more contrast or bigger, busier motion; fewer, calmer motions won.
