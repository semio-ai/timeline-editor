import type { RawValue } from "@semio/utils";
import { trackCurve, type TrackCurve } from "../functions/track-curve";
import type { Animation, Track } from "../types";
import type { SimpleTrack } from "../types/data/simple-track";
import { clipBaker } from "./module-clip/clip-baker";

/**
 * A track's curve as the module bakes it (through the tests' `clipBaker`), in
 * the track's local time: within `animation` and its `tracks` when given,
 * else within an animation of that one track. The tests' tracks hold scalars.
 */
export function curveOf(
  track: Track<RawValue>,
  animation: Animation = {
    id: `${track.id}-animation`,
    name: track.name,
    tracks: [track.id],
    groups: [],
  },
  tracks: Record<string, Track<RawValue>> = { [track.id]: track },
): TrackCurve {
  const curve = trackCurve(
    track as SimpleTrack,
    animation,
    tracks as Record<string, SimpleTrack>,
    clipBaker,
  );
  if (!curve) throw new Error(`track ${track.id} has no curve`);
  return curve;
}
