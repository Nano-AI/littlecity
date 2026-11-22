// The raid's ships as drawn (longship.ts): sound meshes, a clinker hull whose planking the pen can draw (a
// group per strake), and a budget in the range of the harbour's galleon.

import { describe, expect, test } from 'vitest';
import { findDuplicateFaces, inkGroups, triangleCount, validateMesh } from '@/gen/checks';
import { MeshBuilder } from '@/gen/mesh';
import { drawGalleon } from '@/parts/actors/ships/galleon.part';
import { shipPaint, type ShipPaint } from '@/parts/actors/ships/paint';
import { rigOf } from '@/parts/actors/ships/rig';
import { longshipMesh, longshipSailMesh, longshipYardMesh, oarBankMesh, raidBoatMesh } from './longship';

function galleonTriangles(): number {
  const b = new MeshBuilder({ ink: 'galleon' });
  drawGalleon(b, rigOf('galleon', 0), shipPaint(0, 'galleon') as ShipPaint);
  return triangleCount(b.build());
}

describe('the longship', () => {
  test('sound meshes, planking drawn by strakes, a budget like the galleon\'s', () => {
    const galleon = galleonTriangles();
    const hull = longshipMesh(1, 0), grand = longshipMesh(1.5, 0), boat = raidBoatMesh(0);
    const parts = { hull, grand, boat, sail: longshipSailMesh(1), yard: longshipYardMesh(1), oars: oarBankMesh(1, 1), grandOars: oarBankMesh(1, 1.5) };
    for (const [name, m] of Object.entries(parts)) {
      expect(validateMesh(m), name).toEqual([]);
      expect(findDuplicateFaces(m), name).toBe(0);
    }
    const whole = triangleCount(hull) + triangleCount(parts.sail) + triangleCount(parts.yard) + 2 * triangleCount(parts.oars);
    console.log(`triangles: galleon hull ${galleon}; longship hull ${triangleCount(hull)}, sail ${triangleCount(parts.sail)}, yard ${triangleCount(parts.yard)}, oars ${2 * triangleCount(parts.oars)} (whole ${whole}); grand hull ${triangleCount(grand)}; rowing boat ${triangleCount(boat)}`);
    // In the galleon's range (it is the best ship in the game): not a placeholder, and not far past it. The
    // galleon's count is its hull alone (its sails and yards are meshes of their own): the longship's whole,
    // sail, yard and oars, against it.
    expect(whole).toBeGreaterThan(galleon * 0.5);
    expect(whole).toBeLessThan(galleon * 2.6);
    // A pen line between every pair of strakes: seven strakes a side are seven groups, and more besides.
    expect(inkGroups(hull).size).toBeGreaterThan(40);
    // The grand ship is more than the same mesh scaled: more to it (oars, awning, shields).
    expect(triangleCount(grand)).toBeGreaterThan(triangleCount(hull));
  });
});
