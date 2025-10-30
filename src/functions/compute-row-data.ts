import { AnimatableValue, RawValue } from "@semio/utils";
import { pick, uniq } from "lodash";
import {
  ComputedRowData,
  DragState,
  SelectionState,
  SourceRow,
  Track,
  Violation,
  Animation,
  Namespace,
} from "../types";
import { applyDragDeltas } from "./apply-drag-deltas";
import { computeViolationSet } from "./compute-violation-set";
import { computeTransitionSegments } from "./compute-transition-segments";
import { computeFilledInterpGaps } from "./compute-filled-interp-gaps";
import { computeVerticalBounds } from "./compute-vertical-bounds";
import { computeFrames } from "./compute-frames";
import { computeTrackInterpolator } from "./compute-track-interpolator";
import { computeTrackViolations } from "./compute-track-violations";

interface RowComputationContext {
  animations: Record<string, Animation>;
  namespaces: Record<string, Namespace>;
}

export function computeRowData(
  sourceRow: SourceRow,
  tracks: Record<string, Track<RawValue>>,
  violations: Record<string, Violation[]>,
  animatables: Record<string, AnimatableValue>,
  dragState: DragState | undefined,
  selectionState: SelectionState,
  context?: RowComputationContext,
): ComputedRowData {
  const trackIds = uniq(sourceRow.data.map((t) => t.trackId));
  const instanceIds = new Set(sourceRow.data.map((t) => t.instanceId));
  const namespaceIds = new Set(sourceRow.data.map((t) => t.namespaceId));
  const attributePathsByTrack = sourceRow.data.reduce<Map<string, string[] | undefined>>(
    (acc, entry) => {
      if (!acc.has(entry.trackId)) {
        acc.set(entry.trackId, entry.attribute ? [entry.attribute] : undefined);
      }
      return acc;
    },
    new Map(),
  );

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

  const primarySource = sourceRow.data[0];
  const shouldPreviewViolations =
    Boolean(dragState) &&
    selectionState.instanceId === dragState?.instanceId &&
    primarySource?.instanceId === dragState?.instanceId &&
    Boolean(context?.animations) &&
    Boolean(context?.namespaces);

  const effectiveViolations: Record<string, Violation[]> = { ...filteredViolations };

  if (shouldPreviewViolations && primarySource) {
    const animation = context?.animations[primarySource.animationId];
    const namespace = context?.namespaces[primarySource.namespaceId];
    const instance = namespace?.animationInstances?.[primarySource.instanceId];

    if (animation && instance) {
      trackIds.forEach((trackId) => {
        const track = relevantTracks[trackId];
        const animatable = track ? animatables[track.animatableId] : undefined;
        if (!track || !animatable) {
          return;
        }

        const previewPoints = track.points.map((point) =>
          applyDragDeltas(point, {
            dragState,
            selection: selectionState,
            trackId,
            bounds: boundsForRow,
            attributePath: attributePathsByTrack.get(trackId),
          }),
        );

        const changed = previewPoints.some((point, index) => point !== track.points[index]);
        if (!changed) {
          effectiveViolations[trackId] = filteredViolations[trackId] ?? [];
          return;
        }

        const previewTrack: Track<RawValue> = {
          ...track,
          points: [...previewPoints].sort((a, b) => a.stamp - b.stamp),
        };

        const interpolator = computeTrackInterpolator(previewTrack, instance);
        const previewViolations = computeTrackViolations(
          interpolator,
          animation.duration,
          trackId,
          primarySource.namespaceId,
          primarySource.instanceId,
          animatable,
        );
        effectiveViolations[trackId] = previewViolations;
      });
    }
  }

  const violationSet = computeViolationSet(
    shouldPreviewViolations ? effectiveViolations : filteredViolations,
  );

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
