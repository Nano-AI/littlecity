# Dressing handoff (branches `swarm/dressing`, then `swarm/dressing-depth`)

Decoration (D) and urban-fill (U) rules and their props. Gate per commit: `tsc`, `eslint .`, `vitest run --project unit`.

## Done (rule in `src/rules/`, fixture in `scenarios/rules/<id>`)
All of part D and part U. Stage 4 added: U09 vista end, U10 corners (turret only), U11 civic hall
(role in `roles/`, front `urban/U11-F`), U12-E rustic edge (town-wide), D12 D14 D14-T D17 D18 D19
D21 D22 D23 D25 D26 D27 D28 D30 D31 D32 D33 D34; fixes: D05 (no line at head height over anything
walkable), J20-F (fence edge pieces with nothing flat under them are not drawn). Look pass: sheep,
street trees (lime / poplar / cherry), espaliers.
Parts: `src/parts/props/{landmarks,commons}.part.ts`; house parts `src/parts/openings/{vista,
corner-oriel,arcade}.part.ts`. Numbers: `src/style/depth.ts`. Vocab: `src/vocab/dressing-depth.vocab.ts`.

## Not done / next
- U10's chamfered corner entrance (needs the shell to cut a corner); only the corner turret exists.
- Weak looks still: bunting and door lanterns faint at night; wide open grass plain; the grand
  doorway is subtle under a cottage eave; a hall's wall flag hangs flat; statues are simple.
- Walls (`src/gen/wall`) on a pitched roof still float like fences did: J20-F marks only fences.

## How things fit
- `clearways(facts).free(cell, pos)` is the one test for "may a prop stand here". It knows only
  shape-stage claims: two decoration rules that may want one corner must claim it (D33 offers one
  candidate per corner plus a shared group slot, so a lamp that took a corner first is skipped).
- `landUse` decides what each leftover IS: front garden > field > courtyard (D17) > back yard >
  pocket park. Courtyards need 2+ cells across both ways and only buildings round them.
- House-changing urban rules run in the shape stage as part 'joinery' before J09 (910): U11-F 916,
  U09 915, U10 914. J09 skips windows behind a vista (clock, niche, oriel) and puts a tall window
  behind a balcony someone else made. The generator frames `vista`, `arcade` on the wall plane and
  `corner-oriel` at the cell's right-hand corner.
- `personalityOf(seed, colour, role, size, rustic)`: pass the 'rustic' tag (house.gen, parts lib).
- Prop frames: a prop at a slot with `face: f` has +X toward (f + 3) % 4. Wall-mount sockets with
  no owner sit on the cell line, half-way up; a house wall is 0.07 behind.
- Town-wide rules (D13-T, D14-T, D31, D33, D34, U12-E) are excluded in the stability test.

## Gotchas
- Two candidates of one rule with the same anchor need distinct keys (D27 mailboxes by door side).
- `L02.smoke` now claims its chimney socket: a chimney with a stork nest does not smoke.
- `scenarios/rules/R-H03` counts R-H99's sacks only (D25 adds more at the windmill).
- The bash sandbox refuses heredocs; write files with the Write tool, edit with python scripts.
