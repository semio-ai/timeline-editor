import { getLookup, RawValue } from "@semio/utils";
import { AnimationData } from "../store-types";
import { parseTrackKey } from "./track-key";

export function resolveInterpolatedValues(state: AnimationData): Map<string, RawValue | undefined> {
  if (state.derivedMode === "snapshot" && state.derivedSnapshot) {
    const resolved = new Map<string, RawValue | undefined>();
    Object.entries(state.derivedSnapshot.tracks).forEach(([trackKey, track]) => {
      const { namespaceId } = parseTrackKey(trackKey);
      const animatableId = track.metadata?.animatableId;
      if (!animatableId) return;
      const lookup = getLookup(namespaceId, animatableId);
      resolved.set(lookup, state.values.get(lookup));
    });
    return resolved;
  }
  return state.values;
}

export function resolveInterpolatedVelocities(
  state: AnimationData,
): Map<string, RawValue | undefined> {
  if (state.derivedMode === "snapshot" && state.derivedSnapshot) {
    const resolved = new Map<string, RawValue | undefined>();
    Object.entries(state.derivedSnapshot.tracks).forEach(([trackKey, track]) => {
      const { namespaceId } = parseTrackKey(trackKey);
      const animatableId = track.metadata?.animatableId;
      if (!animatableId) return;
      const lookup = getLookup(namespaceId, animatableId);
      resolved.set(lookup, state.velocities.get(lookup));
    });
    return resolved;
  }
  return state.velocities;
}
