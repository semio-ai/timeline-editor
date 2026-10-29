export {
  ControlStripModeToggle,
  TrackPropertiesStrip,
  type TrackPropertiesStripProps,
  AnimatableControl,
  AnimatableControlList,
  AnimatableNumberField,
  TrackControl,
  RowNoticeContext,
  KeyStrip,
  MotionCubicBezierLine,
  MotionCubicBezierFill,
  type AnimatableControlProps,
  type AnimatableControlListProps,
  type AnimatableNumberFieldProps,
  type KeyStripProps,
  type RowNotice,
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

// The values store of @semio/data, re-exported for hosts that import it from here.
// The package itself reads values through the injected `DataStore`.
export {
  useValuesStore,
  mergeValueMaps,
  type ValuesStore,
  type ValuesData,
  type ValuesActions,
} from "@semio/data";

export { type Player, PlayerDirection, newPlayer } from "./player/player";
export {
  type PlayerActions,
  type PlayerData,
  PlayerSlice,
  type PlayerStore,
  type PlayerStoreSetter,
  usePlayerStore,
} from "./player/player-store";
