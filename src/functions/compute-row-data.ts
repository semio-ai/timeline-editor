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
  RenderMarker,
  RenderSegment,
  RenderHandle,
  SelectionFrame,
  SegmentSample,
  RenderSampleCache,
  RenderSampleId,
  AffineTransform2D,
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
import { buildRenderParamsFromControlPoints } from "./compute-transition-params";
import { resolveSegmentControlPoints } from "./resolve-segment-control-points";
import { extractFrameNumericValue } from "./segment-value-utils";
import { resolveTransitionDelta } from "./get-world-control-points";
import { resolveDraggedTrackIds } from "./resolve-dragged-track-ids";
import type { TransitionParams } from "./compute-transition-params";

const SEGMENT_SAMPLE_RESOLUTION = 50;
const IDENTITY_TRANSFORM: AffineTransform2D = {
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
};

const PAIRING_FLAT_TOLERANCE_RAD = (3 * Math.PI) / 180;

interface RowComputationContext {
  animations: Record<string, Animation>;
  namespaces: Record<string, Namespace>;
}

export interface DragPreviewCache {
  trackViews: Map<TrackKey, ProjectedTrackView>;
  pendingDiffsByTrackId: Map<string, TrackDiffOp[]>;
  selectionCleanups: SelectionCleanup[];
  draggedTrackIds: Set<string>;
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
  renderSampleCache?: RenderSampleCache,
): ComputedRowData {
  const trackIds = uniq(sourceRow.data.map((t) => t.trackId));
  const instanceIds = new Set(sourceRow.data.map((t) => t.instanceId));
  const namespaceIds = new Set(sourceRow.data.map((t) => t.namespaceId));

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
  const rowTransform = resolveRowTransform(sourceRow, context);

  const shouldPreview = Boolean(dragState && selectionState.instanceId === dragState.instanceId);
  const draggedTrackIds = shouldPreview
    ? (previewCache?.draggedTrackIds ?? resolveDraggedTrackIds(dragState, selectionState))
    : undefined;

  const keypointSelection = shouldPreview
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

  const handleDiffs = shouldPreview ? dragState?.handleDiffs : undefined;

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
  const anchorInstanceId = dragState?.instanceId;
  const anchorNamespaceId =
    dragState?.anchor?.trackId && dragState?.instanceId
      ? sourceRow.data.find(
          (datum) =>
            datum.trackId === dragState.anchor.trackId && datum.instanceId === dragState.instanceId,
        )?.namespaceId
      : undefined;
  const EPSILON = 1e-6;

  if (shouldPreview && dragState && draggedTrackIds && draggedTrackIds.size > 0) {
    draggedTrackIds.forEach((trackId) => {
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
    const usePreview = Boolean(preview && shouldPreview && draggedTrackIds?.has(datum.trackId));

    let projectedPoints = usePreview ? (preview?.projectedPoints ?? []) : baseTrack.points;
    const framePoints = usePreview ? (preview?.framePoints ?? []) : baseTrack.points;

    if (
      usePreview &&
      anchorTrackId &&
      anchorKeypointId &&
      datum.trackId === anchorTrackId &&
      selectionState.instanceId === dragState?.instanceId &&
      datum.instanceId === dragState?.instanceId
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
    anchorNamespaceId,
    anchorInstanceId,
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
    anchorNamespaceId,
    anchorInstanceId,
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

  const shouldPreviewViolations = Boolean(
    shouldPreview && context?.animations && context?.namespaces,
  );

  const effectiveViolations: Record<string, Violation[]> = { ...filteredViolations };

  if (shouldPreviewViolations && context?.animations && context?.namespaces) {
    sourceRow.data.forEach((entry) => {
      if (!draggedTrackIds?.has(entry.trackId)) {
        return;
      }
      const track = relevantTracks[entry.trackId];
      if (!track) return;
      const preview = previewByTrackId.get(entry.trackId);
      const usePreview = Boolean(preview && shouldPreview && draggedTrackIds?.has(entry.trackId));

      const previewPoints = usePreview && preview ? preview.projectedPoints : track.points;
      const previewTrack: Track<RawValue> = {
        ...track,
        points: [...previewPoints].sort((a, b) => a.stamp - b.stamp),
      };

      const animation = context.animations[entry.animationId];
      const namespace = context.namespaces[entry.namespaceId];
      const instance = namespace?.animationInstances?.[entry.instanceId];
      const animatable = animatables[track.animatableId];
      if (!animation || !instance || !animatable) {
        return;
      }
      const timescale = instance.settings.timescale ?? 1;
      const durationScale = Number.isFinite(timescale) && timescale !== 0 ? Math.abs(timescale) : 1;
      const violationDuration = animation.duration / durationScale;
      const interpolator = computeTrackInterpolator(previewTrack, instance);
      const previewViolations = computeTrackViolations(
        interpolator,
        violationDuration,
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

  const renderMarkers = buildRenderMarkers(markerFramesWithPairing, boundsForRow);
  const selectionFrames = buildSelectionFrames(markerFramesWithPairing, renderMarkers);
  const renderSegments = buildRenderSegments(
    segmentsWithGeometry,
    sourceRow,
    renderSampleCache,
    rowTransform,
  );
  const renderHandles = buildRenderHandles(segmentsWithGeometry, sourceRow);

  const rowComputedData: ComputedRowData = {
    violationSet,
    virtualFrames: markerFramesWithPairing,
    verticalBounds: boundsForRow,
    valueBounds: boundsForRow,
    selection: selectionFrames,
    render: {
      markers: renderMarkers,
      handles: renderHandles,
      segments: renderSegments,
    },
  };

  return rowComputedData;
}

function buildRenderMarkers(
  frames: InstancedFrameInfo[],
  bounds: { min: number; max: number },
): RenderMarker[] {
  const markers: RenderMarker[] = [];
  const span = bounds.max - bounds.min;
  const hasSpan = Number.isFinite(span) && span !== 0;

  for (const frame of frames) {
    for (const point of frame.points) {
      const rawValue = point.value;
      let numericValue: number | null = null;
      if (typeof rawValue === "number") {
        numericValue = rawValue;
      } else if (typeof rawValue === "boolean") {
        numericValue = rawValue ? 1 : 0;
      } else {
        // Skip string-valued tracks in the canvas for now.
        continue;
      }

      const normalized = hasSpan ? (numericValue - bounds.min) / span : 0.5;
      const y = normalized - 0.5;

      markers.push({
        id: point.id,
        trackId: point.trackId,
        trackKey: buildTrackKey(point.namespaceId, point.instanceId, point.trackId),
        namespaceId: point.namespaceId,
        instanceId: point.instanceId,
        animationId: point.animationId,
        animatableId: point.animatableId,
        valueType: typeof rawValue as "number" | "string" | "boolean",
        iconCode: point.iconCode,
        editable: point.editable,
        selectable: point.selectable,
        layerBand: point.layerBand,
        stamp: frame.stamp,
        value: numericValue,
        x: frame.stamp,
        y,
      });
    }
  }

  return markers;
}

function buildSelectionFrames(
  frames: InstancedFrameInfo[],
  markers: RenderMarker[],
): SelectionFrame[] {
  const markerKeys = new Set(markers.map((marker) => `${marker.trackKey}#${marker.id}`));
  const selectionFrames: SelectionFrame[] = [];

  for (const frame of frames) {
    const points = frame.points
      .filter((point) => {
        const trackKey = buildTrackKey(point.namespaceId, point.instanceId, point.trackId);
        return markerKeys.has(`${trackKey}#${point.id}`);
      })
      .map((point) => ({
        markerId: point.id,
        trackId: point.trackId,
        trackKey: buildTrackKey(point.namespaceId, point.instanceId, point.trackId),
        namespaceId: point.namespaceId,
        instanceId: point.instanceId,
        selectable: point.selectable,
      }));

    if (points.length === 0) continue;

    selectionFrames.push({
      id: frame.id,
      stamp: frame.stamp,
      points,
    });
  }

  return selectionFrames;
}

function buildRenderSegments(
  segments: InstancePair[],
  sourceRow: SourceRow,
  renderSampleCache: RenderSampleCache | undefined,
  rowTransform: AffineTransform2D,
): RenderSegment[] {
  const fallbackEntry = sourceRow.data[0];
  const segmentPointCount = Math.max(2, SEGMENT_SAMPLE_RESOLUTION + 1);
  const segmentPointLength = segmentPointCount * 2;
  const curveMode = sourceRow.data.length === 1 ? "value" : "flat";

  const segmentDetails = segments.flatMap((segment) => {
    const transitionParams =
      segment.geometry?.effective?.renderParams?.[TrackRender.Transition] ??
      segment.geometry?.raw?.renderParams?.[TrackRender.Transition];
    const splineParams =
      segment.geometry?.effective?.renderParams?.[TrackRender.Spline] ??
      segment.geometry?.effective?.renderParams?.[TrackRender.Preview] ??
      segment.geometry?.raw?.renderParams?.[TrackRender.Spline] ??
      segment.geometry?.raw?.renderParams?.[TrackRender.Preview];
    const keyParams =
      segment.geometry?.effective?.renderParams?.[TrackRender.Key] ??
      segment.geometry?.raw?.renderParams?.[TrackRender.Key];

    if (!transitionParams || !keyParams) {
      return [];
    }

    const startPoint = segment.start.points[0];
    const endPoint = segment.end.points[0];
    const trackId = startPoint?.trackId ?? fallbackEntry?.trackId;
    const namespaceId = startPoint?.namespaceId ?? fallbackEntry?.namespaceId;
    const instanceId = startPoint?.instanceId ?? fallbackEntry?.instanceId;
    if (!trackId || !namespaceId || !instanceId) {
      return [];
    }
    const entry =
      sourceRow.data.find(
        (datum) =>
          datum.trackId === trackId &&
          datum.namespaceId === namespaceId &&
          datum.instanceId === instanceId,
      ) ?? fallbackEntry;
    // Skip string-valued tracks for line rendering.
    if (entry?.type === "string") {
      return [];
    }
    const trackKey = buildTrackKey(namespaceId, instanceId, trackId);
    const startKeypointId = startPoint?.id ?? segment.start.id;
    const endKeypointId = endPoint?.id ?? segment.end.id;

    return [
      {
        id: `${segment.start.id}:${segment.end.id}`,
        trackId,
        trackKey,
        startKeypointId,
        endKeypointId,
        buffer: segment.buffer,
        transitionParams,
        keyParams,
        splineParams,
        startStamp: segment.start.stamp,
        endStamp: segment.end.stamp,
        samples: {} as Partial<Record<TrackRender, SegmentSample>>,
        transform: rowTransform,
      },
    ];
  });

  if (!renderSampleCache) {
    return segmentDetails.map((detail) => {
      const transitionPoints = applySampleTransform(
        sampleCubicBezier(detail.transitionParams, SEGMENT_SAMPLE_RESOLUTION),
        detail.transform,
      );
      const keyPoints = applySampleTransform(
        sampleCubicBezier(detail.keyParams, SEGMENT_SAMPLE_RESOLUTION),
        detail.transform,
      );
      const samples: Partial<Record<TrackRender, SegmentSample>> = {
        [TrackRender.Transition]: {
          kind: "direct",
          points: transitionPoints,
          stride: 2,
        },
        [TrackRender.Key]: {
          kind: "direct",
          points: keyPoints,
          stride: 2,
        },
      };

      if (detail.splineParams) {
        const splinePoints = applySampleTransform(
          sampleCubicBezier(detail.splineParams, SEGMENT_SAMPLE_RESOLUTION),
          detail.transform,
        );
        const splineSample: SegmentSample = {
          kind: "direct",
          points: splinePoints,
          stride: 2,
        };
        samples[TrackRender.Spline] = splineSample;
        samples[TrackRender.Preview] = splineSample;
      }

      return {
        id: detail.id,
        trackId: detail.trackId,
        trackKey: detail.trackKey,
        startKeypointId: detail.startKeypointId,
        endKeypointId: detail.endKeypointId,
        buffer: detail.buffer,
        samples,
      };
    });
  }

  const trackIndex = renderSampleCache.trackIndex ?? {};
  renderSampleCache.trackIndex = trackIndex;
  const segmentsByTrack = new Map<string, typeof segmentDetails>();
  segmentDetails.forEach((detail) => {
    const list = segmentsByTrack.get(detail.trackId) ?? [];
    list.push(detail);
    segmentsByTrack.set(detail.trackId, list);
  });

  segmentsByTrack.forEach((details, trackId) => {
    details.sort(
      (a, b) =>
        a.startStamp - b.startStamp ||
        a.endStamp - b.endStamp ||
        a.startKeypointId.localeCompare(b.startKeypointId),
    );

    const cacheKey = `${trackId}:${curveMode}`;
    const trackEntry = trackIndex[cacheKey] ?? {};
    trackIndex[cacheKey] = trackEntry;

    // Build a per-track shared polyline and assign per-segment ranges (point indices).
    const buildSharedSamples = (
      render: TrackRender,
      list: typeof details,
      getParams: (detail: (typeof details)[number]) => TransitionParams,
    ) => {
      if (list.length === 0) return;

      const sampleId =
        trackEntry[render] ?? (`track:${trackId}:${curveMode}:${render}` as RenderSampleId);
      const expectedLength = list.length * segmentPointLength;
      let cachedSample = renderSampleCache.samples[sampleId];
      if (!cachedSample || cachedSample.points.length !== expectedLength) {
        const points = new Float32Array(expectedLength);
        list.forEach((detail, index) => {
          const segmentPoints = sampleCubicBezier(getParams(detail), SEGMENT_SAMPLE_RESOLUTION);
          points.set(segmentPoints, index * segmentPointLength);
        });
        cachedSample = {
          id: sampleId,
          points,
          stride: 2,
          resolution: SEGMENT_SAMPLE_RESOLUTION,
        };
        renderSampleCache.samples[sampleId] = cachedSample;
      }

      trackEntry[render] = cachedSample.id;
      list.forEach((detail, index) => {
        const startIndex = index * segmentPointCount;
        const endIndex = startIndex + segmentPointCount;
        detail.samples[render] = {
          kind: "shared",
          sampleId: cachedSample.id,
          range: { startIndex, endIndex },
          transform: detail.transform,
        };
      });
    };

    buildSharedSamples(TrackRender.Transition, details, (detail) => detail.transitionParams);
    buildSharedSamples(TrackRender.Key, details, (detail) => detail.keyParams);

    const splineDetails = details.filter((detail) => detail.splineParams);
    if (splineDetails.length > 0) {
      buildSharedSamples(TrackRender.Spline, splineDetails, (detail) => detail.splineParams!);
      splineDetails.forEach((detail) => {
        detail.samples[TrackRender.Preview] = detail.samples[TrackRender.Spline];
      });
    }
  });

  return segmentDetails.map((detail) => ({
    id: detail.id,
    trackId: detail.trackId,
    trackKey: detail.trackKey,
    startKeypointId: detail.startKeypointId,
    endKeypointId: detail.endKeypointId,
    buffer: detail.buffer,
    samples: detail.samples,
  }));
}

function buildRenderHandles(segments: InstancePair[], sourceRow: SourceRow): RenderHandle[] {
  const fallbackEntry = sourceRow.data[0];
  const handles: RenderHandle[] = [];

  segments.forEach((segment) => {
    if (segment.buffer) return;
    const geometry = segment.geometry;
    if (!geometry) return;
    const startPoint = segment.start.points[0];
    const endPoint = segment.end.points[0];
    const trackId = startPoint?.trackId ?? fallbackEntry?.trackId;
    const namespaceId = startPoint?.namespaceId ?? fallbackEntry?.namespaceId;
    const instanceId = startPoint?.instanceId ?? fallbackEntry?.instanceId;
    if (!trackId || !namespaceId || !instanceId) return;

    const trackKey = buildTrackKey(namespaceId, instanceId, trackId);
    const startAnchorId = startPoint?.id ?? segment.start.id;
    const endAnchorId = endPoint?.id ?? segment.end.id;
    const startPairing = segment.start.transitions?.pairing;
    const endPairing = segment.end.transitions?.pairing;

    const rawStartOut = geometry.raw?.handles?.startOut;
    if (rawStartOut?.world) {
      handles.push({
        id: `${startAnchorId}-out`,
        keypointId: startAnchorId,
        neighborKeypointId: endAnchorId,
        trackId,
        trackKey,
        side: "out",
        kind: rawStartOut.kind ?? TransitionHandleKind.Easing,
        pairing: startPairing,
        world: rawStartOut.world,
        effective: geometry.effective?.handles?.startOut?.world,
      });
    }

    const rawEndIn = geometry.raw?.handles?.endIn;
    if (rawEndIn?.world) {
      handles.push({
        id: `${endAnchorId}-in`,
        keypointId: endAnchorId,
        neighborKeypointId: startAnchorId,
        trackId,
        trackKey,
        side: "in",
        kind: rawEndIn.kind ?? TransitionHandleKind.Easing,
        pairing: endPairing,
        world: rawEndIn.world,
        effective: geometry.effective?.handles?.endIn?.world,
      });
    }
  });

  return handles;
}

function sampleCubicBezier(params: TransitionParams, resolution: number): Float32Array {
  const count = Math.max(2, resolution + 1);
  const points = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const a = mt2 * mt;
    const b = 3 * mt2 * t;
    const c = 3 * mt * t2;
    const d = t2 * t;

    const x = a * params.start.x + b * params.cp1.x + c * params.cp2.x + d * params.end.x;
    const y = a * params.start.y + b * params.cp1.y + c * params.cp2.y + d * params.end.y;

    const offset = i * 2;
    points[offset] = x;
    points[offset + 1] = y;
  }

  return points;
}

function isIdentityTransform(transform: AffineTransform2D): boolean {
  return (
    transform.scaleX === 1 &&
    transform.scaleY === 1 &&
    transform.offsetX === 0 &&
    transform.offsetY === 0
  );
}

function applySampleTransform(points: Float32Array, transform: AffineTransform2D): Float32Array {
  if (isIdentityTransform(transform)) {
    return points;
  }
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    points[i] = x * transform.scaleX + transform.offsetX;
    points[i + 1] = y * transform.scaleY + transform.offsetY;
  }
  return points;
}

function resolveRowTransform(
  sourceRow: SourceRow,
  context?: RowComputationContext,
): AffineTransform2D {
  const instanceIds = uniq(
    sourceRow.data.map((entry) => entry.instanceId).filter((id): id is string => Boolean(id)),
  );
  if (instanceIds.length !== 1) {
    return IDENTITY_TRANSFORM;
  }
  if (!context?.namespaces) {
    return IDENTITY_TRANSFORM;
  }

  const instanceId = instanceIds[0];
  for (const namespace of Object.values(context.namespaces)) {
    const instance = namespace.animationInstances[instanceId];
    if (!instance) continue;
    const timescale = instance.settings.timescale ?? 1;
    const offset = instance.settings.offset ?? 0;
    const scaleX = Number.isFinite(timescale) && timescale !== 0 ? 1 / timescale : 1;
    return {
      scaleX,
      scaleY: 1,
      offsetX: offset,
      offsetY: 0,
    };
  }

  return IDENTITY_TRANSFORM;
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

function resolveHandleDiff(
  frame: InstancedFrameInfo,
  handleDiffs:
    | Record<string, { in?: RawVector2; out?: RawVector2; pairing?: TransitionPairing }>
    | undefined,
  side: "in" | "out",
): RawVector2 | undefined {
  if (!handleDiffs) return undefined;
  const direct = handleDiffs[frame.id]?.[side];
  if (direct) return direct;
  const match = frame.points.find((point) => handleDiffs[point.id]?.[side]);
  return match ? handleDiffs[match.id]?.[side] : undefined;
}

function attachSegmentGeometry(
  segment: InstancePair,
  sourceRow: SourceRow,
  _verticalBounds: { min: number; max: number },
  handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2; pairing?: TransitionPairing }>,
): InstancePair {
  const startOutTransition =
    resolveHandleDiff(segment.start, handleDiffs, "out") ?? segment.start.transitions?.out;
  const endInTransition =
    resolveHandleDiff(segment.end, handleDiffs, "in") ?? segment.end.transitions?.in;
  const rawTransitions: EndpointTransitions = {
    startOut: startOutTransition ?? DEFAULT_TRANSITION_OUT,
    endIn: endInTransition ?? DEFAULT_TRANSITION_IN,
  };

  const startValue = extractFrameNumericValue(segment.start);
  const endValue = extractFrameNumericValue(segment.end);
  const hasValues = startValue !== undefined && endValue !== undefined;

  const controlPoints = hasValues
    ? resolveSegmentControlPoints({
        start: { stamp: segment.start.stamp, value: startValue },
        end: { stamp: segment.end.stamp, value: endValue },
        transitions: rawTransitions,
      })
    : undefined;

  const rawRenderParams = buildRenderParamsFromControlPoints({
    startStamp: segment.start.stamp,
    endStamp: segment.end.stamp,
    startValue,
    endValue,
    cp1: controlPoints?.cp1Raw,
    cp2: controlPoints?.cp2Raw,
    isEmpty: Boolean(segment.buffer),
    allowValueCurve: sourceRow.data.length === 1,
  });

  const effectiveTransitions = controlPoints?.effectiveTransitions ?? rawTransitions;
  const effectiveRenderParams = buildRenderParamsFromControlPoints({
    startStamp: segment.start.stamp,
    endStamp: segment.end.stamp,
    startValue,
    endValue,
    cp1: controlPoints?.cp1Effective ?? controlPoints?.cp1Raw,
    cp2: controlPoints?.cp2Effective ?? controlPoints?.cp2Raw,
    isEmpty: Boolean(segment.buffer),
    allowValueCurve: sourceRow.data.length === 1,
  });

  segment.geometry = {
    raw: {
      transitions: rawTransitions,
      controlPoints: {
        cp1: controlPoints?.cp1Raw,
        cp2: controlPoints?.cp2Raw,
      },
      handles: {
        startOut: controlPoints?.cp1Raw
          ? {
              world: controlPoints.cp1Raw,
              kind: resolveHandleKind(startOutTransition),
            }
          : undefined,
        endIn: controlPoints?.cp2Raw
          ? {
              world: controlPoints.cp2Raw,
              kind: resolveHandleKind(endInTransition),
            }
          : undefined,
      },
      renderParams: rawRenderParams,
    },
    effective: {
      transitions: effectiveTransitions,
      controlPoints: {
        cp1: controlPoints?.cp1Effective ?? controlPoints?.cp1Raw,
        cp2: controlPoints?.cp2Effective ?? controlPoints?.cp2Raw,
      },
      handles: {
        startOut:
          (controlPoints?.cp1Effective ?? controlPoints?.cp1Raw)
            ? {
                world: (controlPoints?.cp1Effective ?? controlPoints?.cp1Raw) as RawVector2,
                kind: resolveHandleKind(startOutTransition),
              }
            : undefined,
        endIn:
          (controlPoints?.cp2Effective ?? controlPoints?.cp2Raw)
            ? {
                world: (controlPoints?.cp2Effective ?? controlPoints?.cp2Raw) as RawVector2,
                kind: resolveHandleKind(endInTransition),
              }
            : undefined,
      },
      renderParams: effectiveRenderParams,
    },
    flags: controlPoints?.flags ?? {},
  };

  return segment;
}
