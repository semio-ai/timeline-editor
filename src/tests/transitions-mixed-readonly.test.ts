import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../store";
import { StandardTransitionType } from "../types";
import { flushMicrotasks } from "./utils/flush-microtasks";

/**
 * The transition toolbar in `key-toolbar-section.tsx` calls
 * `updateSelectedKeyTransitions(patch)` whenever there is a selection.
 * In a project with mixed readonly+writable tracks the selection can
 * span both — `selectable: false` blocks readonly entries from entering
 * the selection going forward, but historic selections (e.g. permissions
 * downgraded mid-session) can still contain readonly trackIds. The
 * action must filter those per-context, not mutate them.
 *
 * Pinned at the action level so the slice wrapper can't accidentally
 * widen the gate without breaking this contract.
 */

const sourceRowId = (namespaceId: string, instanceId: string, trackId: string) =>
  `${namespaceId}/${instanceId}/${trackId}`;

describe("updateSelectedKeyTransitions respects readonly per-context", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({ activeInstance: INSTANCE_IDS.ALPHA_SHARED });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
    // Mark SCALE readonly; OPACITY remains writable.
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

  it("applies the patch only to writable tracks in a mixed selection", async () => {
    // Stage a selection that includes both a readonly and a writable
    // keypoint. This bypasses the normal click-to-select path which
    // would refuse readonly entries — simulating a permissions-changed-
    // mid-session scenario.
    store.setState({
      selectionState: {
        ...store.getState().selectionState,
        keypoints: new Map([
          [TRACK_IDS.SCALE, new Set(["s0"])],
          [TRACK_IDS.OPACITY, new Set(["o0"])],
        ]),
      },
    });
    await flushMicrotasks();

    const beforeScale = store
      .getState()
      .tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s0")?.transitions;
    const beforeOpacity = store
      .getState()
      .tracks[TRACK_IDS.OPACITY].points.find((p) => p.id === "o0")?.transitions;

    store.getState().updateSelectedKeyTransitions({
      out: StandardTransitionType.Linear,
    });
    await flushMicrotasks();

    const afterScale = store
      .getState()
      .tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s0")?.transitions;
    const afterOpacity = store
      .getState()
      .tracks[TRACK_IDS.OPACITY].points.find((p) => p.id === "o0")?.transitions;

    // Readonly track is untouched.
    expect(JSON.stringify(afterScale ?? {})).toBe(JSON.stringify(beforeScale ?? {}));
    // Writable track received the patched out transition.
    expect(afterOpacity).not.toEqual(beforeOpacity);
  });

  it("no-ops when every selected track is readonly", async () => {
    store.setState({
      selectionState: {
        ...store.getState().selectionState,
        keypoints: new Map([[TRACK_IDS.SCALE, new Set(["s0"])]]),
      },
    });
    await flushMicrotasks();

    const before = JSON.stringify(
      store.getState().tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s0")?.transitions ??
        {},
    );

    store.getState().updateSelectedKeyTransitions({
      out: StandardTransitionType.Linear,
    });
    await flushMicrotasks();

    const after = JSON.stringify(
      store.getState().tracks[TRACK_IDS.SCALE].points.find((p) => p.id === "s0")?.transitions ??
        {},
    );
    expect(after).toBe(before);
  });
});
