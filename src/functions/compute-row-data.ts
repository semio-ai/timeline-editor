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
  TrackKey,
  InstancePair,
  EndpointTransitions,
  TrackRender,
  Keypoint,
} from "../types";
import { TYPE_FIELDS, DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import { buildTrackKey } from "../utils/track-key";
import { applyTrackDiffsToPoints, computeTrackDiffsForDrag } from "./apply-drag-deltas";
import { computeViolationSet } from "./compute-violation-set";
import { computeTransitionSegments } from "./compute-transition-segments";
import { computeFilledInterpGaps } from "./compute-filled-interp-gaps";
import { computeVerticalBounds } from "./compute-vertical-bounds";
import { computeFrames } from "./compute-frames";
import { computeTrackInterpolator } from "./compute-track-interpolator";
import { computeTrackViolations } from "./compute-track-violations";
import { clampMonotonicCubicSegment } from "./clamp-monotonic-cubic-segment";
import { buildSegmentRenderParams } from "./build-segment-render-params";

interface RowComputationContext {
  animations: Record<string, Animation>;
  namespaces: Record<string, Namespace>;
}

export function computeRowData(
  sourceRow: SourceRow,
  tracks: Record<string, Track<RawValue>>,
  violations: Partial<Record<TrackKey, Violation[]>>,
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

  const trackKeysByTrackId = new Map<string, TrackKey[]>();
  sourceRow.data.forEach((datum) => {
    const list = trackKeysByTrackId.get(datum.trackId) ?? [];
    if (datum.namespaceId && datum.instanceId) {
      const key = buildTrackKey(datum.namespaceId, datum.instanceId, datum.trackId);
      if (!list.includes(key)) {
        list.push(key);
      }
    }
    trackKeysByTrackId.set(datum.trackId, list);
  });

  const filteredViolations = trackIds.reduce<Record<string, Violation[]>>((acc, trackId) => {
    const trackKeys = trackKeysByTrackId.get(trackId) ?? [];
    const byKey = trackKeys.flatMap((key) => violations[key] ?? []);
    const trackViolations = byKey;
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

  const constraintBoundsByTrack = new Map<string, { min: number; max: number } | undefined>();

  const resolveConstraintBounds = (
    animatable: AnimatableValue | undefined,
    attributePath?: string[],
  ): { min: number; max: number } | undefined => {
    if (!animatable) return undefined;
    const constraints = (animatable as any)?.constraints;

    if (animatable.type === "number") {
      const min = typeof constraints?.min === "number" ? constraints.min : undefined;
      const max = typeof constraints?.max === "number" ? constraints.max : undefined;
      return min !== undefined && max !== undefined ? { min, max } : undefined;
    }

    if (!attributePath || attributePath.length === 0) {
      return undefined;
    }

    const attribute = attributePath[attributePath.length - 1];
    const index = TYPE_FIELDS[animatable.type]?.indexOf(attribute) ?? -1;
    if (index === -1) {
      return undefined;
    }

    const constraintMin = constraints?.min?.[index];
    const constraintMax = constraints?.max?.[index];
    return typeof constraintMin === "number" && typeof constraintMax === "number"
      ? { min: constraintMin, max: constraintMax }
      : undefined;
  };

  trackIds.forEach((trackId) => {
    const track = relevantTracks[trackId];
    if (!track) {
      constraintBoundsByTrack.set(trackId, undefined);
      return;
    }

    const animatable = animatables[track.animatableId];
    const attributePath = attributePathsByTrack.get(trackId);
    const bounds = resolveConstraintBounds(animatable, attributePath);
    constraintBoundsByTrack.set(trackId, bounds);
  });

  const previewTrackPoints = new Map<string, Keypoint<RawValue>[]>();
  const previewPointLookup = new Map<string, Map<string, Keypoint<RawValue>>>();

  if (dragState && selectionState.instanceId === dragState.instanceId) {
    trackIds.forEach((trackId) => {
      const track = relevantTracks[trackId];
      if (!track) return;
      const snapshotPoints = dragState.trackSnapshots?.[trackId]?.points;
      const diffs = computeTrackDiffsForDrag({
        trackId,
        trackPoints: track.points,
        snapshotPoints,
        dragState,
        selection: selectionState,
        bounds: constraintBoundsByTrack.get(trackId) ?? boundsForRow,
        attributePath: attributePathsByTrack.get(trackId),
      });
      if (diffs.length === 0) {
        return;
      }
      const basePoints = snapshotPoints ?? track.points;
      const previewPoints = applyTrackDiffsToPoints(basePoints, diffs);
      previewTrackPoints.set(trackId, previewPoints);
      previewPointLookup.set(trackId, new Map(previewPoints.map((point) => [point.id, point])));
    });
  }

  const virtualFrames = computeFrames(relevantTracks, sourceRow, {
    draggingKeypointIds: keypointSelection,
    transformKeypoint: (keypoint, { trackId }) => {
      const lookup = previewPointLookup.get(trackId);
      if (!lookup) return keypoint;
      return lookup.get(keypoint.id) ?? keypoint;
    },
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

        const previewPoints = previewTrackPoints.get(trackId);
        if (!previewPoints) {
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
  const segmentsWithGeometry = interpolations.map((segment) =>
    attachSegmentGeometry(segment, sourceRow, boundsForRow),
  );

  const rowComputedData: ComputedRowData = {
    violationSet,
    virtualFrames,
    interpolations: segmentsWithGeometry,
    verticalBounds: boundsForRow,
  };

  return rowComputedData;
}

function attachSegmentGeometry(
  segment: InstancePair,
  sourceRow: SourceRow,
  verticalBounds: { min: number; max: number },
): InstancePair {
  const rawTransitions: EndpointTransitions = {
    startOut: segment.start.transitions?.out ?? DEFAULT_TRANSITION_OUT,
    endIn: segment.end.transitions?.in ?? DEFAULT_TRANSITION_IN,
  };

  const rawRenderParams = buildSegmentRenderParams({
    sourceRow,
    start: segment.start,
    end: segment.end,
    isEmpty: Boolean(segment.buffer),
    verticalBounds,
    transitions: rawTransitions,
  });

  const splineParams = rawRenderParams[TrackRender.Spline] ?? rawRenderParams[TrackRender.Preview];
  const startValue = splineParams?.start.y ?? 0;
  const endValue = splineParams?.end.y ?? startValue;

  const clampResult = clampMonotonicCubicSegment({
    start: { stamp: segment.start.stamp, value: startValue },
    end: { stamp: segment.end.stamp, value: endValue },
    rawTransitions,
  });

  const effectiveRenderParams = buildSegmentRenderParams({
    sourceRow,
    start: segment.start,
    end: segment.end,
    isEmpty: Boolean(segment.buffer),
    verticalBounds,
    transitions: clampResult.transitionsEffective,
  });

  segment.geometry = {
    raw: {
      transitions: rawTransitions,
      controlPoints: {
        cp1: clampResult.cp1Raw,
        cp2: clampResult.cp2Raw,
      },
      renderParams: rawRenderParams,
    },
    effective: {
      transitions: clampResult.transitionsEffective,
      controlPoints: {
        cp1: clampResult.cp1Effective,
        cp2: clampResult.cp2Effective,
      },
      renderParams: effectiveRenderParams,
    },
    flags: clampResult.flags,
  };

  return segment;
}
