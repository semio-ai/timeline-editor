import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clipBaker } from "../module-clip/clip-baker";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  createMinimalAnimationStore,
  createTestAnimationStore,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { clickMarkerWith } from "../selection/selection-test-helpers";
import { buildTrackKey } from "../../utils/track-key";
import { computeLocalStamp, computeWorldStamp } from "../../functions/compute-instance-time";
import { trackValueAt } from "../../functions/track-value-at";

describe("values drag preview behavior", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createMinimalAnimationStore({ trackBaker: clipBaker });

    store.setState((state) => ({
      tracks: {
        ...state.tracks,
        [TRACK_IDS.SCALE]: {
          ...state.tracks[TRACK_IDS.SCALE],
          points: [
            { id: "s0", stamp: 0, value: 1 },
            { id: "s1", stamp: 1000, value: 1 },
            { id: "s2", stamp: 2000, value: 1 },
          ],
        },
      },
    }));

    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
  });

  afterEach(() => {
    store.getState().cancelDrag();
    cleanup?.();
  });

  it("reads the preview curve while dragging", async () => {
    const stamp = 1000;
    const state = store.getState();
    const rowEntry = Object.entries(state.instancedTrackSources).find(([, row]) =>
      row.data.some((entry) => entry.trackId === TRACK_IDS.SCALE),
    );
    if (!rowEntry) {
      throw new Error("Row containing scale track not found");
    }
    const [rowId, sourceRow] = rowEntry;
    const row = state.derivedSnapshot?.rows?.[rowId]?.computed;
    if (!row) {
      throw new Error("Missing computed row data for drag preview test");
    }

    const markerFrame = row.selection?.find((frame) =>
      frame.points.some((point) => point.markerId === "s1"),
    );
    if (!markerFrame) {
      throw new Error("Marker frame not found for drag preview test");
    }

    clickMarkerWith(store, rowId, markerFrame.id);

    store.getState().startDrag({
      axis: "vertical",
      markerId: markerFrame.id,
      rowId,
    });

    store.getState().updateDrag({
      normalizedValueDelta: 0.1,
      modifiers: { alt: false, shift: false, meta: false },
    });

    await flushMicrotasks();

    const namespaceId = sourceRow.data[0]?.namespaceId ?? "default";
    const instanceId = sourceRow.data[0]?.instanceId ?? "main";
    const track = store.getState().tracks[TRACK_IDS.SCALE];
    const trackKey = buildTrackKey(namespaceId, instanceId, TRACK_IDS.SCALE);
    const snapshot = store.getState().derivedSnapshot;
    const previewInterpolator = snapshot?.tracks[trackKey]?.preview?.curve;
    const canonicalInterpolator = snapshot?.tracks[trackKey]?.canonical.curve;

    if (!track || !previewInterpolator || !canonicalInterpolator) {
      throw new Error("Missing curves for drag preview test");
    }

    const instance = store.getState().namespaces[namespaceId].animationInstances[instanceId];
    const localStamp = computeLocalStamp(
      stamp,
      instance.settings.timescale,
      instance.settings.offset,
    );

    const expected = previewInterpolator(localStamp);
    const canonical = canonicalInterpolator(localStamp);
    const lookup = buildTrackKey(namespaceId, instanceId, TRACK_IDS.SCALE);
    const actual = trackValueAt(store.getState().derivedSnapshot, lookup, stamp);

    if (
      typeof expected !== "number" ||
      typeof canonical !== "number" ||
      typeof actual !== "number"
    ) {
      throw new Error("Expected numeric values for drag preview test");
    }

    expect(actual).toBeCloseTo(expected);
    expect(actual).not.toBeCloseTo(canonical);
  });

  it("reads preview values for timescaled instances while dragging", async () => {
    const storeWithInstances = createTestAnimationStore({
      trackBaker: clipBaker,
      activeInstance: INSTANCE_IDS.BETA_SHARED,
    });
    const cleanupInstances = storeWithInstances.getState().initAnimationSubscriptions();
    await flushMicrotasks();

    try {
      const state = storeWithInstances.getState();
      const instance =
        state.namespaces[NAMESPACE_IDS.BETA].animationInstances[INSTANCE_IDS.BETA_SHARED];
      const worldStamp = computeWorldStamp(
        300,
        instance.settings.timescale,
        instance.settings.offset,
      );
      const rowEntry = Object.entries(state.instancedTrackSources).find(([, row]) =>
        row.data.some(
          (entry) =>
            entry.trackId === TRACK_IDS.OPACITY &&
            entry.namespaceId === NAMESPACE_IDS.BETA &&
            entry.instanceId === INSTANCE_IDS.BETA_SHARED,
        ),
      );
      if (!rowEntry) {
        throw new Error("Row containing beta opacity track not found");
      }
      const [rowId] = rowEntry;
      const row = state.derivedSnapshot?.rows?.[rowId]?.computed;
      if (!row) {
        throw new Error("Missing computed row data for timescaled drag preview test");
      }

      const markerFrame = row.selection?.find((frame) =>
        frame.points.some((point) => point.markerId === "o1"),
      );
      if (!markerFrame) {
        throw new Error("Opacity marker frame not found for drag preview test");
      }

      clickMarkerWith(storeWithInstances, rowId, "o1");

      storeWithInstances.getState().startDrag({
        axis: "vertical",
        markerId: markerFrame.id,
        rowId,
      });

      storeWithInstances.getState().updateDrag({
        normalizedValueDelta: -0.1,
        modifiers: { alt: false, shift: false, meta: false },
      });

      await flushMicrotasks();

      const snapshot = storeWithInstances.getState().derivedSnapshot;
      const trackKey = buildTrackKey(
        NAMESPACE_IDS.BETA,
        INSTANCE_IDS.BETA_SHARED,
        TRACK_IDS.OPACITY,
      );
      const previewInterpolator = snapshot?.tracks[trackKey]?.preview?.curve;
      const canonicalInterpolator = snapshot?.tracks[trackKey]?.canonical.curve;
      if (!previewInterpolator || !canonicalInterpolator) {
        throw new Error("Missing interpolators for timescaled drag preview test");
      }

      const localStamp = computeLocalStamp(
        worldStamp,
        instance.settings.timescale,
        instance.settings.offset,
      );
      const expected = previewInterpolator(localStamp);
      const canonical = canonicalInterpolator(localStamp);
      const lookup = buildTrackKey(NAMESPACE_IDS.BETA, INSTANCE_IDS.BETA_SHARED, TRACK_IDS.OPACITY);
      const actual = trackValueAt(
        storeWithInstances.getState().derivedSnapshot,
        lookup,
        worldStamp,
      );

      if (
        typeof expected !== "number" ||
        typeof canonical !== "number" ||
        typeof actual !== "number"
      ) {
        throw new Error("Expected numeric values for timescaled drag preview test");
      }

      expect(actual).toBeCloseTo(expected);
      expect(actual).not.toBeCloseTo(canonical);
    } finally {
      cleanupInstances();
    }
  });
});
