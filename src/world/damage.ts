// A block's damage (design section 13b, "Mischief"), packed into Block.ruin.
// Owner: Mischief. Pure; everything else reads damage through these helpers.
//
// The lasting conditions are saved; the passing ones (flames, how fiercely a
// block burns, smoke, flying debris) live in the mischief simulation and are
// never saved, so a town never reopens burning.
//
//   stage 0  sound (no `ruin` field at all), or sound and still in scaffolding
//   stage 1  scorched (fire) or cracked (blast): soot, lost glass, cracks
//   stage 2  half-destroyed: part of the roof gone, a wall broken open
//   stage 3  destroyed: a burnt-out shell (fire) or a heap of rubble (blast)
//
// A block being repaired keeps its stage and gains `mending` (scaffolding,
// fresh timbers); each repair step lowers the stage; stage 0 + mending is the
// last step (all rebuilt, scaffolding still up); then the field goes.
//
// `settling` is set for the second or so while a blast's chunks are in the
// air: the shell is drawn without its rubble heap, which the flying chunks
// are about to become. It is never saved (the share codec drops it).
//
//   bits 0–1 stage, bit 2 cause (0 fire, 1 blast), bit 3 mending, bit 4 settling,
//   bits 5–9 how far mending has got (0–31, out of MEND_STEPS)
//
// While a block is being mended its stage stays the damage it had, so the
// look can rebuild exactly what was lost: clearing, scaffolding, frame,
// walls course by course, rafters, tiles row by row, glazing, paint, and
// the scaffolding down at the end.

export type DamageCause = 'fire' | 'blast';
export type DamageStage = 0 | 1 | 2 | 3;

export interface Damage {
  stage: DamageStage;
  cause: DamageCause;
  mending: boolean;
  settling: boolean;
  /** Steps of mending done, 0 to MEND_STEPS − 1 (0 when not mending). */
  progress: number;
  /**
   * Which way it fell, for a thing blown over (a tree): 0 not said, 1–4 = N, E, S, W + 1. Kept in the
   * same bits as `progress` (a block being mended no longer needs it).
   */
  fall?: number;
}

/** Mending goes in this many steps; the step after the last makes the block sound. */
export const MEND_STEPS = 32;

export const SOUND: Damage = Object.freeze({ stage: 0, cause: 'fire', mending: false, settling: false, progress: 0 });

const STAGE = 3;
const BLAST = 4;
const MENDING = 8;
const SETTLING = 16;
const PROGRESS_SHIFT = 5;
const PROGRESS = 31 << PROGRESS_SHIFT;
/** Every bit a saved ruin may have (settling is never saved). */
export const SAVED_RUIN_BITS = STAGE | BLAST | MENDING | PROGRESS;

export function packRuin(d: Partial<Damage> & { stage: DamageStage }): number {
  const progress = d.mending ? Math.max(0, Math.min(MEND_STEPS - 1, Math.floor(d.progress ?? 0))) : Math.max(0, Math.min(4, Math.floor(d.fall ?? 0)));
  const v = (d.stage & STAGE) | (d.cause === 'blast' ? BLAST : 0) | (d.mending ? MENDING : 0) | (d.settling ? SETTLING : 0) | (progress << PROGRESS_SHIFT);
  return isRuin(v) ? v : 0;
}

/** A legal non-zero packed value: stage 1–3, or stage 0 while mending. */
export function isRuin(v: unknown): v is number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0 || v > 1023) return false;
  // Progress while mending; otherwise those bits hold only a fall direction (0–4).
  if ((v & MENDING) === 0 && (v & PROGRESS) >> PROGRESS_SHIFT > 4) return false;
  return (v & STAGE) !== 0 || (v & MENDING) !== 0;
}

export function unpackRuin(v: number | undefined): Damage {
  if (!v) return SOUND;
  return {
    stage: (v & STAGE) as DamageStage,
    cause: v & BLAST ? 'blast' : 'fire',
    mending: (v & MENDING) !== 0,
    settling: (v & SETTLING) !== 0,
    progress: v & MENDING ? (v & PROGRESS) >> PROGRESS_SHIFT : 0,
    fall: v & MENDING ? 0 : (v & PROGRESS) >> PROGRESS_SHIFT,
  };
}

/** How far mending has got, 0 to 1 (0 when not mending). */
export const ruinProgress = (v: number | undefined): number => (ruinMending(v) ? (((v ?? 0) & PROGRESS) >> PROGRESS_SHIFT) / MEND_STEPS : 0);
/** The way a blown-over thing fell (0 N, 1 E, 2 S, 3 W), or -1 if not said. */
export const ruinFall = (v: number | undefined): number => (ruinMending(v) ? -1 : (((v ?? 0) & PROGRESS) >> PROGRESS_SHIFT) - 1);

export const ruinStage = (v: number | undefined): DamageStage => ((v ?? 0) & STAGE) as DamageStage;
export const ruinCause = (v: number | undefined): DamageCause => ((v ?? 0) & BLAST ? 'blast' : 'fire');
export const ruinMending = (v: number | undefined): boolean => ((v ?? 0) & MENDING) !== 0;
export const ruinSettling = (v: number | undefined): boolean => ((v ?? 0) & SETTLING) !== 0;

/** Houses nobody, has no dressing, no shop: half-destroyed or worse, or in scaffolding. */
export const ruinUninhabitable = (v: number | undefined): boolean => ruinStage(v) >= 2 || ruinMending(v);

/** The value saved for a block (settling dropped; a value that drops to nothing is still a ruin of its stage). */
export function savedRuin(v: number | undefined): number {
  return (v ?? 0) & SAVED_RUIN_BITS;
}

/** A short name for the guide, tests and the debug handle. */
export function ruinName(v: number | undefined): string {
  const d = unpackRuin(v);
  if (d.stage === 0) return d.mending ? 'nearly mended' : 'sound';
  const names = d.cause === 'fire' ? ['', 'scorched', 'half-burnt', 'burnt out'] : ['', 'cracked', 'half-wrecked', 'rubble'];
  return names[d.stage]! + (d.mending ? ' (mending)' : '');
}
