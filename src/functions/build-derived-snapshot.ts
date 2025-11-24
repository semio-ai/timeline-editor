import { AnimatableValue, RawValue } from "@semio/utils";
import {
  Animation,
  DerivedSnapshot,
  DerivedTrackSnapshot,
  DragState,
  Namespace,
  SelectionState,
  SourceRow,
  Track,
  TrackKey,
  Violation,
  EndpointTransitions,
} from "../types";
import { buildTrackKey } from "../utils/track-key";
import { computeTrackInterpolator } from "./compute-track-interpolator";
import { computeDerivativeInterpolator } from "./compute-derivative-interpolator";
import { computeTrackViolations } from "./compute-track-violations";
import { computeRowData } from "./compute-row-data";
import { applyTrackDiffsToPoints, computeTrackDiffsForDrag } from "./apply-drag-deltas";
import { clampMonotonicCubicSegment } from "./clamp-monotonic-cubic-segment";

export interface BuildDerivedSnapshotInputs {
  tracks: Record<string, Track<RawValue>>;
  namespaces: Record<string, Namespace>;
  animations: Record<string, Animation>;
  animatables: Record<string, AnimatableValue>;
  instancedTrackSources: Record<string, SourceRow>;
  dragState: DragState | undefined;
  selectionState: SelectionState;
  version?: number;
}

