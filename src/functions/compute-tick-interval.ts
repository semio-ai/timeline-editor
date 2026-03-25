/**
 * Blender-style tick interval selection.
 *
 * Builds a sorted array of candidate intervals from the framerate (sub-second
 * powers-of-2 frames, then 1-2-5 pattern for seconds/minutes/hours), and picks
 * the smallest interval whose pixel spacing meets the minimum threshold.
 *
 * @param framerate - Frames per second
 * @param pixelsPerMs - Current zoom: pixels per millisecond
 * @param minMajorPx - Minimum pixel distance between major ticks (default 80)
 * @returns { majorMs, minorMs } — major and minor tick intervals in ms
 */
export function computeTickIntervals(
  framerate: number,
  pixelsPerMs: number,
  minMajorPx = 80,
): { majorMs: number; minorMs: number } {
  if (framerate <= 0 || pixelsPerMs <= 0) {
    return { majorMs: 1000, minorMs: 500 };
  }

  const frameDurationMs = 1000 / framerate;
  const candidates = buildCandidates(framerate, frameDurationMs);

  // Walk from finest to coarsest, pick the first that meets the pixel threshold
  let majorMs = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    if (candidate * pixelsPerMs >= minMajorPx) {
      majorMs = candidate;
      break;
    }
  }

  // Minor ticks at half the major interval (Blender style).
  // Suppress if the major interval is already 1 frame.
  const minorMs = majorMs <= frameDurationMs ? majorMs : majorMs / 2;

  return { majorMs, minorMs };
}

/**
 * Build sorted candidate intervals from finest to coarsest, following
 * Blender's approach: sub-second powers-of-2 frames, then 1-2-5 for
 * seconds and above.
 */
function buildCandidates(framerate: number, frameDurationMs: number): number[] {
  const candidates: number[] = [];

  // Sub-second: powers of 2 in frames (1f, 2f, 4f, 8f, 16f, ...)
  for (let frames = 1; frames < framerate; frames *= 2) {
    candidates.push(frames * frameDurationMs);
  }

  // 1 second
  candidates.push(1000);

  // Seconds: 2s, 5s, 10s, 30s
  for (const s of [2, 5, 10, 30]) {
    candidates.push(s * 1000);
  }

  // Minutes: 1m, 2m, 5m, 10m, 30m
  for (const m of [1, 2, 5, 10, 30]) {
    candidates.push(m * 60 * 1000);
  }

  // Hours: 1h
  candidates.push(60 * 60 * 1000);

  // Sort ascending and deduplicate
  candidates.sort((a, b) => a - b);
  return candidates.filter((v, i, arr) => i === 0 || v !== arr[i - 1]);
}
