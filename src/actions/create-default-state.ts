import { TimeDisplay } from "@semio/ui";
import { AnimationData } from "../store-types";
import { createEmptySelectionState } from "../functions/selection-state-manager";
import { TransitionDirective, TransitionPairing } from "../types";
// import { createDefaultAnimation } from "./create-default-animation";

/**
 * Creates the default state for the animation store.
 *
 * Transient values and velocities live in the dedicated `useValuesStore`
 * (from `@semio/utils`), not in this state object.
 */
export const createDefaultState = (): AnimationData => {
  // const defaultAnimation = createDefaultAnimation();

  return {
    derivedSnapshot: undefined,
    namespaces: {},
    animations: {},
    tracks: {},
    duration: 5000,
    framerate: 24,
    expanded: false,
    timeDisplay: TimeDisplay.Frames,
    playerInterval: undefined,
    previews: [],
    selectionState: createEmptySelectionState(),
    preferences: {
      hoverDashedLine: false,
      dataPreviews: true,
      controlStripMode: "keySkip",
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
    sourceRowIds: {
      flat: [],
      spline: [],
    },
    sourceRowIdsByView: {},
    tracksRevision: 0,
  };
};
