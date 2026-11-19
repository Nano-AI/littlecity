# Requests from steady ink

Steady ink (`docs/swarm/steady-ink.md`) found that most of the flicker while the camera moves came
from faces drawn in one plane on top of each other with different ink groups. The view now settles
which of two such faces is drawn (the coplanar tie-break), so they no longer trade pixels from frame
to frame. But it settles it by ink id, and one pair in 24 lands on the same level and still fights.
It also cannot know which of the two you meant to show. The fix that always works is in the geometry,
and it is cheap:

- **A detail on a face** (a panel, a tread, a kerb, a deck): lift it **0.004** off the face, as most
  parts already do. 0.001 to 0.002 is too little to be safe from a low camera.
- **A face that is hidden by another** (a wall top under a coping, ground under a deck): leave it out,
  or stop it short of the other.

One case was a one-line offset and is fixed: the top tread of the carved terrain steps
(`src/parts/ground/terrain-steps.part.ts`) was flush with the upper path it laps onto. It now sits
`FLOOR.pathLift + 0.004`. That removed the worst remaining flicker in the grown towns (close orbit of
`grown-town-1`: blinks 0.035 to 0.004 per mille). Crop, before: `docs/swarm/steady-ink/steps-seam.png`.

## The rest, by owner

`node src/render/testing/coplanar.mjs <scenario>` lists every such overlap among structures and layers,
by generator, with a place to look. On `everything` and `grown-town-1` (pairs of overlapping triangles,
their area in square units, and one place):

| Who / who | everything | grown-town-1 | Look at |
|---|---|---|---|
| dock / terrain layer | 15 pairs, 1.27 | 12, 0.95 | (7, 0.8, 33): a dock's footing flush with the ground |
| house / house | 66, 1.23 | 106, 0.60 | (33.0, 3.1, 32.0), (40.0, 2.3, 23.0): parts of one house flush with each other |
| arch / house | 14, 1.15 | 13, 1.14 | (13.0, 3.2, 24.0): an arch face flush with the house wall it meets |
| tower / tower | 2, 0.64 | 2, 0.64 | (38.1, 6.5, 27.0): a large face inside the belfry, flush with another; this is the arch that filled with scribble at 2x (`steady-ink/arch-scribble-2x.png`) |
| arch / terrain layer | 5, 0.26 | 3, 0.01 | (18, 0.8, 11) |
| terrain layer / stairs | 2, 0.23 | 2, 0.13 | (19.9, 1.6, 31.3): a stair's top flush with the terrace |
| wall / wall | 10, 0.18 | 10, 0.18 | (16.8, 2.0, 28.0) |
| house / terrain layer | 4, 0.13 | 18, 0.45 | (22.0, 0.8, 36.0), (13.0, 0.8, 6.0): a house's base flush with the ground |
| marble / marble | | 11, 0.17 | (24.0, 3.9, 11.0) |
| stairs / stairs | 1, 0.03 | 5, 0.14 | (26.9, 0.8, 23.0) |
| arch / arch, dock / dock, dock / house, house / marble, marble / stairs, terrain / marble | small | small | run the tool |

Owners: Houses (house, arch), Monuments (tower, marble, stairs), Ground (terrain layer, dock, wall).
Nothing here is urgent: since steady ink each of these draws steadily unless its two ink ids happen to
share a level, and the scan cannot tell which of them do. A quick check for one place: orbit the
camera close over it (`node src/render/testing/flicker.mjs --only <case>` scores a sweep and writes
crops of the worst regions).

Props and actors are not scanned (they are placed by slot matrices). The same rule holds for them.