export function buildDerivedSnapshot(inputs: BuildDerivedSnapshotInputs): DerivedSnapshot {
  const { namespaces, animations, tracks, animatables } = inputs;

  const derivedTracks: Record<TrackKey, DerivedTrackSnapshot> = {};
  const canonicalViolationsByTrackKey: Record<TrackKey, Violation[]> = {};

  const buildPreviewPoints = (
    trackId: string,
    track: Track<RawValue>,
  ): Track<RawValue>["points"] => {
    const dragState = inputs.dragState;
    const selectionState = inputs.selectionState;
    if (!dragState || selectionState.instanceId !== dragState.instanceId) {
      return track.points;
    }

    const snapshotPoints = dragState.trackSnapshots?.[trackId]?.points;
    const diffs = computeTrackDiffsForDrag({
      trackId,
      trackPoints: track.points,
      snapshotPoints,
      dragState,
      selection: selectionState,
      // No bounds or attribute path available at this level; rely on dragState valueScale when present.
    });
    const basePoints = snapshotPoints ?? track.points;
    let previewPoints = diffs.length > 0 ? applyTrackDiffsToPoints(basePoints, diffs) : basePoints;

    const handleDiffs =
      dragState && inputs.selectionState.instanceId === dragState.instanceId
        ? dragState.handleDiffs
        : undefined;

    if (handleDiffs) {
      previewPoints = previewPoints.map((point) => {
        const diff = handleDiffs[point.id];
        if (!diff?.in && !diff?.out) return point;
        const nextTransitions = { ...(point.transitions ?? {}) };
        if (diff.out) nextTransitions.out = diff.out;
        if (diff.in) nextTransitions.in = diff.in;
        return { ...point, transitions: nextTransitions };
      });
    }

    return previewPoints;
  };

  const applyEffectiveTransitions = (
    points: Track<RawValue>["points"],
  ): Track<RawValue>["points"] => {
    if (points.length < 2) return points;
    const transitionMap = new Map<
      string,
      { in?: EndpointTransitions["endIn"]; out?: EndpointTransitions["startOut"] }
    >();
    for (let i = 0; i < points.length - 1; i += 1) {
      const start = points[i];
      const end = points[i + 1];
      if (typeof start.value !== "number" || typeof end.value !== "number") {
        continue;
      }
      const rawTransitions: EndpointTransitions = {
        startOut: start.transitions?.out,
        endIn: end.transitions?.in,
      };
      const result = clampMonotonicCubicSegment({
        start: { stamp: start.stamp, value: start.value },
        end: { stamp: end.stamp, value: end.value },
        rawTransitions,
      });
      const startEntry = transitionMap.get(start.id) ?? {};
      const endEntry = transitionMap.get(end.id) ?? {};
      transitionMap.set(start.id, {
        ...startEntry,
        out: result.transitionsEffective.startOut,
      });
      transitionMap.set(end.id, { ...endEntry, in: result.transitionsEffective.endIn });
    }

    return points.map((point) => {
      const overrides = transitionMap.get(point.id);
      if (!overrides) return point;
      const nextTransitions: {
        in?: EndpointTransitions["endIn"];
        out?: EndpointTransitions["startOut"];
      } = {
        ...(point.transitions ?? {}),
      };
      if (overrides.out !== undefined) {
        nextTransitions.out = overrides.out;
      }
      if (overrides.in !== undefined) {
        nextTransitions.in = overrides.in;
      }
      return { ...point, transitions: nextTransitions };
    });
  };

  Object.values(namespaces).forEach((namespace) => {
    Object.values(namespace.animationInstances).forEach((instance) => {
      const animation = animations[instance.animationId];
      if (!animation) return;

      animation.tracks.forEach((trackId) => {
        const track = tracks[trackId];
        if (!track) return;

        const animatable = animatables[track.animatableId];
        if (!animatable) return;

        const trackKey = buildTrackKey(namespace.id, instance.id, trackId);
        const previewPoints = buildPreviewPoints(trackId, track);
        const previewEffectivePoints = applyEffectiveTransitions(previewPoints);
        const canonicalEffectivePoints = applyEffectiveTransitions(track.points);

        const canonicalTrack: Track<RawValue> = { ...track, points: canonicalEffectivePoints };
        const canonicalInterpolator = computeTrackInterpolator(canonicalTrack, instance);
        const canonicalDerivative = computeDerivativeInterpolator(
          canonicalInterpolator,
          animation.duration,
        );
        const canonicalViolations = computeTrackViolations(
          canonicalInterpolator,
          animation.duration,
          trackId,
          namespace.id,
          instance.id,
          animatable,
        );

        derivedTracks[trackKey] = {
          canonical: {
            interpolator: canonicalInterpolator,
            derivative: canonicalDerivative,
            violations: canonicalViolations,
          },
          metadata: {
            animatableId: track.animatableId,
            duration: animation.duration,
            timescale: instance.settings.timescale,
          },
        };

        const hasPreviewChanges = previewPoints !== track.points;
        if (hasPreviewChanges) {
          const previewTrack: Track<RawValue> = { ...track, points: previewEffectivePoints };
          const previewInterpolator = computeTrackInterpolator(previewTrack, instance);
          const previewViolations = computeTrackViolations(
            previewInterpolator,
            animation.duration,
            trackId,
            namespace.id,
            instance.id,
            animatable,
          );
          derivedTracks[trackKey].preview = {
            interpolator: previewInterpolator,
            violations: previewViolations,
          };
        }

        canonicalViolationsByTrackKey[trackKey] = canonicalViolations;
      });
    });
  });

  const derivedRows: DerivedSnapshot["rows"] = {};
  Object.values(inputs.instancedTrackSources).forEach((sourceRow) => {
    const computed = computeRowData(
      sourceRow,
      inputs.tracks,
      canonicalViolationsByTrackKey,
      inputs.animatables,
      inputs.dragState,
      inputs.selectionState,
      {
        animations: inputs.animations,
        namespaces: inputs.namespaces,
      },
    );

    const trackKeys = sourceRow.data.map((data) =>
      buildTrackKey(data.namespaceId, data.instanceId, data.trackId),
    );

    derivedRows[sourceRow.id] = {
      id: sourceRow.id,
      trackKeys,
      computed,
    };
  });

  return {
    version: inputs.version,
    dragContext: inputs.dragState,
    tracks: derivedTracks,
    rows: derivedRows,
  };
}
