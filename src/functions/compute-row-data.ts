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
  TransitionHandleKind,
  TransitionPairing,
  InstancedFrameInfo,
} from "../types";
import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import { buildTrackKey } from "../utils/track-key";
import type { ProjectedTrackView, SelectionCleanup, TrackDiffOp } from "../types/util/diff";
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
import { resolveTransitionDelta } from "./get-world-control-points";

const PAIRING_FLAT_TOLERANCE_RAD = (3 * Math.PI) / 180;

interface RowComputationContext {
  animations: Record<string, Animation>;
  namespaces: Record<string, Namespace>;
}

export interface DragPreviewCache {
  trackViews: Map<TrackKey, ProjectedTrackView>;
  pendingDiffsByTrackId: Map<string, TrackDiffOp[]>;
  selectionCleanups: SelectionCleanup[];
}

export function computeRowData(
  sourceRow: SourceRow,
  tracks: Record<string, Track<RawValue>>,
  violations: Partial<Record<TrackKey, Violation[]>>,
  animatables: Record<string, AnimatableValue>,
  dragState: DragState | undefined,
  selectionState: SelectionState,
  context?: RowComputationContext,
  previewCache?: DragPreviewCache,
): ComputedRowData {
  const trackIds = uniq(sourceRow.data.map((t) => t.trackId));
  const instanceIds = new Set(sourceRow.data.map((t) => t.instanceId));
  const namespaceIds = new Set(sourceRow.data.map((t) => t.namespaceId));
  const trackContextByTrackId = new Map<
    string,
    { animationId: string; namespaceId: string; instanceId: string }
  >();
  sourceRow.data.forEach((datum) => {
    const existing = trackContextByTrackId.get(datum.trackId);
    const isActiveInstance = datum.instanceId === dragState?.instanceId;
    if (!existing || isActiveInstance) {
      trackContextByTrackId.set(datum.trackId, {
        animationId: datum.animationId,
        namespaceId: datum.namespaceId,
        instanceId: datum.instanceId,
      });
    }
  });

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
  ): { min: number; max: number } | undefined => {
    if (!animatable) return undefined;
    const constraints = (animatable as any)?.constraints;

    if (animatable.type !== "number") {
      return undefined;
    }

    const min = typeof constraints?.min === "number" ? constraints.min : undefined;
    const max = typeof constraints?.max === "number" ? constraints.max : undefined;
    return min !== undefined && max !== undefined ? { min, max } : undefined;
  };

  trackIds.forEach((trackId) => {
    const track = relevantTracks[trackId];
    if (!track) {
      constraintBoundsByTrack.set(trackId, undefined);
      return;
    }

    const animatable = animatables[track.animatableId];
    const bounds = resolveConstraintBounds(animatable);
    constraintBoundsByTrack.set(trackId, bounds);
  });

  const handleDiffs =
    dragState && selectionState.instanceId === dragState.instanceId
      ? dragState.handleDiffs
      : undefined;

  const previewByTrackId = new Map<
    string,
    {
      projectedPoints: Keypoint<RawValue>[];
      framePoints: Keypoint<RawValue>[];
      diffs: TrackDiffOp[];
      selectionCleanup?: SelectionCleanup;
    }
  >();
  const projectedPointLookup = new Map<string, Map<string, Keypoint<RawValue>>>();
  const anchorTrackId = dragState?.anchor?.trackId;
  const anchorKeypointId = dragState?.anchor?.keypointId;
  const EPSILON = 1e-6;

  const shouldPreview = dragState && selectionState.instanceId === dragState.instanceId;

  if (shouldPreview) {
    trackIds.forEach((trackId) => {
      const track = relevantTracks[trackId];
      if (!track) return;
      const snapshotPoints = dragState.trackSnapshots?.[trackId]?.points;
      const { projectedPoints, framePoints, diffs, selectionCleanup } = computeDragDiffOps({
        trackId,
        trackPoints: track.points,
        snapshotPoints,
        dragState,
        selection: selectionState,
        bounds: constraintBoundsByTrack.get(trackId) ?? boundsForRow,
      });

      // Overlay handle diffs so preview consumers (violations, interpolator) see updated transitions
      let previewPoints = projectedPoints;
      let markerPoints = framePoints;
      if (handleDiffs) {
        const patchTransitions = (point: Keypoint<RawValue>): Keypoint<RawValue> => {
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
          if (diff.pairing !== undefined) {
            nextTransitions.pairing = diff.pairing;
          }
          return {
            ...point,
            transitions: nextTransitions,
          };
        };
        previewPoints = previewPoints.map(patchTransitions);
        markerPoints = markerPoints.map(patchTransitions);
      }

      previewByTrackId.set(trackId, {
        projectedPoints: previewPoints,
        framePoints: markerPoints,
        diffs,
        selectionCleanup,
      });
    });
  }

  const projectedTracks: Record<string, Track<RawValue>> = {};
  const markerTracks: Record<string, Track<RawValue>> = {};
  const projectedSourceRow: SourceRow = { ...sourceRow, data: [] };
  const markerSourceRow: SourceRow = { ...sourceRow, data: [] };

  sourceRow.data.forEach((datum) => {
    const baseTrack = relevantTracks[datum.trackId];
    if (!baseTrack) return;
    const trackKey = buildTrackKey(datum.namespaceId, datum.instanceId, datum.trackId);

    const preview = previewByTrackId.get(datum.trackId);
    const usePreview = Boolean(
      preview && shouldPreview && datum.instanceId === dragState?.instanceId,
    );

    let projectedPoints = usePreview ? (preview?.projectedPoints ?? []) : baseTrack.points;
    const framePoints = usePreview ? (preview?.framePoints ?? []) : baseTrack.points;

    if (
      usePreview &&
      anchorTrackId &&
      anchorKeypointId &&
      datum.trackId === anchorTrackId &&
      selectionState.instanceId === dragState?.instanceId
    ) {
      const anchorPoint = projectedPoints.find((p) => p.id === anchorKeypointId);
      if (anchorPoint) {
        projectedPoints = projectedPoints.filter(
          (p) => p.id === anchorKeypointId || Math.abs(p.stamp - anchorPoint.stamp) >= EPSILON,
        );
      }
    }

    projectedPointLookup.set(trackKey, new Map(projectedPoints.map((point) => [point.id, point])));

    projectedTracks[trackKey] = {
      ...baseTrack,
      id: trackKey,
      points: projectedPoints.slice(),
    } as Track<RawValue>;
    projectedSourceRow.data.push({
      ...(datum as SourceRowData),
      trackId: trackKey,
      trackIdBase: datum.trackId,
    } as SourceRowData);

    markerTracks[trackKey] = {
      ...baseTrack,
      id: trackKey,
      points: framePoints.slice(),
    } as Track<RawValue>;
    markerSourceRow.data.push({
      ...(datum as SourceRowData),
      trackId: trackKey,
      trackIdBase: datum.trackId,
    } as SourceRowData);

    if (usePreview && preview && previewCache) {
      previewCache.trackViews.set(trackKey, {
        trackKey,
        trackId: datum.trackId,
        points: projectedPoints,
        framePoints,
        appliedDiffs: preview.diffs,
        selectionCleanup: preview.selectionCleanup,
      });
      if (!previewCache.pendingDiffsByTrackId.has(datum.trackId)) {
        previewCache.pendingDiffsByTrackId.set(datum.trackId, preview.diffs);
      }
      if (
        preview.selectionCleanup &&
        !previewCache.selectionCleanups.some((cleanup) => cleanup.trackId === datum.trackId)
      ) {
        previewCache.selectionCleanups.push(preview.selectionCleanup);
      }
    }
  });

  // Projected frames for geometry/interpolations/violations
  const projectedFrames = computeFrames(projectedTracks, projectedSourceRow, {
    draggingKeypointIds: keypointSelection,
    transformKeypoint: (keypoint, { source }) => {
      const baseTrackId: string = (source as any).trackIdBase ?? source.trackId;
      const lookupKey = buildTrackKey(source.namespaceId, source.instanceId, baseTrackId);
      const lookup = projectedPointLookup.get(lookupKey);
      if (!lookup) return keypoint;
      return lookup.get(keypoint.id) ?? keypoint;
    },
    ignoreDraggingState: true,
    anchorFrameKey: dragState?.anchor?.keypointId,
    anchorFrameId: sourceRow.id === dragState?.anchor?.rowId ? dragState?.anchorFrameId : undefined,
    anchorNamespaceId: dragState?.anchor?.namespaceId,
    anchorInstanceId: dragState?.anchor?.instanceId,
  });

  // Marker frames: duplicate per sourceRow entry to keep aggregate/global markers distinct
  const markerFrames = computeFrames(markerTracks, markerSourceRow, {
    draggingKeypointIds: keypointSelection,
    transformKeypoint: (keypoint, { source }) => {
      const baseTrackId: string = (source as any).trackIdBase ?? source.trackId;
      const lookupKey = buildTrackKey(source.namespaceId, source.instanceId, baseTrackId);
      const lookup = projectedPointLookup.get(lookupKey);
      if (!lookup) return keypoint;
      return lookup.get(keypoint.id) ?? keypoint;
    },
    ignoreDraggingState: true,
    anchorFrameKey: dragState?.anchor?.keypointId,
    anchorFrameId: sourceRow.id === dragState?.anchor?.rowId ? dragState?.anchorFrameId : undefined,
    anchorNamespaceId: dragState?.anchor?.namespaceId,
    anchorInstanceId: dragState?.anchor?.instanceId,
  });

  const pairingByPointId = resolvePairingByPoint(projectedTracks);
  const projectedFramesWithPairing = applyPairingToFrames(projectedFrames, pairingByPointId);
  const markerFramesWithPairing = applyPairingToFrames(markerFrames, pairingByPointId);

  const explicitInterpolationSegments = computeTransitionSegments(
    projectedFramesWithPairing,
    trackIds,
  );
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

    sourceRow.data.forEach((entry) => {
      const track = relevantTracks[entry.trackId];
      if (!track) return;
      const preview = previewByTrackId.get(entry.trackId);
      const usePreview = Boolean(
        preview &&
          selectionState.instanceId === dragState?.instanceId &&
          entry.instanceId === dragState?.instanceId,
      );

      const previewPoints = usePreview && preview ? preview.projectedPoints : track.points;
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

      const animation = context.animations[entry.animationId];
      const namespace = context.namespaces[entry.namespaceId];
      const instance = namespace?.animationInstances?.[entry.instanceId];
      const animatable = animatables[track.animatableId];
      if (!animation || !instance || !animatable) {
        return;
      }
      const interpolator = computeTrackInterpolator(previewTrack, instance);
      const previewViolations = computeTrackViolations(
        interpolator,
        animation.duration,
        track.id,
        entry.namespaceId,
        entry.instanceId,
        animatable,
      );
      const existing = effectiveViolations[entry.trackId] ?? [];
      const withoutDraggedInstance = usePreview
        ? existing.filter(
            (violation) =>
              violation.instanceId !== entry.instanceId ||
              violation.namespace !== entry.namespaceId,
          )
        : existing;
      effectiveViolations[entry.trackId] = [...withoutDraggedInstance, ...previewViolations];
    });
  }

  const violationSet = computeViolationSet(
    shouldPreviewViolations ? effectiveViolations : filteredViolations,
  );

  const rowComputedData: ComputedRowData = {
    violationSet,
    virtualFrames: markerFramesWithPairing,
    interpolations: segmentsWithGeometry,
    verticalBounds: boundsForRow,
  };

  return rowComputedData;
}

