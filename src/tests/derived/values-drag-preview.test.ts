import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testTrackEvaluator } from "../../test-fixtures/track-evaluator";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  createMinimalAnimationStore,
  createTestAnimationStore,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { clickMarkerWith, getMarkerFrame } from "../selection/selection-test-helpers";
import { buildTrackKey } from "../../utils/track-key";
import { computeLocalStamp, computeWorldStamp } from "../../functions/compute-instance-time";
import { trackValueAt } from "../../functions/track-value-at";

describe("values drag preview behavior", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createMinimalAnimationStore({ trackEvaluator: testTrackEvaluator });

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

  it("carries the dragged track as the commit writes it", async () => {
    const state = store.getState();
    const [rowId, sourceRow] =
      Object.entries(state.instancedTrackSources).find(([, row]) =>
        row.data.some((entry) => entry.trackId === TRACK_IDS.SCALE),
      ) ?? [];
    const markerFrame = rowId
      ? state.derivedSnapshot?.rows?.[rowId]?.computed?.selection?.find((frame) =>
          frame.points.some((point) => point.markerId === "s1"),
        )
      : undefined;
    if (!rowId || !sourceRow || !markerFrame) {
      throw new Error("Marker frame not found for drag preview test");
    }
    clickMarkerWith(store, rowId, markerFrame.id);
    store.getState().startDrag({ axis: "vertical", markerId: markerFrame.id, rowId });
    store.getState().updateDrag({
      normalizedValueDelta: 0.1,
      modifiers: { alt: false, shift: false, meta: false },
    });
    await flushMicrotasks();

    const datum = sourceRow.data.find((entry) => entry.trackId === TRACK_IDS.SCALE)!;
    const trackKey = buildTrackKey(datum.namespaceId, datum.instanceId, TRACK_IDS.SCALE);
    const previewed = store.getState().derivedSnapshot?.tracks[trackKey]?.preview?.track;
    expect(previewed?.id).toBe(TRACK_IDS.SCALE);
    // The stored track is untouched while the drag lasts.
    expect(store.getState().tracks[TRACK_IDS.SCALE].points[1].value).toBe(1);
    expect(previewed?.points[1].value).not.toBe(1);

    store.getState().commitDrag();
    await flushMicrotasks();

    const committed = store.getState().tracks[TRACK_IDS.SCALE].points;
    expect(committed.map(({ id, stamp, value }) => ({ id, stamp, value }))).toEqual(
      previewed!.points.map(({ id, stamp, value }) => ({ id, stamp, value })),
    );
  });

  it("previews a shared non-anchor track as its first row projects it, on every instance", async () => {
    const sharedStore = createTestAnimationStore({
      trackEvaluator: testTrackEvaluator,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    // Without min and max constraints, a row scales a non-anchor track's
    // vertical drag by the row's own value range, so rows of different ranges
    // project it differently.
    sharedStore.setState((state) => {
      const animatableId = state.tracks[TRACK_IDS.OPACITY].animatableId;
      const animatable = state.animatables[animatableId];
      if (animatable.type !== "number") {
        throw new Error("Expected a number animatable for opacity");
      }
      const { velocity } = animatable.constraints;
      return {
        animatables: {
          ...state.animatables,
          [animatableId]: { ...animatable, constraints: { velocity } },
        },
      };
    });
    const cleanupShared = sharedStore.getState().initAnimationSubscriptions();
    await flushMicrotasks();

    try {
      // The instance row holds both tracks: drag the frame at s1 with o1's frame
      // selected alongside it, so opacity is a dragged track but not the anchor.
      const instanceRowId = `instance:${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}`;
      const opacityRowId = buildTrackKey(
        NAMESPACE_IDS.ALPHA,
        INSTANCE_IDS.ALPHA_SHARED,
        TRACK_IDS.OPACITY,
      );
      clickMarkerWith(sharedStore, instanceRowId, "s1");
      clickMarkerWith(sharedStore, instanceRowId, "o1", { shift: true });
      sharedStore.getState().startDrag({
        axis: "vertical",
        markerId: getMarkerFrame(sharedStore, instanceRowId, "s1").id,
        rowId: instanceRowId,
      });
      sharedStore.getState().updateDrag({
        normalizedValueDelta: 0.1,
        modifiers: { alt: false, shift: false, meta: false },
      });
      await flushMicrotasks();

      const during = sharedStore.getState();
      expect(during.dragState?.anchor.trackId).not.toBe(TRACK_IDS.OPACITY);
      const drawnValue = (rowId: string) =>
        during.derivedSnapshot?.rows?.[rowId]?.computed?.virtualFrames
          .flatMap((frame) => frame.points)
          .find(
            (point) =>
              point.trackId === TRACK_IDS.OPACITY &&
              point.id === "o1" &&
              point.instanceId === INSTANCE_IDS.ALPHA_SHARED,
          )?.value;
      // The snapshot computes rows in this order; the first one that holds the
      // stored track is the one whose diffs the commit replays.
      const rowIds = Object.entries(during.instancedTrackSources)
        .filter(([, row]) => row.data.some((entry) => entry.trackId === TRACK_IDS.OPACITY))
        .map(([rowId]) => rowId);
      const firstRowValue = drawnValue(rowIds[0]);
      if (typeof firstRowValue !== "number") {
        throw new Error("Missing the first row's projection of the dragged opacity point");
      }
      // Each row still draws its own projection: the track's own row, whose
      // range is opacity's alone, draws o1 elsewhere than the first row does.
      const ownRowValue = drawnValue(opacityRowId);
      if (typeof ownRowValue !== "number") {
        throw new Error("Missing the opacity row's projection of the dragged opacity point");
      }
      expect(ownRowValue).not.toBeCloseTo(firstRowValue);

      const keys = [
        buildTrackKey(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.OPACITY),
        buildTrackKey(NAMESPACE_IDS.BETA, INSTANCE_IDS.BETA_SHARED, TRACK_IDS.OPACITY),
      ];
      const previews = keys.map((key) => during.derivedSnapshot?.tracks[key]?.preview);
      for (const preview of previews) {
        expect(preview?.track?.points.find((point) => point.id === "o1")?.value).toBeCloseTo(
          firstRowValue,
        );
      }

      sharedStore.getState().commitDrag();
      await flushMicrotasks();

      const after = sharedStore.getState();
      const committed = after.tracks[TRACK_IDS.OPACITY].points;
      expect(committed.find((point) => point.id === "o1")?.value).toBeCloseTo(firstRowValue);
      keys.forEach((key, index) => {
        const preview = previews[index];
        expect(
          preview?.track?.points.map(({ id, stamp, value }) => ({ id, stamp, value })),
        ).toEqual(committed.map(({ id, stamp, value }) => ({ id, stamp, value })));
        const committedCurve = after.derivedSnapshot?.tracks[key]?.canonical.curve;
        if (!preview?.curve || !committedCurve) {
          throw new Error(`Missing curves for ${key}`);
        }
        for (const localStamp of [0, 300, 750, 1200, 2000]) {
          expect(preview.curve(localStamp)).toBeCloseTo(committedCurve(localStamp) as number);
        }
      });
    } finally {
      sharedStore.getState().cancelDrag();
      cleanupShared();
    }
  });

  it("reads preview values for timescaled instances while dragging", async () => {
    const storeWithInstances = createTestAnimationStore({
      trackEvaluator: testTrackEvaluator,
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
