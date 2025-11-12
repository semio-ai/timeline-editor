import { describe, expect, test } from "vitest";
import {
  buildDerivedSnapshot,
  computeTrackInterpolator,
  computeTrackViolations,
  computeRowData,
} from "../../functions";
import { createTestAnimationStore } from "../../test-fixtures";
import { parseTrackKey } from "../../utils/track-key";
import { TrackRender } from "../../types";
import type { TrackKey, Violation } from "../../types";

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
      expect(rowSnapshot.computed.interpolations.length).toEqual(legacyRow.interpolations.length);
    });

    const rowWithSegments = Object.values(snapshot.rows).find(
      (row) => row.computed.interpolations.length > 0,
    );
    if (!rowWithSegments) {
      throw new Error("Expected at least one row with interpolation geometry");
    }
    const firstSegment = rowWithSegments.computed.interpolations[0];
    expect(firstSegment.geometry?.raw?.transitions?.startOut).toBeDefined();
    expect(firstSegment.geometry?.effective?.controlPoints?.cp1).toBeDefined();
    expect(firstSegment.geometry?.effective?.renderParams?.[TrackRender.Transition]).toBeDefined();
  });
});
