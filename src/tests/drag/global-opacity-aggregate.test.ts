import { describe, it, expect } from "vitest";
import { buildTrackKey } from "../../utils/track-key";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { clickMarkerWith } from "../selection/selection-test-helpers";
import { computeDragDiffOps } from "../../functions/drag-diff-ops";
import { computeTrackInterpolator } from "../../functions/compute-track-interpolator";
import { computeTrackViolations } from "../../functions/compute-track-violations";
import { resolveAnimationDuration } from "../../functions/compute-animation-extent";

describe("global row opacity drag projection", () => {
  it("keeps a single projected marker with matching stamp in the global row", async () => {
    const store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: false,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    const cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();

    const globalRowId = "global";
    const getGlobalRow = () => store.getState().derivedSnapshot?.rows?.[globalRowId]?.computed;
    const beforeRow = getGlobalRow();
    expect(beforeRow).toBeDefined();

    const opacityFrame =
      beforeRow?.virtualFrames.find((frame) =>
        frame.points.some((point) => point.trackId.includes("opacity")),
      ) ?? null;
    expect(opacityFrame).toBeTruthy();
    if (!opacityFrame) throw new Error("expected opacity frame before drag");
    const opacityPoint =
      opacityFrame.points.find((point) => point.trackId.includes("opacity")) ?? null;
    if (!opacityPoint) throw new Error("expected opacity point");
    const trackKey = opacityPoint.trackId.includes("/")
      ? opacityPoint.trackId
      : buildTrackKey(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.OPACITY);
    const baseTrackId = trackKey.includes("/") ? trackKey.split("/").slice(2).join("/") : trackKey;

    clickMarkerWith(store, globalRowId, opacityFrame.id);

    store.getState().startDrag({
      axis: "horizontal",
      markerId: opacityFrame.id,
      rowId: globalRowId,
    });

    store.getState().updateDrag({
      normalizedStamp: { current: opacityFrame.stamp + 0.05 },
      modifiers: { alt: false, shift: false, meta: false },
    });

    await flushMicrotasks();

    const dragState = store.getState().dragState;
    expect(dragState).toBeDefined();
    if (!dragState) throw new Error("expected drag state");

    const opacityTrack = store.getState().tracks[baseTrackId];
    const projected = computeDragDiffOps({
      trackId: baseTrackId,
      trackPoints: opacityTrack.points,
      snapshotPoints: dragState.trackSnapshots?.[baseTrackId]?.points,
      dragState,
      selection: store.getState().selectionState,
      bounds: { min: 0, max: 1 },
    });
    const expectedStamp = projected.projectedPoints.find((p) => p.id === opacityPoint.id)?.stamp;
    expect(expectedStamp).toBeDefined();

    const duringRow = getGlobalRow();
    expect(duringRow).toBeDefined();
    const framesWithO1 =
      duringRow?.virtualFrames.filter((frame) =>
        frame.points.some((point) => point.id === opacityPoint.id && point.trackId === baseTrackId),
      ) ?? [];
    expect(framesWithO1.length).toBe(1);
    expect(framesWithO1[0].stamp).toBeCloseTo(expectedStamp!, 5);

    // Sanity: preview violations should match the projected track for this entry.
    const namespace = store.getState().namespaces[NAMESPACE_IDS.ALPHA];
    const instance = namespace.animationInstances[INSTANCE_IDS.ALPHA_SHARED];
    const animation = store.getState().animations[instance.animationId];
    const animatable = store.getState().animatables[opacityTrack.animatableId];
    const expectedViolations = computeTrackViolations(
      computeTrackInterpolator({ ...opacityTrack, points: projected.projectedPoints }, instance),
      resolveAnimationDuration(animation, store.getState().tracks),
      baseTrackId,
      NAMESPACE_IDS.ALPHA,
      INSTANCE_IDS.ALPHA_SHARED,
      animatable,
    );
    const duringViolations = Object.values(duringRow?.violationSet.violations ?? {}).filter(
      (v) =>
        v.trackId === TRACK_IDS.OPACITY &&
        v.namespace === NAMESPACE_IDS.ALPHA &&
        v.instanceId === INSTANCE_IDS.ALPHA_SHARED,
    );
    expect(duringViolations.length).toBe(expectedViolations.length);

    store.getState().cancelDrag();
    cleanup?.();
  });
});
