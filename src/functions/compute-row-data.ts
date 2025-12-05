import { AnimatableValue, RawValue, RawVector2 } from "@semio/utils";
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
  StandardTransitionType,
  SourceRowData,
} from "../types";
import { TYPE_FIELDS, DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import { buildTrackKey } from "../utils/track-key";
import { computeDragDiffOps } from "./drag-diff-ops";
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
  const trackContextByTrackId = new Map<
    string,
    { animationId: string; namespaceId: string; instanceId: string }
  >();
  sourceRow.data.forEach((datum) => {
    if (!trackContextByTrackId.has(datum.trackId)) {
      trackContextByTrackId.set(datum.trackId, {
        animationId: datum.animationId,
        namespaceId: datum.namespaceId,
        instanceId: datum.instanceId,
      });
    }
  });
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

  const handleDiffs =
    dragState && selectionState.instanceId === dragState.instanceId
      ? dragState.handleDiffs
      : undefined;

  const markerTrackPoints = new Map<string, Keypoint<RawValue>[]>();
  const projectedPointLookup = new Map<string, Map<string, Keypoint<RawValue>>>();
  const frameTrackKeyToBase = new Map<string, string>();
  const anchorTrackId = dragState?.anchor?.trackId;
  const anchorKeypointId = dragState?.anchor?.keypointId;
  const EPSILON = 1e-6;

  if (dragState && selectionState.instanceId === dragState.instanceId) {
    trackIds.forEach((trackId) => {
      const track = relevantTracks[trackId];
      if (!track) return;
      const snapshotPoints = dragState.trackSnapshots?.[trackId]?.points;
      const { projectedPoints, framePoints } = computeDragDiffOps({
        trackId,
        trackPoints: track.points,
        snapshotPoints,
        dragState,
        selection: selectionState,
        bounds: constraintBoundsByTrack.get(trackId) ?? boundsForRow,
        attributePath: attributePathsByTrack.get(trackId),
      });
      let previewPoints = projectedPoints;
      const markerPoints = framePoints;

      // Overlay handle diffs so preview consumers (violations, interpolator) see updated transitions
      if (handleDiffs) {
        const patched = previewPoints.map((point) => {
          const diff = handleDiffs[point.id];
          if (!diff?.in && !diff?.out) {
            return point;
          }
          const nextTransitions = { ...(point.transitions ?? {}) };
          if (diff.out) {
            nextTransitions.out = diff.out;
          }
          if (diff.in) {
            nextTransitions.in = diff.in;
          }
          return {
            ...point,
            transitions: nextTransitions,
          };
        });
        previewPoints = patched;
      }

      markerTrackPoints.set(trackId, markerPoints);
      projectedPointLookup.set(trackId, new Map(projectedPoints.map((point) => [point.id, point])));
    });
  }

  // Build adjusted tracks for preview:
  // - Apply preview points (drag deltas / handle diffs)
  // - Build projected tracks for geometry/violations (hide coincident non-dragged points in the dragged track)
  const adjustedTracks: Record<string, Track<RawValue>> = {};
  const projectedTracks: Record<string, Track<RawValue>> = {};

  trackIds.forEach((trackId) => {
    const baseTrack = relevantTracks[trackId];
    if (!baseTrack) return;
    const previewPoints = markerTrackPoints.get(trackId) ?? baseTrack.points;

    adjustedTracks[trackId] = {
      ...baseTrack,
      points: previewPoints.slice(),
    } as Track<RawValue>;

    let projectedPoints = previewPoints;
    if (
      anchorTrackId &&
      anchorKeypointId &&
      trackId === anchorTrackId &&
      selectionState.instanceId === dragState?.instanceId
    ) {
      const anchorPoint = previewPoints.find((p) => p.id === anchorKeypointId);
      if (anchorPoint) {
        projectedPoints = previewPoints.filter(
          (p) => p.id === anchorKeypointId || Math.abs(p.stamp - anchorPoint.stamp) >= EPSILON,
        );
      }
    }

    projectedTracks[trackId] = {
      ...baseTrack,
      points: projectedPoints.slice(),
    } as Track<RawValue>;
  });

  // Projected frames for geometry/interpolations/violations
  const projectedFrames = computeFrames(projectedTracks, sourceRow, {
    draggingKeypointIds: keypointSelection,
    transformKeypoint: (keypoint, { trackId }) => {
      const lookup = projectedPointLookup.get(trackId);
      if (!lookup) return keypoint;
      return lookup.get(keypoint.id) ?? keypoint;
    },
    ignoreDraggingState: true,
    anchorFrameKey: dragState?.anchor?.keypointId,
  });

  // Marker frames: duplicate per sourceRow entry to keep aggregate/global markers distinct
  // Marker frames: duplicate per sourceRow entry to keep aggregate/global markers distinct,
  // while preserving the base trackId for selection/drag logic.
  const markerTracks: Record<string, Track<RawValue>> = {};
  const markerSourceRow: SourceRow = { ...sourceRow, data: [] };
  sourceRow.data.forEach((datum) => {
    const baseTrack = relevantTracks[datum.trackId];
    if (!baseTrack) return;
    const markerTrackId = `${datum.namespaceId ?? "ns"}/${datum.instanceId ?? "inst"}/${datum.trackId}`;
    const previewPoints =
      projectedTracks[datum.trackId]?.points ??
      markerTrackPoints.get(datum.trackId) ??
      baseTrack.points;
    markerTracks[markerTrackId] = {
      ...baseTrack,
      id: markerTrackId,
      points: previewPoints.slice(),
    } as Track<RawValue>;
    frameTrackKeyToBase.set(markerTrackId, datum.trackId);
    markerSourceRow.data.push({
      ...datum,
      trackId: markerTrackId,
      trackIdBase: datum.trackId,
    } as SourceRowData);
  });

  const markerFrames = computeFrames(markerTracks, markerSourceRow, {
    draggingKeypointIds: keypointSelection,
    transformKeypoint: (keypoint, { trackId }) => {
      const baseTrackId = frameTrackKeyToBase.get(trackId) ?? trackId;
      const lookup = projectedPointLookup.get(baseTrackId);
      if (!lookup) return keypoint;
      return lookup.get(keypoint.id) ?? keypoint;
    },
    ignoreDraggingState: true,
    anchorFrameKey: dragState?.anchor?.keypointId,
  });

  const explicitInterpolationSegments = computeTransitionSegments(projectedFrames, trackIds);
  const interpolations = computeFilledInterpGaps(explicitInterpolationSegments);

  const segmentsWithGeometry = interpolations.map((segment) =>
    attachSegmentGeometry(segment, sourceRow, boundsForRow, handleDiffs),
  );

  const hasMatchingInstance =
    dragState &&
    selectionState.instanceId === dragState.instanceId &&
    sourceRow.data.some((entry) => entry.instanceId === dragState.instanceId);

  const shouldPreviewViolations = Boolean(
    hasMatchingInstance && context?.animations && context?.namespaces,
  );

  const effectiveViolations: Record<string, Violation[]> = { ...filteredViolations };

  if (shouldPreviewViolations && context?.animations && context?.namespaces) {
    // Map effective transitions from derived geometry so violations follow the clamped curve.
    const effectiveTransitionByPoint = new Map<
      string,
      { in?: RawVector2 | StandardTransitionType; out?: RawVector2 | StandardTransitionType }
    >();
    segmentsWithGeometry.forEach((segment) => {
      const startTransitions = segment.geometry?.effective?.transitions;
      const endTransitions = segment.geometry?.effective?.transitions;
      if (startTransitions?.startOut) {
        const existing = effectiveTransitionByPoint.get(segment.start.id) ?? {};
        effectiveTransitionByPoint.set(segment.start.id, {
          ...existing,
          out: startTransitions.startOut,
        });
      }
      if (endTransitions?.endIn) {
        const existing = effectiveTransitionByPoint.get(segment.end.id) ?? {};
        effectiveTransitionByPoint.set(segment.end.id, {
          ...existing,
          in: endTransitions.endIn,
        });
      }
    });

    trackIds.forEach((trackId) => {
      const track = relevantTracks[trackId];
      const contextEntry = trackContextByTrackId.get(trackId);
      if (!track || !contextEntry) {
        return;
      }
      // Only preview for the active drag instance
      if (contextEntry.instanceId !== dragState?.instanceId) {
        return;
      }
      const animation = context.animations[contextEntry.animationId];
      const namespace = context.namespaces[contextEntry.namespaceId];
      const instance = namespace?.animationInstances?.[contextEntry.instanceId];
      const animatable = animatables[track.animatableId];
      if (!animation || !instance || !animatable) {
        return;
      }

      const previewPoints =
        projectedTracks[trackId]?.points ?? markerTrackPoints.get(trackId) ?? track.points;
      const pointsWithEffectiveTransitions = previewPoints.map((point) => {
        const overrides = effectiveTransitionByPoint.get(point.id);
        if (!overrides?.in && !overrides?.out) {
          return point;
        }
        const nextTransitions = { ...(point.transitions ?? {}) };
        if (overrides.out) {
          nextTransitions.out = overrides.out;
        }
        if (overrides.in) {
          nextTransitions.in = overrides.in;
        }
        return {
          ...point,
          transitions: nextTransitions,
        };
      });

      const previewTrack: Track<RawValue> = {
        ...track,
        points: [...pointsWithEffectiveTransitions].sort((a, b) => a.stamp - b.stamp),
      };

      const interpolator = computeTrackInterpolator(previewTrack, instance);
      const previewViolations = computeTrackViolations(
        interpolator,
        animation.duration,
        trackId,
        contextEntry.namespaceId,
        contextEntry.instanceId,
        animatable,
      );
      effectiveViolations[trackId] = previewViolations;
    });
  }

  const violationSet = computeViolationSet(
    shouldPreviewViolations ? effectiveViolations : filteredViolations,
  );

  const rowComputedData: ComputedRowData = {
    violationSet,
    virtualFrames: markerFrames,
    interpolations: segmentsWithGeometry,
    verticalBounds: boundsForRow,
  };

  return rowComputedData;
}

function attachSegmentGeometry(
  segment: InstancePair,
  sourceRow: SourceRow,
  verticalBounds: { min: number; max: number },
  handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2 }>,
): InstancePair {
  const rawTransitions: EndpointTransitions = {
    startOut:
      handleDiffs?.[segment.start.id]?.out ??
      segment.start.transitions?.out ??
      DEFAULT_TRANSITION_OUT,
    endIn:
      handleDiffs?.[segment.end.id]?.in ?? segment.end.transitions?.in ?? DEFAULT_TRANSITION_IN,
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
