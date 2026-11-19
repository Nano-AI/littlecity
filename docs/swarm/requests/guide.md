# Requests and notes from the guide

The guide (design section 7) lists 44 special buildings and the Auto block.
Every entry's recipe, built with the scenario builder, makes its building
under the real rules (`src/guide/guide.test.ts`); no rule was changed.

## 1. The garrison has no entry yet (for Animation / Life)

The design lists "a garrison" in the Town group. L36 (garrison) and L37
(rider) are in the catalogue but no rule emits them yet, so there is nothing
a test could prove. When L36 lands, add one entry to `src/guide/entries.ts`:

```ts
{ id: 'garrison', group: 'town', name: 'Garrison', how: '…', proof: { prop: … } }
```

`Proof` will need an `{ actor: { rule, type? } }` case (a few lines in
`src/guide/proof.ts`, reading `dressing.actors`), then `npm run guide garrison`.

## 2. Where the code says more than the catalogue

Each sentence follows the code. Worth knowing when editing the catalogue:

- **Boathouse (R-H05)**: "or touches a dock" needs a dock beside the house at
  the same level. Docks are only ever at level 0 and a house on land is at
  level 1 or more, and a house on a dock is a stilt house first, so I found
  no arrangement a player can build where the dock is the reason. The
  sentence says only "a wall looking straight out onto the water".
- **Plinth (R-M06)**: the code wants a plaza *beside* the block (catalogue:
  "on a plaza"). For a player it is the same thing: a marble block placed on
  a plaza replaces that one square.
- **Laundry lines (D05)**: one window on either side is enough (catalogue:
  both), the line must hang a full storey above the ground (no ground-level
  lines between cottages), and each facing pair is a 0.6 chance. The sentence
  says "most such gaps get a washing line"; the recipe's seed is one where it
  does.
- **Viaduct (R-A06)**: any arch that is nothing else, even a single one on
  grass (catalogue: 2+ tiers or a run of 3+).
- **Pocket park (U01)**: 2 to 16 cells (DRESSING.parkMax; catalogue says 12).
- **Observatory (R-T04)**: the hill must stand above the island's lowest land,
  and "no water within 4" means more than four squares from water.
- **Sky bridge (R-A02)**: both houses must rise at least a storey above the
  span, and nothing may stand on it; between two roofs it stays a stone bridge.
- **Keep (R-M03)**: six cells or more, and not mostly a stair (then it is
  grand steps).
- **Castle turret (R-T02), gatehouse (R-M02)**: "wall" counts wall pieces in
  a square and wall pieces along an edge.
- **Shop, inn (R-H07, R-H06)**: "faces a street within 1" means the path or
  plaza is right outside the ground-storey wall, on the same level.

## 3. Outside my paths

- `src/app/main.ts`: one line, `ui?.dressed(ready.dressing)` when the
  dressing arrives, so the ticks of the dressing entries (lamps, laundry,
  pocket park, paddock, walled garden) can follow the town.
- `src/guide` is not in eslint's layer list (eslint.config.js is frozen), so
  no layer rule checks it; it imports only core, vocab, resolve and scenario.
