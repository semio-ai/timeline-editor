import type { RawValue } from "@semio/data";
import { trackCurve, type TrackCurve } from "../functions/track-curve";
import type { Animation, Track } from "../types";
import type { SimpleTrack } from "../types/data/simple-track";
import { testTrackEvaluator } from "../test-fixtures/track-evaluator";

/** A scalar track evaluated exactly by the test evaluator, in local ms.
 */
export function curveOf(
  track: Track<RawValue>,
  _animation?: Animation,
  _tracks?: Record<string, Track<RawValue>>,
): TrackCurve {
  const curve = trackCurve(track as SimpleTrack, testTrackEvaluator);
  if (!curve) throw new Error(`track ${track.id} has no curve`);
  return curve;
}
