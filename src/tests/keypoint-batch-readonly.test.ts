import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../store";
import { flushMicrotasks } from "./utils/flush-microtasks";

/**
 * The global "All selected" KeyStrip in `timeline-control.tsx` calls
 * `updateKeypoints` / `removeKeypoints` with a batch of entries that
 * spans every editable instance. In a project with mixed
 * readonly+writable tracks, the slice wrapper must filter readonly
 * entries out of the batch and apply only the writable ones, rather
 * than rejecting the whole batch (which would block authoring on the
 * tracks the user CAN edit) or applying it (which would silently mutate
 * a permission-locked track).
 *
 * `pasteAtStamp` / `deleteSelection` already have parallel coverage in
 * `clipboard-readonly-tracks.test.ts`; this file pins the
 * `updateKeypoints` and `removeKeypoints` slice paths the global hex
 * uses directly.
 */

const sourceRowId = (namespaceId: string, instanceId: string, trackId: string) =>
  `${namespaceId}/${instanceId}/${trackId}`;

describe("Mixed-batch keypoint mutations respect readonly", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({ activeInstance: INSTANCE_IDS.ALPHA_SHARED });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
    // Mark only SCALE as readonly; OPACITY remains writable.
    store
      .getState()
      .setSourcesReadonly(
        [sourceRowId(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.SCALE)],
        true,
      );
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
  });

  it("updateKeypoints applies to writable tracks and skips readonly tracks", async () => {
    const beforeScale = JSON.stringify(store.getState().tracks[TRACK_IDS.SCALE].points);
    const beforeOpacity = JSON.stringify(store.getState().tracks[TRACK_IDS.OPACITY].points);

    store.getState().updateKeypoints(
      [
        { trackId: TRACK_IDS.SCALE, keypoint: { id: "s0", value: 99 } },
        { trackId: TRACK_IDS.OPACITY, keypoint: { id: "o0", value: 0.5 } },
      ],
      true,
    );
    await flushMicrotasks();

    expect(JSON.stringify(store.getState().tracks[TRACK_IDS.SCALE].points)).toBe(beforeScale);
    expect(JSON.stringify(store.getState().tracks[TRACK_IDS.OPACITY].points)).not.toBe(
      beforeOpacity,
    );
    const opacityKp = store
      .getState()
      .tracks[TRACK_IDS.OPACITY].points.find((p) => p.id === "o0");
    expect(opacityKp?.value).toBe(0.5);
  });

  it("removeKeypoints removes from writable tracks and leaves readonly tracks intact", async () => {
    const scaleCountBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const opacityCountBefore = store.getState().tracks[TRACK_IDS.OPACITY].points.length;

    store.getState().removeKeypoints([
      { trackId: TRACK_IDS.SCALE, keypointId: "s0" },
      { trackId: TRACK_IDS.OPACITY, keypointId: "o0" },
    ]);
    await flushMicrotasks();

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(scaleCountBefore);
    expect(store.getState().tracks[TRACK_IDS.OPACITY].points.length).toBe(opacityCountBefore - 1);
  });

  it("updateKeypoints with only readonly entries no-ops without entering produce", async () => {
    const before = JSON.stringify(store.getState().tracks[TRACK_IDS.SCALE].points);
    store
      .getState()
      .updateKeypoints([{ trackId: TRACK_IDS.SCALE, keypoint: { id: "s0", value: 99 } }], true);
    await flushMicrotasks();
    expect(JSON.stringify(store.getState().tracks[TRACK_IDS.SCALE].points)).toBe(before);
  });
});
