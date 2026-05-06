import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";

/**
 * Locked-track filtering coverage for clipboard operations.
 *
 * Locked tracks are read-only: they may be copied (read), but any operation
 * that mutates the track (paste, cut delete, delete) must skip them so the
 * UI lock affordance matches the actual on-disk effect.
 */

function selectKeypoints(
  store: AnimationStore,
  entries: { trackKey: string; keypointIds: string[] }[],
  instanceId: string,
) {
  const keypoints = new Map<string, Set<string>>();
  for (const { trackKey, keypointIds } of entries) {
    keypoints.set(trackKey, new Set(keypointIds));
  }
  store.setState({
    selectionState: {
      ...store.getState().selectionState,
      keypoints,
      instanceId,
    },
  });
}

const lockedRowId = (namespaceId: string, instanceId: string, trackId: string) =>
  `${namespaceId}/${instanceId}/${trackId}`;

describe("Clipboard: locked-track filtering", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
  });

  it("paste skips locked target tracks but applies to unlocked tracks in the same paste", async () => {
    selectKeypoints(
      store,
      [
        { trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] },
        { trackKey: TRACK_IDS.OPACITY, keypointIds: ["o0"] },
      ],
      INSTANCE_IDS.ALPHA_SHARED,
    );
    store.getState().copySelection();
    expect(store.getState().clipboard?.tracks).toHaveLength(2);

    // Lock SCALE only; OPACITY remains writable.
    store
      .getState()
      .setTracksLocked(
        [lockedRowId(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.SCALE)],
        true,
      );
    await flushMicrotasks();

    // Clear selection so paste falls back to the source tracks (no cross-track mapping).
    store.setState({
      selectionState: {
        ...store.getState().selectionState,
        keypoints: new Map(),
      },
    });

    const beforeScale = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const beforeOpacity = store.getState().tracks[TRACK_IDS.OPACITY].points.length;

    // Paste at a stamp that does not collide with existing keypoints.
    store.getState().pasteAtStamp(1500);
    await flushMicrotasks();

    const afterScale = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const afterOpacity = store.getState().tracks[TRACK_IDS.OPACITY].points.length;

    expect(afterScale).toBe(beforeScale); // locked → unchanged
    expect(afterOpacity).toBe(beforeOpacity + 1); // unlocked → one new point

    // New selection should only include the pasted (unlocked) track.
    const newSelection = store.getState().selectionState.keypoints;
    expect(newSelection.has(TRACK_IDS.SCALE)).toBe(false);
    expect(newSelection.get(TRACK_IDS.OPACITY)?.size).toBe(1);
  });

  it("delete skips locked tracks and preserves their selection", async () => {
    selectKeypoints(
      store,
      [
        { trackKey: TRACK_IDS.SCALE, keypointIds: ["s0", "s1"] },
        { trackKey: TRACK_IDS.OPACITY, keypointIds: ["o0"] },
      ],
      INSTANCE_IDS.ALPHA_SHARED,
    );

    store
      .getState()
      .setTracksLocked(
        [lockedRowId(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.SCALE)],
        true,
      );
    await flushMicrotasks();

    const beforeScale = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const beforeOpacity = store.getState().tracks[TRACK_IDS.OPACITY].points.length;

    store.getState().deleteSelection();

    const afterScale = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const afterOpacity = store.getState().tracks[TRACK_IDS.OPACITY].points.length;

    expect(afterScale).toBe(beforeScale); // locked → unchanged
    expect(afterOpacity).toBe(beforeOpacity - 1); // unlocked → deleted

    // Selection retained for locked tracks (their keypoints still exist),
    // cleared for tracks whose keypoints were removed.
    const selection = store.getState().selectionState.keypoints;
    expect(selection.get(TRACK_IDS.SCALE)?.size).toBe(2);
    expect(selection.has(TRACK_IDS.OPACITY)).toBe(false);
  });

  it("cut on a locked track copies but does not remove keypoints (read-only safety)", async () => {
    selectKeypoints(
      store,
      [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }],
      INSTANCE_IDS.ALPHA_SHARED,
    );

    store
      .getState()
      .setTracksLocked(
        [lockedRowId(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.SCALE)],
        true,
      );
    await flushMicrotasks();

    const before = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().cutSelection();

    // Copy half of cut succeeded — clipboard captures the locked-track keypoint.
    expect(store.getState().clipboard?.tracks).toHaveLength(1);
    expect(store.getState().clipboard?.tracks[0].sourceTrackKey).toBe(TRACK_IDS.SCALE);

    // Delete half of cut respected the lock — keypoint count unchanged.
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(before);
  });
});
