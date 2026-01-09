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
import { computeTrackInterpolator } from "./compute-track-interpolator";
import { computeDerivativeInterpolator } from "./compute-derivative-interpolator";
import { computeTrackViolations } from "./compute-track-violations";
import { computeRowData } from "./compute-row-data";
import { resolveDraggedTrackIds } from "./resolve-dragged-track-ids";

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
  const shouldPreview = Boolean(
    inputs.dragState && inputs.selectionState.instanceId === inputs.dragState.instanceId,
  );
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
        const canonicalInterpolator = computeTrackInterpolator(track, instance);
        const canonicalDerivative = computeDerivativeInterpolator(
          canonicalInterpolator,
          animation.duration,
        );
        const timescale = instance.settings.timescale ?? 1;
        const durationScale =
          Number.isFinite(timescale) && timescale !== 0 ? Math.abs(timescale) : 1;
        const violationDuration = animation.duration / durationScale;
        const canonicalViolations = computeTrackViolations(
          canonicalInterpolator,
          violationDuration,
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
            trackId,
            namespaceId: namespace.id,
            instanceId: instance.id,
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
      const previewInterpolator = computeTrackInterpolator(previewTrack, context.instance);
      const previewTimescale = context.instance.settings.timescale ?? 1;
      const previewScale =
        Number.isFinite(previewTimescale) && previewTimescale !== 0
          ? Math.abs(previewTimescale)
          : 1;
      const previewDuration = context.animation.duration / previewScale;
      const previewViolations = computeTrackViolations(
        previewInterpolator,
        previewDuration,
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
    dragOverlay:
      shouldPreview && inputs.dragState
        ? {
            state: {
              instanceId: inputs.dragState.instanceId,
              axis: inputs.dragState.axis,
              anchor: {
                keypointId: inputs.dragState.anchor.keypointId,
                trackId: inputs.dragState.anchor.trackId,
                rowId: inputs.dragState.anchor.rowId,
                namespaceId: inputs.dragState.anchor.namespaceId,
                instanceId: inputs.dragState.anchor.instanceId,
              },
              trackSnapshots: inputs.dragState.trackSnapshots,
              stampDelta: inputs.dragState.stampDelta,
              normalizedValueDelta: inputs.dragState.normalizedValueDelta,
              handleDiffs: inputs.dragState.handleDiffs,
              pendingDiffs,
              pendingSelectionCleanups,
            },
            draggedTrackIds:
              dragPreviewCache?.draggedTrackIds ?? draggedTrackIds ?? new Set<string>(),
          }
        : undefined,
    tracks: derivedTracks,
    rows: derivedRows,
    renderSampleCache:
      Object.keys(renderSampleCache.samples).length > 0 ? renderSampleCache : undefined,
  };
}
