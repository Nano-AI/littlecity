// L12 Pigeons: per plaza region, flock = clamp(cells ÷ 3, 0, 12).
//
//   the square   6 × 4 = 24 cells, a fountain in it   → 8 pigeons
//   the court    3 × 3 = 9 cells                      → 3 pigeons
//   the step     2 cells                              → none
//   the parade   8 × 5 = 40 cells                     → 12 (the cap)
//
// Each flock keeps to the free cells round one spot of its plaza. Beside
// the square a birdbath stands on a garden: its rim is a perch, and one of
// the square's pigeons has it.
//
//   node src/life/testing/sequence.mjs L12.pigeons --edit 'place:house@19,1,21' --frames 12 --every 500 --name scatter --zoom 6 --target 22,1,22

import { keyX, keyY, keyZ } from '@/core/grid';
import { scenario } from '@/scenario';

export default scenario({
  name: 'L12.pigeons',
  seed: 1203,
  about: 'Four plazas of 24, 9, 2 and 40 cells: flocks of 8, 3, 0 and 12 pigeons; a birdbath to perch on.',
  build(b) {
    b.plaza(20, 20, 25, 23); // the square
    b.put('fountain', 23, 22);
    b.garden(26, 21);
    b.put('fountain', 26, 21); // a birdbath, beside the square
    b.plaza(30, 20, 32, 22); // the court
    b.plaza(35, 21, 36, 21); // the step
    b.plaza(20, 27, 27, 31); // the parade
    b.house(21, 18, { floors: 2, w: 2, color: 1 });
    b.house(24, 18, { floors: 1, color: 5 });
    b.house(31, 18, { floors: 2, color: 3 });
  },
  cameras: [
    { name: 'square', yaw: 45, pitch: 34, zoom: 6, target: [23, 1, 22] },
    { name: 'all', yaw: 45, pitch: 36, zoom: 2.8, target: [27, 1, 25] },
    { name: 'square-back', yaw: 215, pitch: 40, zoom: 6, target: [23, 1, 22] },
    { name: 'dusk', yaw: 45, pitch: 34, zoom: 6, target: [23, 1, 22], time: 'dusk' },
  ],
  expect(plan, _dressing, check) {
    const flockOf = (x: number, z: number): ReturnType<typeof check.actors> => {
      const plaza = check.floorStructure(x, 1, z);
      return check.actors({ type: 'pigeon', rule: 'L12.pigeons' }).filter((p) => (p.params as { plaza: number }).plaza === plaza.id);
    };
    check.equal(flockOf(20, 20).length, 8, 'the square: 24 cells ÷ 3');
    check.equal(flockOf(30, 20).length, 3, 'the court: 9 cells ÷ 3');
    check.equal(flockOf(35, 21).length, 0, 'the step: 2 cells ÷ 3');
    check.equal(flockOf(20, 27).length, 12, 'the parade: 40 cells ÷ 3, capped at 12');
    check.equal(check.actors({ type: 'pigeon' }).length, 23, 'pigeons in town');
    const places = new Set<string>();
    for (const p of check.actors({ type: 'pigeon' })) {
      const at = p.at as { cell: number; pos: string };
      const where = `(${keyX(at.cell)}, ${keyY(at.cell)}, ${keyZ(at.cell)})`;
      check.ok(plan.world.floors.get(at.cell) === 'plaza', `a pigeon stands on plaza, at ${where}`);
      check.ok(!plan.kinds.has(at.cell), `never in a cell with something standing in it, at ${where}`);
      check.ok(!places.has(`${at.cell}:${at.pos}`), `one pigeon to a slot, at ${where}`);
      places.add(`${at.cell}:${at.pos}`);
    }
    check.noActor({ type: 'pigeon', at: [23, 1, 22] }); // the fountain's cell
    // A flock keeps together: every pigeon of the square within 3 cells of its spot.
    for (const p of flockOf(20, 20)) {
      const { spot } = p.params as { spot: number };
      const at = (p.at as { cell: number }).cell;
      check.ok(Math.abs(keyX(at) - keyX(spot)) <= 3 && Math.abs(keyZ(at) - keyZ(spot)) <= 3, 'the square\'s flock feeds round one spot');
    }
    // The birdbath's rim goes to one pigeon of the square.
    const perched = flockOf(20, 20).filter((p) => (p.params as { perch: string }).perch);
    check.equal(perched.length, 1, 'one pigeon has the birdbath');
    check.ok(plan.sockets.some((s) => s.id === (perched[0]!.params as { perch: string }).perch && s.type === 'perch' && keyX(s.cell) === 26), 'its perch is the birdbath at (26, 21)');
  },
});
