import { RawValue, usePlayerStore } from "@semio/utils";
import { type AnimationData } from "../store-types";
import { updateKeypoint } from "./update-keypoint";

/**
 * Sets the value for a given control in the animation state. If the control already exists,
 * it updates the existing track with the new value. If the control does not exist, it creates
 * a new track and control, and then updates the track with the new value.
 *
 * @param state - The current animation state.
 * @param id - The identifier of animatable for the control.
 * @param namespace - The namespace for the control (currently unused).
 * @param value - The new value to set for the control.
 */
export function setTrackValue(state: AnimationData, trackId: string, value: RawValue) {
  const timestamp = usePlayerStore.getState().player.stamp;

  if (state.tracks[trackId]) {
    updateKeypoint(state, trackId, { value, stamp: timestamp });
  } else {
    console.error("Track does not exist!", trackId);
  }
}
