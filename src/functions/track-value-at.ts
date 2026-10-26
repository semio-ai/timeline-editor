import type { DerivedSnapshot } from "../types";
import type { SimpleRawValue } from "../types/data/simple-track";
import { computeLocalStamp } from "./compute-instance-time";

/**
 * The value the timeline reads for a track of the derived snapshot at a world
 * stamp: its drag preview's curve while one is shown, else its curve, at the
 * instance's local time. `undefined` for a track the snapshot does not hold,
 * a muted one, or one the host cannot evaluate.
 */
export function trackValueAt(
  snapshot: DerivedSnapshot | undefined,
  trackKey: string,
  worldStamp: number,
): SimpleRawValue | undefined {
  const track = snapshot?.tracks[trackKey as keyof DerivedSnapshot["tracks"]];
  if (!track || track.metadata?.muted) return undefined;
  const timescale = track.metadata?.timescale ?? 1;
  const offset = track.metadata?.offset ?? 0;
  const safeTimescale = Number.isFinite(timescale) && timescale !== 0 ? timescale : 1;
  const curve = track.preview?.curve ?? track.canonical.curve;
  return curve(computeLocalStamp(worldStamp, safeTimescale, offset)) as SimpleRawValue | undefined;
}
