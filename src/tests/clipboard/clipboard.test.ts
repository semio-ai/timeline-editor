import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";

/**
 * Helper: set selection to specific keypoints.
 * Track keys in the test store are simple IDs (e.g. "scale", "opacity"),
 * not composite namespace/instance/track keys.
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

// ──────────────────────────────────────────────────────────
// Copy
// ──────────────────────────────────────────────────────────

describe("Clipboard: Copy", () => {
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

  it("no-ops when selection is empty", () => {
    store.getState().copySelection();
    expect(store.getState().clipboard).toBeNull();
  });

  it("copies a single keypoint with stampOffset=0", () => {
    // Scale s0 at 400ms, value=1
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();

    const clipboard = store.getState().clipboard;
    expect(clipboard).not.toBeNull();
    expect(clipboard!.tracks).toHaveLength(1);
    expect(clipboard!.tracks[0].sourceTrackKey).toBe(TRACK_IDS.SCALE);
    expect(clipboard!.tracks[0].keypoints).toHaveLength(1);
    expect(clipboard!.tracks[0].keypoints[0].stampOffset).toBe(0);
    expect(clipboard!.tracks[0].keypoints[0].value).toBe(1);
    expect(clipboard!.instanceId).toBe(INSTANCE_IDS.ALPHA_SHARED);
  });

  it("copies multiple keypoints from same track with correct offsets", () => {
    // s0 at 400ms, s1 at 800ms, s2 at 1000ms
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0", "s1", "s2"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();

    const kps = store.getState().clipboard!.tracks[0].keypoints;
    expect(kps).toHaveLength(3);

    const offsets = kps.map((k) => k.stampOffset).sort((a, b) => a - b);
    expect(offsets[0]).toBe(0);       // earliest (400ms anchor)
    expect(offsets[1]).toBe(400);     // 800 - 400
    expect(offsets[2]).toBe(600);     // 1000 - 400
  });

  it("copies keypoints from multiple tracks", () => {
    selectKeypoints(
      store,
      [
        { trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] },
        { trackKey: TRACK_IDS.OPACITY, keypointIds: ["o0"] },
      ],
      INSTANCE_IDS.ALPHA_SHARED,
    );
    store.getState().copySelection();

    const clipboard = store.getState().clipboard!;
    expect(clipboard.tracks).toHaveLength(2);
    const keys = clipboard.tracks.map((t) => t.sourceTrackKey).sort();
    expect(keys).toEqual([TRACK_IDS.OPACITY, TRACK_IDS.SCALE]);
  });

  it("preserves transition data", () => {
    // o1 has paired transitions
    selectKeypoints(store, [{ trackKey: TRACK_IDS.OPACITY, keypointIds: ["o1"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();

    const kp = store.getState().clipboard!.tracks[0].keypoints[0];
    expect(kp.transitions).toBeDefined();
    expect(kp.transitions!.in).toBeDefined();
    expect(kp.transitions!.out).toBeDefined();
    expect(kp.transitions!.pairing).toBe("paired");
  });

  it("overwrites previous clipboard contents", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();
    expect(store.getState().clipboard!.tracks[0].keypoints).toHaveLength(1);

    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0", "s1"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();
    expect(store.getState().clipboard!.tracks[0].keypoints).toHaveLength(2);
  });

  it("does not modify selection or keypoints", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);

    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const selectionBefore = store.getState().selectionState.keypoints.size;

    store.getState().copySelection();

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore);
    expect(store.getState().selectionState.keypoints.size).toBe(selectionBefore);
  });

  it("converts stamps using instance timescale/offset", () => {
    // Use BETA_SHARED: timescale=2, offset=250
    // Scale s0 at local 400ms → world = 400/2 + 250 = 450ms
    // Scale s1 at local 800ms → world = 800/2 + 250 = 650ms
    store.getState().focusSelectionInstance(INSTANCE_IDS.BETA_SHARED);
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0", "s1"] }], INSTANCE_IDS.BETA_SHARED);
    store.getState().copySelection();

    const offsets = store.getState().clipboard!.tracks[0].keypoints
      .map((k) => k.stampOffset).sort((a, b) => a - b);
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBeCloseTo(200, 0); // 650 - 450
  });
});

// ──────────────────────────────────────────────────────────
// Cut
// ──────────────────────────────────────────────────────────

describe("Clipboard: Cut", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
  });

  it("no-ops when selection is empty", () => {
    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().cutSelection();
    expect(store.getState().clipboard).toBeNull();
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore);
  });

  it("copies and removes the selected keypoint", () => {
    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s1"] }], INSTANCE_IDS.ALPHA_SHARED);

    store.getState().cutSelection();

    expect(store.getState().clipboard).not.toBeNull();
    expect(store.getState().clipboard!.tracks[0].keypoints).toHaveLength(1);
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore - 1);
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s1")).toBeUndefined();
    expect(store.getState().selectionState.keypoints.size).toBe(0);
  });

  it("preserves clipboard for subsequent paste", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().cutSelection();

    expect(store.getState().clipboard).not.toBeNull();
    expect(store.getState().clipboard!.tracks[0].keypoints[0].value).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────
// Paste
// ──────────────────────────────────────────────────────────

describe("Clipboard: Paste", () => {
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

  it("no-ops when clipboard is empty", () => {
    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().pasteAtStamp(500);
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore);
  });

  it("pastes a single keypoint at the target stamp", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();

    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().pasteAtStamp(1500);

    const track = store.getState().tracks[TRACK_IDS.SCALE];
    expect(track.points.length).toBe(pointsBefore + 1);

    const newPoint = track.points.find((p) => !["s0", "s1", "s2", "s3"].includes(p.id));
    expect(newPoint).toBeDefined();
    expect(newPoint!.stamp).toBe(1500);
    expect(newPoint!.value).toBe(1);
  });

  it("preserves relative offsets between pasted keypoints", () => {
    // s0 at 400ms, s1 at 800ms → offsets 0 and 400
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0", "s1"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();
    store.getState().pasteAtStamp(1000);

    const newPoints = store.getState().tracks[TRACK_IDS.SCALE].points
      .filter((p) => !["s0", "s1", "s2", "s3"].includes(p.id));
    expect(newPoints).toHaveLength(2);

    const stamps = newPoints.map((p) => p.stamp).sort((a, b) => a - b);
    expect(stamps[0]).toBe(1000);
    expect(stamps[1]).toBe(1400);
  });

  it("generates fresh UUIDs for pasted keypoints", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();
    store.getState().pasteAtStamp(1500);

    const ids = store.getState().tracks[TRACK_IDS.SCALE].points.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids).toContain("s0"); // original still exists
  });

  it("pastes across multiple tracks", () => {
    selectKeypoints(
      store,
      [
        { trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] },
        { trackKey: TRACK_IDS.OPACITY, keypointIds: ["o0"] },
      ],
      INSTANCE_IDS.ALPHA_SHARED,
    );
    store.getState().copySelection();

    const scaleBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const opacityBefore = store.getState().tracks[TRACK_IDS.OPACITY].points.length;

    store.getState().pasteAtStamp(1500);

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(scaleBefore + 1);
    expect(store.getState().tracks[TRACK_IDS.OPACITY].points.length).toBe(opacityBefore + 1);
  });

  it("selects the newly pasted keypoints", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();
    store.getState().pasteAtStamp(1500);

    const selection = store.getState().selectionState.keypoints;
    expect(selection.size).toBe(1);
    expect(selection.has(TRACK_IDS.SCALE)).toBe(true);

    const selectedIds = Array.from(selection.get(TRACK_IDS.SCALE)!);
    expect(selectedIds).toHaveLength(1);
    expect(selectedIds[0]).not.toBe("s0");
  });

  it("replaces existing keypoints within 1ms overlap", () => {
    // Copy s1 (at 800ms), paste at 400ms (where s0 is)
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s1"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();

    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().pasteAtStamp(400); // s0 is at 400ms

    const track = store.getState().tracks[TRACK_IDS.SCALE];
    expect(track.points.length).toBe(pointsBefore); // replaced, not added
    expect(track.points.find((p) => p.id === "s0")).toBeUndefined();
  });

  it("supports multiple pastes from same clipboard", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();

    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().pasteAtStamp(1500);
    store.getState().pasteAtStamp(1700);

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore + 2);

    const newPoints = store.getState().tracks[TRACK_IDS.SCALE].points
      .filter((p) => !["s0", "s1", "s2", "s3"].includes(p.id));
    expect(newPoints).toHaveLength(2);
    expect(newPoints[0].id).not.toBe(newPoints[1].id);
  });

  it("preserves transition data in pasted keypoints", () => {
    // o1 has paired transitions
    selectKeypoints(store, [{ trackKey: TRACK_IDS.OPACITY, keypointIds: ["o1"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();
    store.getState().pasteAtStamp(1500);

    const newPoint = store.getState().tracks[TRACK_IDS.OPACITY].points
      .find((p) => !["o0", "o1", "o2", "o3"].includes(p.id));
    expect(newPoint).toBeDefined();
    expect(newPoint!.transitions).toBeDefined();
    expect(newPoint!.transitions!.pairing).toBe("paired");
  });
});

// ──────────────────────────────────────────────────────────
// Delete
// ──────────────────────────────────────────────────────────

describe("Clipboard: Delete", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
  });

  it("no-ops when selection is empty", () => {
    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().deleteSelection();
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore);
  });

  it("removes selected keypoints", () => {
    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s1", "s2"] }], INSTANCE_IDS.ALPHA_SHARED);

    store.getState().deleteSelection();

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore - 2);
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s1")).toBeUndefined();
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s2")).toBeUndefined();
  });

  it("removes keypoints across multiple tracks", () => {
    selectKeypoints(
      store,
      [
        { trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] },
        { trackKey: TRACK_IDS.OPACITY, keypointIds: ["o0"] },
      ],
      INSTANCE_IDS.ALPHA_SHARED,
    );

    store.getState().deleteSelection();

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s0")).toBeUndefined();
    expect(store.getState().tracks[TRACK_IDS.OPACITY].points.find((p) => p.id === "o0")).toBeUndefined();
  });

  it("clears selection after delete", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().deleteSelection();

    expect(store.getState().selectionState.keypoints.size).toBe(0);
    expect(store.getState().selectionState.reference).toBeNull();
  });

  it("does not affect clipboard contents", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();

    // Now delete a different keypoint
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s1"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().deleteSelection();

    const clipboard = store.getState().clipboard;
    expect(clipboard).not.toBeNull();
    expect(clipboard!.tracks[0].keypoints[0].value).toBe(1); // s0's value preserved
  });
});

// ──────────────────────────────────────────────────────────
// Integration
// ──────────────────────────────────────────────────────────

describe("Clipboard: Integration", () => {
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

  it("copy → paste → paste produces two independent copies", () => {
    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().copySelection();

    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().pasteAtStamp(1500);
    store.getState().pasteAtStamp(1700);

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore + 2);
  });

  it("cut → paste moves keypoints to new position", () => {
    const originalValue = store.getState().tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s0")!.value;
    const pointsBefore = store.getState().tracks[TRACK_IDS.SCALE].points.length;

    selectKeypoints(store, [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }], INSTANCE_IDS.ALPHA_SHARED);
    store.getState().cutSelection();
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore - 1);

    store.getState().pasteAtStamp(1500);
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(pointsBefore);

    const pastedPoint = store.getState().tracks[TRACK_IDS.SCALE].points.find((p) => p.stamp === 1500);
    expect(pastedPoint).toBeDefined();
    expect(pastedPoint!.value).toBe(originalValue);
  });

  it("copy → delete all → paste restores keypoints", () => {
    selectKeypoints(
      store,
      [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0", "s1", "s2", "s3"] }],
      INSTANCE_IDS.ALPHA_SHARED,
    );
    store.getState().copySelection();
    store.getState().deleteSelection();

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(0);

    store.getState().pasteAtStamp(0);
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(4);

    const ids = store.getState().tracks[TRACK_IDS.SCALE].points.map((p) => p.id);
    expect(ids).not.toContain("s0");
    expect(ids).not.toContain("s1");
  });
});
