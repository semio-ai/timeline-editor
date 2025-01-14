import { RawValue, usePlayerStore } from "@semio/utils";
import { type AnimationData } from "../store-types";
import { updateKeypoint } from "./update-keypoint";
import { createTrack } from "./create-track";

/**
 * Sets the value for a given control in the animation state. If the control already exists,
 * it updates the existing track with the new value. If the control does not exist, it creates
 * a new track and control, and then updates the track with the new value.
 *
 * @param state - The current animation state.
 * @param id - The identifier for the control.
 * @param _namespace - The namespace for the control (currently unused).
 * @param value - The new value to set for the control.
 */
export function setValue(state: AnimationData, id: string, _namespace: string, value: RawValue) {
  console.log("(Animation) Setting value for control", id);
  const timestamp = usePlayerStore.getState().player.stamp;

  const activeAnimationId = state.activeAnimation;
  const activeAnimationData = state.animations[activeAnimationId];
  const activeAnimationTracks = activeAnimationData.tracks;
  const activeAnimationTrackDatas = activeAnimationTracks.map((trackId) => state.tracks[trackId]);
  const activeAnimationTrackData = activeAnimationTrackDatas.find(
    (track) => track.animatableId === id,
  );
  if (activeAnimationTrackData) {
    console.log("Updating existing track for control");
    updateKeypoint(state, activeAnimationTrackData.id, { value, stamp: timestamp });
    // return;
  } else {
    console.log("Creating new track for control");
    const sourceAnimatable = state.animatables[id];

    const newTrack = createTrack(state, id, activeAnimationId, { name: sourceAnimatable.name });
    updateKeypoint(state, newTrack.id, { value, stamp: timestamp });
  }
}

/**
 * Updates the color setting of a specific control in the animation state.
 *
 * @param state - The current animation state containing controls.
 * @param trackId - The unique identifier of the control to update.
 * @param color - The new color to set for the control.
 */
export function updateControlColor(state: AnimationData, trackId: string, color: string) {
  if (state.tracks[trackId]) {
    if (!state.tracks[trackId].settings) {
      state.tracks[trackId].settings = {};
    }
    state.tracks[trackId].settings.color = color;
  }
}
