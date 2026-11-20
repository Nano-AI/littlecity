# Mischief: the contract changes (2026-11-19)

Design section 13b. Experimental, on `swarm/mischief` only (not merged).

## 1. `src/core/world.ts` (frozen): one optional field, two edits

- `Block.ruin?: number`: a packed damage byte, read and written only through
  `src/world/damage.ts` (stage 1–3, cause fire/blast, mending, settling).
  Absent = sound: every block that existed before is the same object shape.
- `Edit` gains `{ type: 'setRuin'; cell; ruin }` and `{ type: 'repair'; cell }`.
  `canApply`: only on a block that is there; never terrain. `applyEdit` keeps
  everything else of the block (kind, colour, style, seq), so a repair
  restores exactly what was built.

## 2. Everything else outside my own files (small, additive)

- `src/world/world.ts`: the two edits. `src/world/history.ts`: `replacePresent`.
- `src/world/save.ts`: ruins are version 4's optional section bit 1 (beside the land's bit 0): count, then per damaged block its index in the block list (delta varint) and its damage (varint; settling never saved). A town with no ruins (and no land) encodes byte for byte as before. `src/world/land-save.test.ts`'s "unknown section" case now uses bit 2.
- `src/resolve/engine/hash.ts`, `src/resolve/staged.ts` (`sameWorld`),
  `src/resolve/facts/content-keys.fact.ts`: a block's damage is part of the
  structure hash and the content keys, as `style` is.
- `src/resolve/index.ts`: `resolveDressing` passes its plan through
  `withoutRuinedDressing` (`src/resolve/ruins.ts`): a half-destroyed,
  destroyed or scaffolded building houses nobody and carries no dressing.
- `src/gen/discover.ts`: the generator registry is wrapped by `withDamage`
  (`src/gen/damage/damage.ts`), so every structure is drawn with its damage;
  `.intact` is the unwrapped registry (the blast animation needs it).
- `src/app/game.ts`: `batching`, `abort()`, `amend()`. `src/app/main.ts`:
  connects the mischief director, flushes it once a frame, `__lc.mischief`.
- `src/ui/pieces.ts` (drawer and four tools), `src/ui/icons.ts` (four icons),
  `src/ui/interface.ts` (tool clicks, undo cancels an act, `?mischief`),
  `src/ui/guide.ts` (appends the Mischief section).
- `src/life/testing/sequence.mjs`: verbs fire, bomb, knock, mend, mendall, undo.
- `src/life/town/index.ts`: `allChains()` lists the two mischief chains first (`src/life/mischief/response.ts`).
- `src/ui/menu.ts`: an optional Rebuild switch (shown when the app wires it).

## 3. Asked of others

- Weather (seasons agent): the mischief system reads `signals.rain?.()` (0–1)
  if it exists; rain then puts fires out (`FIRE.rain`).
