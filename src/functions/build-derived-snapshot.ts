import { AnimatableValue, RawValue } from "@semio/data";
import { isEqual } from "lodash";
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
import { computeRowData } from "./compute-row-data";
import {
  computeSubjectViolations,
  type FeedbackProvider,
  type FeedbackSubject,
} from "./feedback-provider";
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
  /**
   * Judges the motion for violations. Without one, every violation is computed
   * afresh on this build; with one, the provider may answer from what it
   * computed before, and a dragged track's preview is judged once per distinct
   * projection on the build, not once per row that draws it.
   */
  feedbackProvider?: FeedbackProvider;
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
          viewsByTrackId: new Map<string, ProjectedTrackView>(),
          pendingDiffsByTrackId: new Map<string, TrackDiffOp[]>(),
          selectionCleanups: [] as SelectionCleanup[],
          draggedTrackIds: draggedTrackIds ?? new Set<string>(),
        }
      : undefined;
  const renderSampleCache: RenderSampleCache = { samples: {}, trackIndex: {} };
  const subjects: FeedbackSubject[] = [];

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
        subjects.push({
          trackKey,
          trackId,
          namespaceId: namespace.id,
          instanceId: instance.id,
          track,
          animatable,
          durationMs: animDuration,
          timescale: instance.settings.timescale,
        });

        derivedTracks[trackKey] = {
          canonical: {
            curve: canonicalCurve,
            derivative: canonicalDerivative,
            violations: [],
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

  const provider = inputs.feedbackProvider;
  const canonicalViolations = provider?.canonical(subjects, inputs.trackEvaluator);
  subjects.forEach((subject) => {
    const violations =
      canonicalViolations?.get(subject.trackKey) ??
      computeSubjectViolations(subject, inputs.trackEvaluator);
    derivedTracks[subject.trackKey].canonical.violations = violations;
    canonicalViolationsByTrackKey[subject.trackKey] = violations;
  });
  const previewViolations = provider
    ? sharedPreviewViolations(provider, inputs.trackEvaluator)
    : undefined;

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
        previewViolations,
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
      const subject: FeedbackSubject = {
        trackKey,
        trackId: view.trackId,
        namespaceId: context.namespaceId,
        instanceId: context.instance.id,
        track: previewTrack,
        animatable: context.animatable,
        durationMs: resolveAnimationDuration(context.animation, inputs.tracks),
        timescale: context.instance.settings.timescale,
      };
      // An uncompiled curve has no values to check.
      const violations = !previewCurve
        ? []
        : previewViolations
          ? previewViolations(subject)
          : computeSubjectViolations(subject, inputs.trackEvaluator);
      target.preview = {
        track: previewTrack,
        curve: previewCurve ?? noCurve,
        violations,
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

/**
 * A dragged track's preview violations, judged once per distinct projection on
 * one build. Rows that draw the same track instance usually project it the
 * same way and share the result; a row that projects it differently (a
 * vertical drag scales a non-anchor track by its own row's range) gets its own.
 */
function sharedPreviewViolations(
  provider: FeedbackProvider,
  evaluator: TrackEvaluator | undefined,
): (subject: FeedbackSubject) => Violation[] {
  const judged = new Map<TrackKey, { subject: FeedbackSubject; violations: Violation[] }[]>();
  return (subject) => {
    const candidates = judged.get(subject.trackKey) ?? [];
    const match = candidates.find(
      ({ subject: seen }) =>
        seen.trackId === subject.trackId &&
        seen.durationMs === subject.durationMs &&
        Object.is(seen.timescale, subject.timescale) &&
        seen.animatable === subject.animatable &&
        isEqual(seen.track, subject.track),
    );
    if (match) return match.violations;
    const violations = provider.preview(subject, evaluator);
    candidates.push({ subject, violations });
    judged.set(subject.trackKey, candidates);
    return violations;
  };
}
