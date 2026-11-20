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
//   bits 0–1 stage, bit 2 cause (0 fire, 1 blast), bit 3 mending, bit 4 settling

export type DamageCause = 'fire' | 'blast';
export type DamageStage = 0 | 1 | 2 | 3;

export interface Damage {
  stage: DamageStage;
  cause: DamageCause;
  mending: boolean;
  settling: boolean;
}

export const SOUND: Damage = Object.freeze({ stage: 0, cause: 'fire', mending: false, settling: false });

const STAGE = 3;
const BLAST = 4;
const MENDING = 8;
const SETTLING = 16;
/** Every bit a saved ruin may have (settling is never saved). */
export const SAVED_RUIN_BITS = STAGE | BLAST | MENDING;

export function packRuin(d: Partial<Damage> & { stage: DamageStage }): number {
  const v = (d.stage & STAGE) | (d.cause === 'blast' ? BLAST : 0) | (d.mending ? MENDING : 0) | (d.settling ? SETTLING : 0);
  return isRuin(v) ? v : 0;
}

/** A legal non-zero packed value: stage 1–3, or stage 0 while mending. */
export function isRuin(v: unknown): v is number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0 || v > 31) return false;
  return (v & STAGE) !== 0 || (v & MENDING) !== 0;
}

export function unpackRuin(v: number | undefined): Damage {
  if (!v) return SOUND;
  return {
    stage: (v & STAGE) as DamageStage,
    cause: v & BLAST ? 'blast' : 'fire',
    mending: (v & MENDING) !== 0,
    settling: (v & SETTLING) !== 0,
  };
}

export const ruinStage = (v: number | undefined): DamageStage => ((v ?? 0) & STAGE) as DamageStage;
export const ruinCause = (v: number | undefined): DamageCause => ((v ?? 0) & BLAST ? 'blast' : 'fire');
export const ruinMending = (v: number | undefined): boolean => ((v ?? 0) & MENDING) !== 0;
export const ruinSettling = (v: number | undefined): boolean => ((v ?? 0) & SETTLING) !== 0;

/** Houses nobody, has no dressing, no shop: half-destroyed or worse. */
export const ruinUninhabitable = (v: number | undefined): boolean => ruinStage(v) >= 2;

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
