import { describe, expect, it } from 'vitest';
import { dogMesh } from './dog';

describe('dogMesh', () => {
  it('the same pose and coat give the same mesh', () => {
    expect(dogMesh('sit', 1)).toBe(dogMesh('sit', 1));
    expect(dogMesh('sit', 1)).not.toBe(dogMesh('sit', 2));
    expect(dogMesh('sit', 1)).not.toBe(dogMesh('bark', 1));
  });
});
