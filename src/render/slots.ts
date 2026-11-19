// The slot table (Look, Stage 1): one row per thing that can move. Pure
// data; the view uploads `data` as a float texture and the vertex shader
// reads a vertex's slot from it (see pool.ts for the `slot` attribute).
//
// A slot holds a 3 × 4 world matrix and the four free numbers of
// InstanceHandle.setParams. Slot 0 is the identity with default params and
// is what all baked, static geometry uses. Lifting a structure out of its
// chunk for a landing bounce is therefore just "point its vertices at a
// fresh slot": no geometry is rebuilt and no draw call is added.
//
// Texture layout: SLOT_COLS slots per row, 4 texels per slot:
//   texel 0–2  rows of the matrix: [m0 m4 m8 m12], [m1 m5 m9 m13], [m2 m6 m10 m14]
//   texel 3    params a, b, c, d

import type { Mat4Like } from '@/core/mat4';

export const SLOT_COLS = 64;
export const SLOT_TEXELS = 4;
/** Texture width in texels. */
export const SLOT_WIDTH = SLOT_COLS * SLOT_TEXELS;
const FLOATS = SLOT_TEXELS * 4;

/**
 * By convention a = glow (1 = lit as the time of day says, 0 = off), b = sway phase; c and d belong to the
 * part. A negative `a` is the view's own: it marks a ghost slot, drawn by the overlay pass.
 */
export const DEFAULT_PARAMS: readonly [number, number, number, number] = [1, 0, 0, 0];

export class SlotTable {
  rows = 4;
  data = new Float32Array(this.rows * SLOT_WIDTH * 4);
  /** Goes up when `data` is replaced by a larger array (the texture must be recreated). */
  generation = 0;
  /** Set whenever `data` changes; the view clears it after uploading. */
  dirty = true;
  /** Set whenever something moved, appeared or vanished (not for params); the view clears it. */
  moved = true;
  private free: number[] = [];
  private next = 1;
  /** The true matrix of each slot (12 floats), kept while a slot is hidden. */
  private matrix = new Float32Array(this.rows * SLOT_COLS * 12);
  private hidden = new Uint8Array(this.rows * SLOT_COLS);

  constructor() {
    this.reset(0);
  }

  get capacity(): number {
    return this.rows * SLOT_COLS;
  }
  /** Slots handed out and not yet freed. */
  get used(): number {
    return this.next - 1 - this.free.length;
  }

  alloc(): number {
    const slot = this.free.pop() ?? this.next++;
    if (slot >= this.capacity) this.grow();
    this.reset(slot);
    return slot;
  }

  release(slot: number): void {
    if (slot <= 0) return;
    this.reset(slot);
    this.free.push(slot);
  }

  setMatrix(slot: number, m: Mat4Like): void {
    const k = slot * 12;
    const t = this.matrix;
    t[k] = m[0]!; t[k + 1] = m[4]!; t[k + 2] = m[8]!; t[k + 3] = m[12]!;
    t[k + 4] = m[1]!; t[k + 5] = m[5]!; t[k + 6] = m[9]!; t[k + 7] = m[13]!;
    t[k + 8] = m[2]!; t[k + 9] = m[6]!; t[k + 10] = m[10]!; t[k + 11] = m[14]!;
    if (!this.hidden[slot]) this.write(slot);
  }

  setVisible(slot: number, visible: boolean): void {
    if (!!this.hidden[slot] === !visible) return;
    this.hidden[slot] = visible ? 0 : 1;
    if (visible) this.write(slot);
    else {
      // A zero matrix collapses every vertex of the slot to one point: nothing is drawn.
      this.data.fill(0, slot * FLOATS, slot * FLOATS + 12);
      this.dirty = true;
      this.moved = true;
    }
  }

  setParams(slot: number, a: number, b = 0, c = 0, d = 0): void {
    const k = slot * FLOATS + 12;
    const t = this.data;
    if (t[k] === a && t[k + 1] === b && t[k + 2] === c && t[k + 3] === d) return;
    t[k] = a; t[k + 1] = b; t[k + 2] = c; t[k + 3] = d;
    this.dirty = true;
  }

  private write(slot: number): void {
    this.data.set(this.matrix.subarray(slot * 12, slot * 12 + 12), slot * FLOATS);
    this.dirty = true;
    this.moved = true;
  }

  private reset(slot: number): void {
    const k = slot * 12;
    this.matrix.fill(0, k, k + 12);
    this.matrix[k] = 1;
    this.matrix[k + 5] = 1;
    this.matrix[k + 10] = 1;
    this.hidden[slot] = 0;
    this.write(slot);
    this.data.set(DEFAULT_PARAMS, slot * FLOATS + 12);
  }

  private grow(): void {
    this.rows *= 2;
    const data = new Float32Array(this.rows * SLOT_WIDTH * 4);
    data.set(this.data);
    this.data = data;
    const matrix = new Float32Array(this.capacity * 12);
    matrix.set(this.matrix);
    this.matrix = matrix;
    const hidden = new Uint8Array(this.capacity);
    hidden.set(this.hidden);
    this.hidden = hidden;
    this.generation++;
    this.dirty = true;
  }
}
