export {
  AnimatableControl,
  AnimatableControlList,
  AnimatableNumberField,
  TrackControl,
  KeyStrip,
  MotionCubicBezierLine,
  MotionCubicBezierFill,
  type AnimatableControlProps,
  type AnimatableControlListProps,
  type AnimatableNumberFieldProps,
  type KeyStripProps,
  type MotionCubicBezierLineProps,
  type MotionCubicBezierFillProps,
} from "./components";
export {
  AnimationSheet,
  AnimationSheetCore,
  type AnimationSheetProps,
  type AnimationSheetCoreProps,
} from "./components/animation-sheet";
export * from "./hooks";
export * from "./context";
export * from "./store-types";
export * from "./store";
export * from "./types";

export * from "./actions";
export * from "./utils/context-providers";
export * from "./utils/track-key";

export { SIDEBAR_WIDTH } from "./constants/layout";

export { animationIconRegistry, type AnimationIconName } from "./icons/registry";

export * from "./functions";
export * from "./keybindings";
export * from "./test-fixtures";

// Re-export values store from @semio/utils for convenience
export { useValuesStore, mergeValueMaps, type ValuesStore, type ValuesData, type ValuesActions } from "@semio/utils";
