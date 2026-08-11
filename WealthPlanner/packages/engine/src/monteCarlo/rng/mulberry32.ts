// Seedable PRNG (mulberry32) — replaces the workbook's `Rnd()` so a run can
// be reproduced exactly from a fixed seed (docs/07 §7.2, §7.3; docs/06 §6.6).
// Ported from the well-known public-domain implementation by Tommy Ettinger.
//
// mulberry32 produces a uniform draw in [0, 1) for each call. It is
// deterministic for a given 32-bit seed, which is what the workbook's
// "Freeze Random Seed" reproducible-run feature requires.

export type RandomSource = () => number;

/** Returns a fresh mulberry32 PRNG seeded by `seed`. */
export function mulberry32(seed: number): RandomSource {
  // Normalize the seed to an unsigned 32-bit integer (mulberry32 is defined
  // over the full 32-bit state space). Math.floor + >>>0 keeps large seeds
  // and non-integers well-defined.
  let a = (seed >>> 0) || 0x6d2b79f5;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [0, bound) drawn from `rng`. */
export function randInt(rng: RandomSource, bound: number): number {
  return Math.floor(rng() * bound);
}
