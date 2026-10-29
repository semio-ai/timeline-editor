import { TimeDisplay } from "@semio/ui";
import { createPlayerStore } from "../player/player-store";
import {
  AnimationData,
  ControlStripMode,
  HandleVisibility,
  ViolationVisibility,
} from "../store-types";
import { createEmptySelectionState } from "../functions/selection-state-manager";
import { TransitionDirective, TransitionPairing } from "../types";
// import { createDefaultAnimation } from "./create-default-animation";

/**
 * Creates the default state for the animation store, with a player of its
 * own. Values come from the host's store (`DataStoreContext`), and the value a
 * track takes at the playhead from its curve (`trackValueAt`), not from this
 * state object.
 */
export const createDefaultState = (): AnimationData => {
  // const defaultAnimation = createDefaultAnimation();

  return {
    derivedSnapshot: undefined,
    playerStore: createPlayerStore(),
    namespaces: {},
    animations: {},
    tracks: {},
    duration: 5000,
    framerate: 24,
    expanded: false,
    timeDisplay: TimeDisplay.Frames,
    previews: [],
    selectionState: createEmptySelectionState(),
    emphasisRowId: null,
    preferences: {
      controlStripMode: ControlStripMode.KeySkip,
      handleVisibility: HandleVisibility.TrackSelection,
      violationVisibility: ViolationVisibility.Visible,
      newKeyDefaults: {
        transitions: {
          in: TransitionDirective.InferredAutoClamped,
          out: TransitionDirective.InferredAutoClamped,
          pairing: TransitionPairing.Paired,
        },
      },
    },

    animatables: {},

    dragState: undefined,
    editorViews: {},
    editorViewOrder: [],
    activeEditorViewId: undefined,
    instancedTrackSources: {},
    globalSourceTree: [],
    readonlyAnimations: {},
    sourceRowIds: {
      flat: [],
      spline: [],
    },
    sourceRowIdsByView: {},
    tracksRevision: 0,
    activeEntityId: null,
    entityStates: {},
    activeEntityContext: null,
    boxSelectState: null,
    boxSelectPending: false,
    clipboard: null,
  };
};
