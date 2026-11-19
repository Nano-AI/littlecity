# Requests and notes from Animation (Stage 3)

Nothing here blocked the work. No frozen file was changed: `src/life/api.ts`
is as Stage 0 wrote it. Section 1 is the one file outside my paths that I
edited; the rest are seams and asks.

## 1. A file outside my paths that I changed

- `scenarios/houses/standins.ts`: the `X-L03.sails` stand-in is removed from
  `houseDressing` (the brief gave it to me to replace). The real rule is
  `src/rules/life/L03.sails.rule.ts`; with both, every mill had two wheels.
  `X-D07` and `X-D09` are untouched and still Dressing's to replace.

## 2. For Houses: the windmill cap cannot yaw (L03)

The cap is baked into the windmill's mesh by `src/gen/windmill/windmill.gen.ts`,
and the hub socket's frame comes from it. Life can move a whole structure or
an instance, not a part of a baked mesh, so the sails turn (faster face-on to
the wind than side-on) but the cap does not come round to the wind.

**Asked:** draw the cap, curb and windshaft as an actor part (say
`mill-cap`, at a socket on the tower's neck, owning `mill-hub`). Then a
behaviour can yaw it and the sails follow, with no other change.

## 3. For Look: which pane lights when (L07)

Windows are lit pane by pane by the surface shader, in an order hashed from
each pane's ink id, as the page glow rises. Life owns one number per house
(param `a` of the lifted structure), so what L07 does today is: houses come
on one after another over 20 s (seeded), shops and inns are not held back,
empty houses stay dark, most homes go dark at a seeded bedtime. Inside one
house the order of panes is still the shader's, and a shop pane cannot light
before the page glow reaches that pane's threshold.

**Asked (not urgent):** let param `c` of a slot shift the pane threshold
(`smoothstep(hsh * 0.75 - c, …)`), so a shop's panes can lead and a house's
panes can follow the house's own clock.

Also: a flying bird's cast shade on the sea reads as a long smear at some
angles (`LOOK.ground`, the cast term). Shortening the cast of things far
above the surface would fix it.

## 4. For Dressing: lamps and things fixed to buildings

- **Lamps need nothing from you but the type.** `src/life/dusk/lamps.system.ts`
  lights every prop of type `lamp` or `hanging-lantern` (add a type to
  `LAMP_TYPES` there, or tell me). It sets the instance's param `a`, which
  the page multiplies into `PATTERN.glow` surfaces: so the lamp's glass must
  be `PATTERN.glow`, and nothing else on the lamp should be.
- **Weathervanes and flags share a tip.** `L03.weathervanes` claims the
  `tower-top` socket and the `flag-mount` socket of the same cap, and runs in
  the life part, after decoration. If D13 claims a cap's `flag-mount`
  (`slot.socket(id)`), that cap gets the flag and no vane.
- **Props on a bouncing building** are carried by the feedback system if
  they are anchored to a socket owned by one of the structure's features.
  Props on a line between two sockets are not carried (they stay put for the
  280 ms).
- **Pop-in (F05)** orders new props by distance from the edit, 100 ms apart.

## 5. For People

- `setOccupied(stage, houseStructureId, boolean)` in `src/life/dusk/occupancy.ts`
  says who is home; default everyone. Windows fade over half a second.
- `lightLamp(stage, propId)` in `src/life/dusk/lamps.system.ts` lights one
  lamp ahead of its turn (the lamplighter, L08).
- `carryOf(stage, structureId)` in `src/life/feedback/carry.ts` is the matrix
  of a structure in mid-bounce, for anyone standing on it.
- Birds listen for `personPassed` (pigeons take off); emit it with the cell.
- `src/life/MOTION.md` is the motion style: poses on twos, travel smooth,
  one easing family in `src/life/motion/ease.ts`.

## 6. For the orchestrator: cost of moving things

Anything that moves makes the grounding picture redraw (Look's note), at
most every other frame: on those frames the whole town is drawn twice. With
smoke on every chimney that is every other frame, all day. See my report for
the numbers. If the phone budget is tight, the first knobs are
`WINDY.smokePuffs` and `LOOK.ground`.
