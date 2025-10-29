import { AnimatableValue, RawValue } from "@semio/utils";
import { pick, uniq } from "lodash";
import { ComputedRowData, DragState, SelectionState, SourceRow, Track, Violation } from "../types";
import { applyDragDeltas } from "./apply-drag-deltas";
import { computeViolationSet } from "./compute-violation-set";
import { computeTransitionSegments } from "./compute-transition-segments";
import { computeFilledInterpGaps } from "./compute-filled-interp-gaps";
import { computeVerticalBounds } from "./compute-vertical-bounds";
import { computeFrames } from "./compute-frames";

export function computeRowData(
  sourceRow: SourceRow,
  tracks: Record<string, Track<RawValue>>,
  violations: Record<string, Violation[]>,
  animatables: Record<string, AnimatableValue>,
  dragState: DragState | undefined,
  selectionState: SelectionState,
): ComputedRowData {
  const trackIds = uniq(sourceRow.data.map((t) => t.trackId));
  const instanceIds = new Set(sourceRow.data.map((t) => t.instanceId));
  const namespaceIds = new Set(sourceRow.data.map((t) => t.namespaceId));

  const filteredViolations = trackIds.reduce<Record<string, Violation[]>>((acc, trackId) => {
    const trackViolations = violations[trackId];
    if (!trackViolations || trackViolations.length === 0) {
      return acc;
    }

    const scopedViolations = trackViolations.filter((violation) => {
      if (instanceIds.size > 0 && !instanceIds.has(violation.instanceId)) {
        return false;
      }
      if (namespaceIds.size > 0 && !namespaceIds.has(violation.namespace)) {
        return false;
      }
      return true;
    });

    if (scopedViolations.length > 0) {
      acc[trackId] = scopedViolations;
    }

    return acc;
  }, {});
  const violationSet = computeViolationSet(filteredViolations);
  const relevantTracks = pick(tracks, trackIds);
  const verticalBounds = computeVerticalBounds(relevantTracks, animatables, [sourceRow]);
  const boundsForRow = {
    min: verticalBounds[0],
    max: verticalBounds[1],
  };

  const keypointSelection =
    dragState && selectionState.instanceId === dragState.instanceId
      ? new Set<string>(
          Array.from(selectionState.keypoints.values()).flatMap((keypointSet) =>
            Array.from(keypointSet),
          ),
        )
      : undefined;

  const virtualFrames = computeFrames(relevantTracks, sourceRow, {
    draggingKeypointIds: keypointSelection,
    transformKeypoint: (keypoint, { trackId, source }) =>
      applyDragDeltas(keypoint, {
        dragState,
        selection: selectionState,
        trackId,
        bounds: boundsForRow,
        attributePath: source.attribute ? [source.attribute] : undefined,
      }),
  });

  const explicitInterpolationSegments = computeTransitionSegments(virtualFrames, trackIds);
  const interpolations = computeFilledInterpGaps(explicitInterpolationSegments);

  const rowComputedData: ComputedRowData = {
    violationSet,
    virtualFrames,
    interpolations,
    verticalBounds: boundsForRow,
  };

  return rowComputedData;
}
