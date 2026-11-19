# Requests from Grow a town

## L10.fireflies threw on a world with a negative seed (owner: Animation): moot, fireflies were removed (2026-11-19)

`src/rules/life/L10.fireflies.rule.ts`, `find`: the start offset is
`seed % g.cells.length`. In JavaScript that is negative for a negative seed,
so the index can be negative, `g.cells[...]` is `undefined`, and `apply`
throws (`[rule L10.fireflies apply() at cell undefined] Cannot read
properties of undefined (reading 'length')`), which takes the whole dressing
stage down.

Negative seeds are ordinary: the app's `newSeed()` (`src/app/main.ts`) is
`hash(...) | 0`, so about half of all new islands have one. Grow a town's dice
button (a new island, then a grown town with gardens) hit it in the browser
test `tests/e2e/grow-town.e2e.test.ts` on a random island.

Smallest reproduction (flat terrain, seed −7, a garden of three cells):

```ts
const h = new Uint8Array(48 * 48);
for (let z = 4; z < 44; z++) for (let x = 4; x < 44; x++) h[x + z * 48] = 1;
const t = terrainFromHeights(-7, h);
let w = emptyWorld(-7);
for (const x of [10, 11, 12]) w = applyEdit(w, t, { type: 'placeFloor', cell: key(x, 1, 10), floor: 'garden' });
resolveTown(w, t); // throws
```

Suggested fix: `((seed % n) + n) % n` (or `hash(seed, …) % n`). Other rules
that take `seed % n` may want the same check.

Until it is fixed, the Grow a town browser test grows its dice town on a
fixed positive seed rather than a random one, so it does not fail on this.