function resolvePairingByPoint(
  tracks: Record<string, Track<RawValue>>,
): Map<string, TransitionPairing | undefined> {
  const pairingByPoint = new Map<string, TransitionPairing | undefined>();

  Object.values(tracks).forEach((track) => {
    const sorted = [...track.points].sort((a, b) => a.stamp - b.stamp);
    sorted.forEach((point, idx) => {
      if (pairingByPoint.has(point.id)) return;
      const explicit = point.transitions?.pairing;
      if (explicit) {
        pairingByPoint.set(point.id, explicit);
        return;
      }
      const prev = idx > 0 ? sorted[idx - 1] : undefined;
      const next = idx < sorted.length - 1 ? sorted[idx + 1] : undefined;
      if (!prev || !next) {
        pairingByPoint.set(point.id, undefined);
        return;
      }
      if (typeof prev.value !== "number" || typeof next.value !== "number") {
        pairingByPoint.set(point.id, undefined);
        return;
      }
      const inTransition = point.transitions?.in ?? StandardTransitionType.Cubic;
      const outTransition = point.transitions?.out ?? StandardTransitionType.Cubic;

      const inDelta = resolveTransitionDelta(
        "in",
        prev.stamp,
        point.stamp,
        prev.value as number,
        point.value as number,
        inTransition,
      );
      const outDelta = resolveTransitionDelta(
        "out",
        point.stamp,
        next.stamp,
        point.value as number,
        next.value as number,
        outTransition,
      );
      if (!inDelta || !outDelta) {
        pairingByPoint.set(point.id, undefined);
        return;
      }
      const inLen = Math.hypot(inDelta.x, inDelta.y);
      const outLen = Math.hypot(outDelta.x, outDelta.y);
      if (inLen === 0 || outLen === 0) {
        pairingByPoint.set(point.id, undefined);
        return;
      }
      const dot = (inDelta.x * outDelta.x + inDelta.y * outDelta.y) / (inLen * outLen);
      const clampedDot = Math.max(-1, Math.min(1, dot));
      const angle = Math.acos(clampedDot);
      const inferred =
        Math.abs(Math.PI - angle) <= PAIRING_FLAT_TOLERANCE_RAD
          ? TransitionPairing.Paired
          : TransitionPairing.Free;
      pairingByPoint.set(point.id, inferred);
    });
  });

  return pairingByPoint;
}

