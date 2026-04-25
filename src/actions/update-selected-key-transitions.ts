import type { AnimationData, TransitionPatch } from "../store-types";
import { StandardTransitionType, TransitionPairing } from "../types";
import type { SimpleKeypoint } from "../types/data/simple-track";
import {
  resolveDefaultPairingForTransitions,
  resolveNextSelectionTransitions,
  type SelectedKeyContext,
} from "../functions/key-transition-ui-utils";
import { getNonEditableTrackIds } from "../functions/track-editability";
import { updateKeypoint } from "./update-keypoint";

const DEFAULT_NEW_KEY_TRANSITIONS = {
  in: StandardTransitionType.Cubic,
  out: StandardTransitionType.Cubic,
  pairing: TransitionPairing.Paired,
} as const;

export function updateNewKeyTransitionDefaults(state: AnimationData, patch: TransitionPatch): void {
  const nextTransitions = {
    ...(state.preferences.newKeyDefaults?.transitions ?? DEFAULT_NEW_KEY_TRANSITIONS),
    ...patch,
  };

  if (
    patch.pairing === undefined &&
    (patch.in !== undefined || patch.out !== undefined) &&
    nextTransitions.in !== undefined &&
    nextTransitions.out !== undefined
  ) {
    nextTransitions.pairing = resolveDefaultPairingForTransitions(
      nextTransitions.in,
      nextTransitions.out,
    );
  }

  state.preferences = {
    ...state.preferences,
    newKeyDefaults: {
      ...state.preferences.newKeyDefaults,
      transitions: nextTransitions,
    },
  };
}

export function updateSelectedKeyTransitions(state: AnimationData, patch: TransitionPatch): void {
  const selectedKeyContexts = resolveSelectedKeyContexts(state);
  if (selectedKeyContexts.length === 0) return;

  // Defense in depth against mixed selections that contain readonly /
  // user-locked keypoints. The slice wrapper only short-circuits when
  // *every* selected track is non-editable; the per-context filter here
  // ensures readonly keypoints are skipped even when the selection is
  // mixed (e.g. permissions changed mid-session leaving readonly entries
  // in `selectionState`).
  const { nonEditableIds } = getNonEditableTrackIds(state.instancedTrackSources);

  selectedKeyContexts.forEach((context) => {
    if (nonEditableIds.has(context.trackId)) return;
    const nextTransitions = resolveNextSelectionTransitions(context, patch);
    updateKeypoint(
      state,
      context.trackId,
      {
        id: context.point.id,
        transitions: nextTransitions,
      },
      false,
    );
  });
}

function resolveSelectedKeyContexts(state: AnimationData): SelectedKeyContext[] {
  const keyContexts: SelectedKeyContext[] = [];
  const sortedByTrackId = new Map<
    string,
    { points: SimpleKeypoint[]; indexById: Map<string, number> }
  >();

  state.selectionState.keypoints.forEach((selectedKeyIds, trackId) => {
    if (selectedKeyIds.size === 0) return;
    const track = state.tracks[trackId];
    if (!track) return;

    let sortedEntry = sortedByTrackId.get(trackId);
    if (!sortedEntry) {
      const points = track.points.slice().sort((a, b) => a.stamp - b.stamp);
      const indexById = new Map(points.map((point, index) => [point.id, index]));
      sortedEntry = { points, indexById };
      sortedByTrackId.set(trackId, sortedEntry);
    }

    selectedKeyIds.forEach((keypointId) => {
      const point = track.points.find((entry) => entry.id === keypointId);
      if (!point) return;
      const pointIndex = sortedEntry.indexById.get(keypointId);
      if (pointIndex === undefined) return;
      keyContexts.push({
        trackId,
        point,
        sortedTrackPoints: sortedEntry.points,
        pointIndex,
      });
    });
  });

  return keyContexts;
}
