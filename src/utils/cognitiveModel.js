/**
 * Shared cognitive-performance model for the Orbital Architecture tools.
 *
 * Provides the illustrative mapping from habitat architectural parameters
 * (Noise, Biophilia, Clutter, Lighting) to cognitive metrics, reused by the
 * Space Architecture Simulator and the Habitat Blueprint Designer.
 *
 * Part of the Orbital Architecture project. MIT License — see LICENSE.
 */

export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export const DEFAULT_ARCH_PARAMS = {
  noise: 40,
  biophilia: 55,
  clutter: 35,
  lighting: 60
};

/**
 * Map architectural parameters (0-100 each) to cognitive metrics (0-100).
 * Noise & Clutter degrade performance; Biophilia & Lighting improve it.
 */
export function computeMetrics({ noise, biophilia, clutter, lighting }) {
  const n = noise / 100;
  const b = biophilia / 100;
  const c = clutter / 100;
  const l = lighting / 100;

  const attention = Math.round(clamp(100 * (0.55 + 0.30 * l + 0.20 * b - 0.35 * n - 0.25 * c)));
  const memory = Math.round(clamp(100 * (0.55 + 0.20 * l + 0.25 * b - 0.30 * n - 0.30 * c)));
  const stress = Math.round(clamp(100 * (0.30 + 0.40 * n + 0.30 * c - 0.20 * b - 0.15 * l)));
  const overall = Math.round((attention + memory + (100 - stress)) / 3);

  return { attention, memory, stress, overall };
}

/**
 * Convert an overall cognitive score (0-100) to a simulated simple
 * reaction time in milliseconds. Higher cognition -> faster reaction.
 */
export function reactionTimeMs(overall) {
  return Math.round(400 - overall * 1.5); // 0 -> 400ms, 100 -> 250ms
}

/** Reaction time at the neutral reference point (overall = 50). */
export const REFERENCE_RT_MS = reactionTimeMs(50);