function applyPairingToFrames(
  frames: InstancedFrameInfo[],
  pairingByPointId: Map<string, TransitionPairing | undefined>,
): InstancedFrameInfo[] {
  return frames.map((frame) => {
    if (!frame.transitions) return frame;
    const pointId = frame.points.length === 1 ? frame.points[0]?.id : undefined;
    const pairing = pointId ? pairingByPointId.get(pointId) : undefined;
    if (!pairing || frame.transitions.pairing === pairing) return frame;
    return { ...frame, transitions: { ...frame.transitions, pairing } };
  });
}

function resolveHandleKind(transition?: RawVector2 | StandardTransitionType): TransitionHandleKind {
  if (transition && typeof transition === "object") {
    return TransitionHandleKind.Explicit;
  }
  return TransitionHandleKind.Easing;
}

function attachSegmentGeometry(
  segment: InstancePair,
  sourceRow: SourceRow,
  verticalBounds: { min: number; max: number },
  handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2; pairing?: TransitionPairing }>,
): InstancePair {
  const startOutTransition = handleDiffs?.[segment.start.id]?.out ?? segment.start.transitions?.out;
  const endInTransition = handleDiffs?.[segment.end.id]?.in ?? segment.end.transitions?.in;
  const rawTransitions: EndpointTransitions = {
    startOut: startOutTransition ?? DEFAULT_TRANSITION_OUT,
    endIn: endInTransition ?? DEFAULT_TRANSITION_IN,
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
      handles: {
        startOut: clampResult.cp1Raw
          ? {
              world: clampResult.cp1Raw,
              kind: resolveHandleKind(startOutTransition),
            }
          : undefined,
        endIn: clampResult.cp2Raw
          ? {
              world: clampResult.cp2Raw,
              kind: resolveHandleKind(endInTransition),
            }
          : undefined,
      },
      renderParams: rawRenderParams,
    },
    effective: {
      transitions: clampResult.transitionsEffective,
      controlPoints: {
        cp1: clampResult.cp1Effective,
        cp2: clampResult.cp2Effective,
      },
      handles: {
        startOut: clampResult.cp1Effective
          ? {
              world: clampResult.cp1Effective,
              kind: resolveHandleKind(startOutTransition),
            }
          : undefined,
        endIn: clampResult.cp2Effective
          ? {
              world: clampResult.cp2Effective,
              kind: resolveHandleKind(endInTransition),
            }
          : undefined,
      },
      renderParams: effectiveRenderParams,
    },
    flags: clampResult.flags,
  };

  return segment;
}
