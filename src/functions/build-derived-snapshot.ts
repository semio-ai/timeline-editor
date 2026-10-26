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
  RenderSampleCache,
} from "../types";
import { buildTrackKey } from "../utils/track-key";
import type { ProjectedTrackView, SelectionCleanup, TrackDiffOp } from "../types/util/diff";
import type { SimpleTrack } from "../types/data/simple-track";
import { computeInstanceTrackViolations } from "./compute-track-violations";
import { computeRowData } from "./compute-row-data";
import { resolveDraggedTrackIds } from "./resolve-dragged-track-ids";
import { resolveAnimationDuration } from "./compute-animation-extent";
import { trackCurve, type TrackEvaluator } from "./track-curve";

export interface BuildDerivedSnapshotInputs {
  tracks: Record<string, Track<RawValue>>;
  namespaces: Record<string, Namespace>;
  animations: Record<string, Animation>;
  animatables: Record<string, AnimatableValue>;
  instancedTrackSources: Record<string, SourceRow>;
  dragState: DragState | undefined;
  selectionState: SelectionState;
  /** Evaluates each track's curve; without it no track has one. */
  trackEvaluator?: TrackEvaluator;
  version?: number;
}

/** A curve that has no value anywhere: a track nothing could compile. */
const noCurve = () => undefined;

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
  const shouldPreview = Boolean(inputs.selectionState.instanceId === inputs.dragState?.instanceId);
  const draggedTrackIds = shouldPreview
    ? resolveDraggedTrackIds(inputs.dragState, inputs.selectionState)
    : undefined;
  const dragPreviewCache =
    shouldPreview && inputs.dragState
      ? {
          trackViews: new Map<TrackKey, ProjectedTrackView>(),
          pendingDiffsByTrackId: new Map<string, TrackDiffOp[]>(),
          selectionCleanups: [] as SelectionCleanup[],
          draggedTrackIds: draggedTrackIds ?? new Set<string>(),
        }
      : undefined;
  const renderSampleCache: RenderSampleCache = { samples: {}, trackIndex: {} };

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
        const compiledCurve = trackCurve(track as unknown as SimpleTrack, inputs.trackEvaluator);
        const canonicalCurve = compiledCurve ?? noCurve;
        const animDuration = resolveAnimationDuration(animation, inputs.tracks);
        const canonicalDerivative = compiledCurve?.velocity ?? noCurve;
        // An uncompiled curve has no values to check.
        const canonicalViolations = !compiledCurve
          ? []
          : computeInstanceTrackViolations(
              compiledCurve,
              animDuration,
              instance.settings.timescale,
              trackId,
              namespace.id,
              instance.id,
              animatable,
            );

        derivedTracks[trackKey] = {
          canonical: {
            curve: canonicalCurve,
            derivative: canonicalDerivative,
            violations: canonicalViolations,
          },
          metadata: {
            trackId,
            namespaceId: namespace.id,
            instanceId: instance.id,
            animatableId: track.animatableId,
            duration: animDuration,
            timescale: instance.settings.timescale,
            offset: instance.settings.offset,
            muted: track.settings?.muted,
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
        trackEvaluator: inputs.trackEvaluator,
      },
      dragPreviewCache,
      renderSampleCache,
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
      const previewTrack: Track<RawValue> = { ...context.track, points: view.points };
      const previewCurve = trackCurve(
        previewTrack as unknown as SimpleTrack,
        inputs.trackEvaluator,
      );
      const previewViolations = !previewCurve
        ? []
        : computeInstanceTrackViolations(
            previewCurve,
            resolveAnimationDuration(context.animation, inputs.tracks),
            context.instance.settings.timescale,
            view.trackId,
            context.namespaceId,
            context.instance.id,
            context.animatable,
          );
      target.preview = {
        curve: previewCurve ?? noCurve,
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
  const dragContext =
    inputs.dragState && (pendingDiffs || pendingSelectionCleanups)
      ? {
          ...inputs.dragState,
          pendingDiffs,
          pendingSelectionCleanups,
        }
      : inputs.dragState;

  return {
    version: inputs.version,
    dragContext,
    tracks: derivedTracks,
    rows: derivedRows,
    renderSampleCache:
      Object.keys(renderSampleCache.samples).length > 0 ? renderSampleCache : undefined,
  };
}
