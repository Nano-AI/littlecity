# Mischief handoff (branch `swarm/mischief`, experimental, not merged)

Design section 13b. Phase A (the kit) and the owner's first round of notes are in: rooted fire, fused smoke, solid chunks, mending in many stages done by the town, people answering fires and bombs. The raid is not started.

## Try it
- `npm run dev`, `/?seed=4242&mischief`: a grown town, the Mischief drawer open (Torch, Bomb, Mallet, Mend). Undo calls off anything going on. Menu: Rebuild on/off.
- Galleries: `npm run shots -- mischief-ruins-houses` / `mischief-ruins-kinds` (every kind × every state, mending phases); `mischief-street` for sequences.
- Sequences: `node src/life/testing/sequence.mjs mischief-street --edit 'fire@18,1,21' --warm 3000 --frames 4 --every 5500 --zoom 10 --target 19,1,22.5 --yaw 20 --pitch 38` (the brigade); `--edit 'knock@26,1,18; knock@26,1,18; knock@26,1,18' --every 9000` (rubble, then the town rebuilds); `bomb@19,1,23` (people scatter). Verbs: fire, bomb, knock, mend, mendall, undo.

## How it is built
- Saved: `Block.ruin` (`src/world/damage.ts`): stage 0–3, cause, mending, 32 mending steps (progress), settling (never saved). Edits `setRuin`, `repair`. Share codec v4 section bit 1 (beside the land's bit 0).
- Drawn: `src/gen/damage/` cuts each generator's own mesh per column by a seeded tile field; ruins, debris (whole wall slabs and roof halves with depth, `debris.ts`), mending phases (`field.ts` `mendPhases`), scaffolding (`scaffold.ts`).
- Engine `src/life/mischief/engine.ts` (fire, blast, knock, repair, douse; pure, seeded); `director.ts` (acts = undo steps, camera yaw for flames, Rebuild switch, `autoMend` via `Game.amend`).
- Live drawing: `mischief.system.ts` (flames rooted on sampled tops and openings, facing the reader; fused smoke and dust; sparks; firelight; embers; bomb; flash; chunk flights; fallen mill sails), `brigade.system.ts` (pump cart, hoses, helmets, jets, bucket, steam), `sound.system.ts`.
- People: `response.ts`: two chains in the living town (`src/life/town/index.ts` lists them first): fire (clear out, glum residents, onlookers, ≤2 brigades from the nearest water, everyone home after; bombs: duck, run, creep back) and rebuild (after 8 s quiet, a crew of three from their homes with ladder, hod, cart mends one building at a time, a step every ~3.5 s).

## Not done / watch
- Raid. Garrison does not help at fires. Dogs do not bark at fires. Residents of a burnt-out house stand glum, then wander (no lodging).
- Pigeons kept off by repeated frights still wheel through the smoke; they no longer perch, but the bird code was not changed.
- Floors and edge pieces cannot be damaged (no scorched gardens).
- Bomb: people near the bomb are a little slow to run.
