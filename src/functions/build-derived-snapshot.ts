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
import { computeRowData, resolveRowTransform } from "./compute-row-data";
import { sameInputs, type ReusableRow, type ReusableRows } from "./row-reuse";
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
  /** The rows the previous build made, which this one hands on where nothing they read changed. */
  previousRows?: ReusableRows;
}

/** A built snapshot, with its rows as the next build can reuse them. */
export interface BuiltDerivedSnapshot {
  snapshot: DerivedSnapshot;
  rows: ReusableRows;
}

/** A curve that has no value anywhere: a track nothing could compile. */
const noCurve = () => undefined;

export function buildDerivedSnapshot(inputs: BuildDerivedSnapshotInputs): DerivedSnapshot {
  return buildDerivedSnapshotWithRows(inputs).snapshot;
}

export function buildDerivedSnapshotWithRows(
  inputs: BuildDerivedSnapshotInputs,
): BuiltDerivedSnapshot {
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
  // A duration reads every track in its animation, and every track of every
  // instance of that animation needs it: resolve each animation's once.
  const durations = new Map<Animation, number>();
  const durationOf = (animation: Animation) => {
    let duration = durations.get(animation);
    if (duration === undefined) {
      duration = resolveAnimationDuration(animation, inputs.tracks);
      durations.set(animation, duration);
    }
    return duration;
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
        const compiledCurve = trackCurve(track as unknown as SimpleTrack, inputs.trackEvaluator);
        const canonicalCurve = compiledCurve ?? noCurve;
        const animDuration = durationOf(animation);
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
  // Most recently compiled first. A check compiles its track's curve again
  // once the curve cache has evicted it, and with more tracks than the cache
  // holds, asking in compile order would find every one evicted, each
  // compile evicting the next one asked for. In reverse, only those past the
  // cache's size compile again.
  const canonicalViolations = provider?.canonical([...subjects].reverse(), inputs.trackEvaluator);
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
  const reusableRows = new Map<string, ReusableRow>();
  const rowContext = {
    animations: inputs.animations,
    namespaces: inputs.namespaces,
    trackEvaluator: inputs.trackEvaluator,
    previewViolations,
    durationOf,
  };
  Object.values(inputs.instancedTrackSources).forEach((sourceRow) => {
    const rowInputs = rowInputsOf(sourceRow, inputs, canonicalViolationsByTrackKey, rowContext);
    const previous = inputs.previousRows?.get(sourceRow.id);
    // Rows a drag reaches are computed on every build: those drawn from its
    // preview, and its anchor row, which takes the anchor's frame id whether
    // or not the preview is showing (focus may have left the drag's instance).
    const drawsDrag =
      Boolean(inputs.dragState) &&
      (sourceRow.id === inputs.dragState?.anchor?.rowId ||
        (shouldPreview && sourceRow.data.some((datum) => draggedTrackIds?.has(datum.trackId))));
    if (previous && !drawsDrag && sameInputs(previous.inputs, rowInputs)) {
      derivedRows[sourceRow.id] = previous.row;
      previous.samples.forEach(([id, sample]) => {
        renderSampleCache.samples[id] = sample;
      });
      previous.trackIndex.forEach(([key, entry]) => {
        renderSampleCache.trackIndex![key] = entry;
      });
      reusableRows.set(sourceRow.id, { ...previous, inputs: rowInputs });
      return;
    }

    // A row reads and writes only its own entries in the sample cache (they
    // are keyed by row), so it fills a cache of its own, merged in after.
    // Its entries are then known without searching the build's whole cache.
    const rowSamples: RenderSampleCache = { samples: {}, trackIndex: {} };
    const computed = computeRowData(
      sourceRow,
      inputs.tracks,
      canonicalViolationsByTrackKey,
      inputs.animatables,
      inputs.dragState,
      inputs.selectionState,
      rowContext,
      dragPreviewCache,
      rowSamples,
    );
    Object.assign(renderSampleCache.samples, rowSamples.samples);
    Object.assign(renderSampleCache.trackIndex!, rowSamples.trackIndex);

    const trackKeys = sourceRow.data.map((data) =>
      buildTrackKey(data.namespaceId, data.instanceId, data.trackId),
    );

    const row = {
      id: sourceRow.id,
      trackKeys,
      computed,
    };
    derivedRows[sourceRow.id] = row;
    // A row drawn from a drag preview is computed again on every build, so it
    // is not kept for reuse.
    if (!drawsDrag) {
      reusableRows.set(sourceRow.id, {
        inputs: rowInputs,
        row,
        samples: Object.entries(rowSamples.samples),
        trackIndex: Object.entries(rowSamples.trackIndex ?? {}),
      });
    }
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
        durationMs: durationOf(context.animation),
        timescale: context.instance.settings.timescale,
      };
      // Asked even when the editor cannot compile the preview curve: a provider
      // may judge the motion without the evaluator, and the rows that draw
      // this track ask it too, so the two must agree.
      const violations = previewViolations
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
    snapshot: {
      version: inputs.version,
      dragContext,
      tracks: derivedTracks,
      rows: derivedRows,
      renderSampleCache:
        Object.keys(renderSampleCache.samples).length > 0 ? renderSampleCache : undefined,
    },
    rows: reusableRows,
  };
}

/**
 * Everything a row reads outside a drag, in a fixed order, so two builds can
 * tell whether the row would come out the same. Store objects are frozen and
 * replaced when they change, so their identity stands for their content.
 *
 * - The source row itself (which entries, in which order, visible or not).
 * - Per entry: its track, the track's animatable, its animation, and the
 *   canonical violations of its track instance. A provider may return the
 *   same violations array for an unchanged result, so the violations do not
 *   stand in for the track or the animatable.
 * - The row's time transform, by value: it comes from the first namespace
 *   holding the row's instance, which need not be the entry's own.
 * - The evaluator, which draws value curves.
 * - Whether a drag preview is showing at all, and the drag's handle edits.
 *
 * Some of these are wider than any row reads today, and are kept because a
 * missing input fails silently (a stale row) while an extra one only costs a
 * recompute. Outside a drag a row reads its animation only to check that it
 * exists. A row with no dragged track gets the same result whether a preview
 * shows or not, and handle edits are keyed by the keys being dragged.
 *
 * Objects the host supplies (the evaluator, animatables) are compared by
 * identity too, so a host must replace one to change it: editing one in place
 * leaves every row that read it as it was.
 */
function rowInputsOf(
  sourceRow: SourceRow,
  inputs: BuildDerivedSnapshotInputs,
  violations: Record<TrackKey, Violation[]>,
  context: Parameters<typeof resolveRowTransform>[1],
): unknown[] {
  const shouldPreview = inputs.selectionState.instanceId === inputs.dragState?.instanceId;
  const transform = resolveRowTransform(sourceRow, context);
  const values: unknown[] = [
    sourceRow,
    inputs.trackEvaluator,
    shouldPreview,
    shouldPreview ? inputs.dragState?.handleDiffs : undefined,
    transform.scaleX,
    transform.scaleY,
    transform.offsetX,
    transform.offsetY,
  ];
  sourceRow.data.forEach((datum) => {
    const track = inputs.tracks[datum.trackId];
    values.push(
      track,
      track ? inputs.animatables[track.animatableId] : undefined,
      inputs.animations[datum.animationId],
      datum.namespaceId && datum.instanceId
        ? violations[buildTrackKey(datum.namespaceId, datum.instanceId, datum.trackId)]
        : undefined,
    );
  });
  return values;
}

/**
 * A dragged track's preview violations, judged once per distinct projection on
 * one build. Rows that draw the same track instance usually project it the
 * same way and share the result; a row that projects it differently (a
 * vertical drag scales a non-anchor track by its own row's range) gets its own.
 */
export function sharedPreviewViolations(
  provider: FeedbackProvider,
  evaluator: TrackEvaluator | undefined,
): (subject: FeedbackSubject) => Violation[] {
  const judged = new Map<TrackKey, { subject: FeedbackSubject; violations: Violation[] }[]>();
  return (subject) => {
    const candidates = judged.get(subject.trackKey) ?? [];
    const match = candidates.find(
      ({ subject: seen }) =>
        // The track key joins its parts with "/", which any of them may hold.
        seen.namespaceId === subject.namespaceId &&
        seen.instanceId === subject.instanceId &&
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
