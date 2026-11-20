# Mischief handoff (branch `swarm/mischief`, experimental, not merged)

Design section 13b. Phase A (the destruction kit) is done; Phase B (bell, bucket chains, fleeing, crews that rebuild on their own, the raid) is not started.

## Try it
- `npm run dev`, open `/?seed=4242&mischief`: a grown town, the Mischief drawer open, the torch in hand. Torch, Bomb, Mallet, Mend (Shift: mend at once). Undo calls off anything going on.
- Galleries: `npm run shots -- mischief-ruins-houses`, `mischief-ruins-kinds` (every kind × sound, scorched, half-burnt, burnt out, cracked, half-wrecked, rubble, mending 3→0; long inns damaged at one end), `mischief-street`.
- Sequences: `node src/life/testing/sequence.mjs mischief-street --edit 'fire@12,1,18' --frames 8 --every 4000 --zoom 5 --target 15,1,19 --yaw 30 --pitch 32` (add `--time night`); bomb: `--edit 'bomb@16,1,19' --frames 8 --every 900 --zoom 6 --target 16,1,19 --yaw 20 --pitch 45`. Verbs: fire, bomb, knock, mend, mendall, undo.

## How it is built
- Saved: `Block.ruin` (packed byte, `src/world/damage.ts`): stage 0–3, cause fire/blast, mending, settling (never saved). Edits `setRuin`, `repair`. Codec v4 only when a block is damaged.
- Drawn: `src/gen/damage/`: every generator's own mesh is cut per column by a seeded field of tilted tiles (`field.ts`, `damage.ts`): jagged shells, inside faces, wall-top caps, partitions where a broken column meets a sound one, soot over openings, cracks, rafters, fallen beams, ash, scorch, scaffolding and materials (`scaffold.ts`). Blast debris is the building's own geometry diced into chunks with seeded resting places (`debris.ts`): baked as the heap, flown by the animation (same function, `blastChunks`). Trees and pillars topple.
- Plan: damaged blocks keep kind, structure and role (so a burnt chapel still looks like a chapel); stage ≥ 2 or scaffolding: no residents, no dressing (`src/resolve/ruins.ts`).
- Engine: `src/life/mischief/engine.ts`: fixed-step seeded fire (catch by kind and house style, climb, spread by distance and wind, walls and stone stop it, douse, rain hook `signals.rain?.()`), blast (rubble/wreck/shake radii, collapse upward, chain ignition, water = spout + douse), knock, repair. Emits ordinary edits.
- `director.ts` (`mischiefOf(stage)`): acts. One click opens a game batch; it closes when quiet; undo mid-act aborts it. `mischief.system.ts` draws: flames on twos, smoke (inked puffs that turn to fading mist), sparks, firelight wash at night, embers, bomb, flash, dust, chunk flights, shakes, spout, birds scatter.
- UI: `src/ui/mischief.ts` (tools, red dashed drawer, first-use hints, DOM "BOOM!"), guide section.

## Numbers
30 buildings alight (67 blocks): 60 fps in the app (same as quiet). `npm run bench` browser: 60 fps, 14 draw calls, resolveShape 8.7 ms, resolveDressing 13.9 ms.

## Not done / watch
- Phase B entirely. No sound for fire or bang yet. No phone-specific caps (puffs ≤ 160, sparks ≤ 140 everywhere).
- Floors and edge fences/walls cannot be damaged (only blocks carry `ruin`); gardens do not scorch.
- Windmill sails vanish when the mill is half-destroyed (the sail actor is dressing); they should fall.
- Firelight wash has a visible round edge at night.
