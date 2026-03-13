import { describe, expect, test } from "vitest";
import {
  buildDerivedSnapshot,
  computeTrackInterpolator,
  computeTrackViolations,
  computeRowData,
  materializeSegmentSample,
} from "../../functions";
import { createTestAnimationStore } from "../../test-fixtures";
import { parseTrackKey, buildTrackKey } from "../../utils/track-key";
import { TrackRender } from "../../types";
import type { DragState, TrackKey, Violation } from "../../types";
import { createEmptySelectionState } from "../../functions/selection-state-manager";
import {
  TRACK_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
} from "../../test-fixtures/animation-store-factory";

describe("buildDerivedSnapshot", () => {
  test("matches existing per-track and per-row computations in test store", () => {
    const store = createTestAnimationStore();
    const state = store.getState();

    const snapshot = buildDerivedSnapshot({
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: state.dragState,
      selectionState: state.selectionState,
      version: 1,
    });

    const canonicalViolationsByTrackKey: Partial<Record<TrackKey, Violation[]>> = {};

    Object.entries(snapshot.tracks).forEach(([trackKey, derivedTrack]) => {
      const { namespaceId, instanceId, trackId } = parseTrackKey(trackKey);
      const namespace = state.namespaces[namespaceId];
      const instance = namespace?.animationInstances?.[instanceId];
      const track = state.tracks[trackId];
      const animation = instance ? state.animations[instance.animationId] : undefined;
      const animatable = track ? state.animatables[track.animatableId] : undefined;

      if (!namespace || !instance || !track || !animation || !animatable) {
        throw new Error(`Missing canonical data for track key ${trackKey}`);
      }

      const interpolator = computeTrackInterpolator(track, instance);
      const violations = computeTrackViolations(
        interpolator,
        animation.duration,
        trackId,
        namespaceId,
        instanceId,
        animatable,
      );

      canonicalViolationsByTrackKey[trackKey as TrackKey] = violations;

      expect(derivedTrack.canonical.violations.length).toEqual(violations.length);

      const snapshotValue = derivedTrack.canonical.interpolator(0.5);
      const legacyValue = interpolator(0.5);
      if (typeof snapshotValue === "number" && typeof legacyValue === "number") {
        expect(snapshotValue).toBeCloseTo(legacyValue);
      } else {
        expect(snapshotValue).toEqual(legacyValue);
      }
    });

    Object.entries(snapshot.rows).forEach(([rowId, rowSnapshot]) => {
      const sourceRow = state.instancedTrackSources[rowId];
      if (!sourceRow) throw new Error(`Missing source row for ${rowId}`);

      const legacyRow = computeRowData(
        sourceRow,
        state.tracks,
        canonicalViolationsByTrackKey,
        state.animatables,
        state.dragState,
        state.selectionState,
        {
          animations: state.animations,
          namespaces: state.namespaces,
        },
      );

      expect(rowSnapshot.computed.virtualFrames.length).toEqual(legacyRow.virtualFrames.length);
      const snapshotSegments = rowSnapshot.computed.render?.segments ?? [];
      const legacySegments = legacyRow.render?.segments ?? [];
      expect(snapshotSegments.length).toEqual(legacySegments.length);
    });

    const rowWithSegments = Object.values(snapshot.rows).find(
      (row) => (row.computed.render?.segments ?? []).length > 0,
    );
    if (!rowWithSegments) {
      throw new Error("Expected at least one row with interpolation geometry");
    }
    const firstSegment = rowWithSegments.computed.render?.segments?.[0];
    expect(firstSegment).toBeDefined();
    const transitionSample = firstSegment?.samples?.[TrackRender.Transition];
    if (transitionSample) {
      const resolved = materializeSegmentSample(transitionSample, snapshot.renderSampleCache);
      expect(resolved?.points.length ?? 0).toBeGreaterThan(0);
    }
    expect(firstSegment?.startKeypointId).toBeDefined();
  });

  test("builds preview interpolators for all instances sharing a dragged track", () => {
    const store = createTestAnimationStore();
    const state = store.getState();

    const trackId = TRACK_IDS.SCALE;
    const track = state.tracks[trackId];
    const anchorPoint = track.points[0];
    if (!anchorPoint || typeof anchorPoint.value !== "number") {
      throw new Error("Expected numeric anchor point for preview test");
    }

    const namespaceId = NAMESPACE_IDS.ALPHA;
    const instanceId = INSTANCE_IDS.ALPHA_SHARED;
    const otherNamespaceId = NAMESPACE_IDS.BETA;
    const otherInstanceId = INSTANCE_IDS.BETA_SHARED;

    const rowEntry = Object.entries(state.instancedTrackSources).find(([, row]) =>
      row.data.some(
        (entry) =>
          entry.trackId === trackId &&
          entry.namespaceId === namespaceId &&
          entry.instanceId === instanceId,
      ),
    );
    if (!rowEntry) {
      throw new Error("Row containing dragged track not found");
    }
    const [rowId] = rowEntry;

    const selectionState = createEmptySelectionState(instanceId);
    selectionState.keypoints.set(trackId, new Set([anchorPoint.id]));

    const instance = state.namespaces[namespaceId]?.animationInstances?.[instanceId];
    if (!instance) {
      throw new Error("Missing instance for preview test");
    }

    const dragState: DragState = {
      axis: "vertical",
      instanceId,
      instanceTransform: {
        offset: instance.settings.offset,
        timescale: instance.settings.timescale,
      },
      anchor: {
        keypointId: anchorPoint.id,
        trackId,
        rowId,
        valueScale: { domain: [0, 2], clamp: false },
      },
      anchorValueOrigin: anchorPoint.value,
      normalizedValueDelta: 1,
      modifiers: { alt: false, shift: false, meta: false },
    };

    const snapshot = buildDerivedSnapshot({
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState,
      selectionState,
      version: 2,
    });

    const activeKey = buildTrackKey(namespaceId, instanceId, trackId);
    const otherKey = buildTrackKey(otherNamespaceId, otherInstanceId, trackId);

    expect(snapshot.tracks[activeKey]?.preview?.interpolator).toBeDefined();
    expect(snapshot.tracks[otherKey]?.preview?.interpolator).toBeDefined();
  });
});
