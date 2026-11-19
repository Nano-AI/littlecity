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

## Found and still open

- **Gust front by eye.** With the fixes above it is a cleaner lean that
  sweeps across, but in contact sheets at playing zoom a tree's sway is a few
  pixels; I could not prove by eye that one front reads across trees,
  laundry, flags, smoke and sails together. It is one field numerically
  (`signals.test.ts`). Next step if wanted: a 32 × 32 wind texture (it is 16
  × 16, 4 columns a texel, which blurs a 2-column leading edge) in
  `src/render/index.ts`.
- **Glass in a door leaf** lights with the time of day, not with whether
  anyone is home (the leaf is an actor; its glow param is the default).
- **The rider's legs** are hidden in the horse's barrel (people's legs only
  swing fore and aft; there is no straddle).
- **The troop reads as a clump** when it marches straight toward or away
  from the camera at playing zoom; side-on it reads as a column of twos.
- **The everything town's castle** has no walkable loop round its walls (the
  cottage on the north-west point and its trees close it), so its troop
  marches there and back along the longest side. The L36 fixture has a loop.
- **Not looked at closely in this pass** (no time left after doors,
  thresholds and the castle): sitting poses against benches, bird landings
  and perches, pigeons and walkers, boat banking and piers, mooring lines,
  smoke birth and death, the lighthouse beam's start, sails and cap against
  wind, flags and laundry in phase, clock hands, lamps lighting together,
  windows against people arriving home, the landing bounce on merged rows,
  neighbour wobble, pop-in of decorations, people on the covered sky bridge
  (still hidden, by design). These are the next watching pass, in that
  order of how often they are on screen.
- **Small creatures** (cats, sparrows, bees, leaves): left as they are, as
  rewards for zooming in. Making them read at the default zoom would mean
  more contrast or bigger, busier motion; fewer, calmer motions won.
