import { getLookup } from "@semio/utils";
import { AnimationData } from "../store-types";
import { TrackInterpolators } from "../types";
import { parseTrackKey } from "./track-key";

export function resolveTrackInterpolators(state: AnimationData): TrackInterpolators {
  if (state.derivedMode === "snapshot" && state.derivedSnapshot) {
    const map: TrackInterpolators = {};
    Object.entries(state.derivedSnapshot.tracks).forEach(([trackKey, track]) => {
      const { namespaceId } = parseTrackKey(trackKey);
      const animatableId = track.metadata?.animatableId;
      if (!animatableId) return;
      const lookup = getLookup(namespaceId, animatableId);
      map[lookup] = {
        value: track.canonical.interpolator,
        derivative: track.canonical.derivative,
      };
    });
    return map;
  }
  return state.trackInterpolators;
}
