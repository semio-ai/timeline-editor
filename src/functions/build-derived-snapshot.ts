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
import type { ProjectedTrackView, SelectionCleanup, TrackDiffOp } from "../types/util/diff";
import { computeTrackInterpolator } from "./compute-track-interpolator";
import { computeDerivativeInterpolator } from "./compute-derivative-interpolator";
import { computeTrackViolations } from "./compute-track-violations";
import { computeRowData } from "./compute-row-data";
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
  const trackContextByKey = new Map<
    TrackKey,
    {
      track: Track<RawValue>;
      animation: Animation;
      namespaceId: string;
      instance: Namespace["animationInstances"][string];
      animatable: AnimatableValue;
    }
  >();
  const dragPreviewCache = inputs.dragState
    ? {
        trackViews: new Map<TrackKey, ProjectedTrackView>(),
        pendingDiffsByTrackId: new Map<string, TrackDiffOp[]>(),
        selectionCleanups: [] as SelectionCleanup[],
      }
    : undefined;

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

        canonicalViolationsByTrackKey[trackKey] = canonicalViolations;
        trackContextByKey.set(trackKey, {
          track,
          animation,
          namespaceId: namespace.id,
          instance,
          animatable,
        });
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
      dragPreviewCache,
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

  if (dragPreviewCache) {
    dragPreviewCache.trackViews.forEach((view, trackKey) => {
      const target = derivedTracks[trackKey];
      const context = trackContextByKey.get(trackKey);
      if (!target || !context) {
        return;
      }
      const previewEffectivePoints = applyEffectiveTransitions(view.points);
      const previewTrack: Track<RawValue> = { ...context.track, points: previewEffectivePoints };
      const previewInterpolator = computeTrackInterpolator(previewTrack, context.instance);
      const previewViolations = computeTrackViolations(
        previewInterpolator,
        context.animation.duration,
        view.trackId,
        context.namespaceId,
        context.instance.id,
        context.animatable,
      );
      target.preview = {
        interpolator: previewInterpolator,
        violations: previewViolations,
      };
    });
  }

  const pendingDiffs =
    dragPreviewCache && dragPreviewCache.pendingDiffsByTrackId.size > 0
      ? Array.from(dragPreviewCache.pendingDiffsByTrackId.values()).flat()
      : inputs.dragState?.pendingDiffs;
  const pendingSelectionCleanups =
    dragPreviewCache && dragPreviewCache.selectionCleanups.length > 0
      ? dragPreviewCache.selectionCleanups
      : inputs.dragState?.pendingSelectionCleanups;
  const projectedTracks =
    dragPreviewCache && dragPreviewCache.trackViews.size > 0
      ? Array.from(dragPreviewCache.trackViews.values())
      : inputs.dragState?.projectedTracks;

  const dragContext =
    inputs.dragState && (pendingDiffs || projectedTracks || pendingSelectionCleanups)
      ? {
          ...inputs.dragState,
          pendingDiffs,
          pendingSelectionCleanups,
          projectedTracks,
        }
      : inputs.dragState;

  return {
    version: inputs.version,
    dragContext,
    tracks: derivedTracks,
    rows: derivedRows,
  };
}
