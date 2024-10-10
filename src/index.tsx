import "./styles.css";

export { ControlWidget } from "./control-widget";
export { AnimationSheet } from "./animation-sheet";
export { AnimationContext } from "./context";
export type {
  AnimationData,
  AnimationActions,
  AnimationStoreGetter,
  AnimationStoreSetter,
  Preview,
} from "./store-types";
export { AnimationSlice } from "./store";
export type { AnimationStore } from "./store";
export * from "./types";

export { createKeypoint } from "./actions/create-keypoint";
export { createTrack } from "./actions/create-track";
export { removeAnimation } from "./actions/remove-animation";
export { updateAnimationKeypoint } from "./actions/update-animation-keypoint";
export { createDefaultState } from "./actions/create-default-state";
export { computeWorldStamp, computeLocalStamp } from "./actions/compute-instance-time";
export { addAnimation } from "./actions/add-animation";

export { TrackControl, type TrackControlProps } from "./track-control";

// THE FOLLOWING ENTRIES SHOULD BE REMOVED FOLLOWING THE DEMO
export * from "./temp-duplicate-types";
