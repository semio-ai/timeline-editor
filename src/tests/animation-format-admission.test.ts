import { describe, expect, it } from "vitest";
import { createMinimalAnimationStore } from "../test-fixtures";
import { resolveStoredAnimationDuration } from "../functions/compute-animation-extent";
import { migrateAnimationData } from "../functions/migrate-animation-data";
import type { StoredAnimation } from "../types";

const future = {
  id: "future",
  name: "Future",
  formatVersion: 3,
  duration: 1000,
  groups: [],
  tracks: [
    {
      id: "future-track",
      name: "Future",
      animatableId: "future-target",
      points: [{ id: "key", stamp: 0.5, value: 1 }],
    },
  ],
} as unknown as StoredAnimation;

describe("unreadable animation admission", () => {
  it.each(["addAnimation", "setAnimations"] as const)(
    "%s refuses before storing anything or making it saveable",
    (action) => {
      const store = createMinimalAnimationStore();
      const before = store.getState();
      const call = () =>
        action === "addAnimation"
          ? store.getState().addAnimation(future)
          : store.getState().setAnimations({ future });
      expect(call).toThrow("Reload Studio");
      expect(store.getState().animations).toBe(before.animations);
      expect(store.getState().tracks).toBe(before.tracks);
      expect(
        store
          .getState()
          .getAnimationsToSave()
          .some((a) => a.id === future.id),
      ).toBe(false);
      expect(future.tracks[0].points[0].stamp).toBe(0.5);
    },
  );

  it("refuses unknown stored content before deriving its duration", () => {
    expect(() => resolveStoredAnimationDuration(future)).toThrow("Reload Studio");
  });

  it("refuses composite/fixture migration before flattening unknown content", () => {
    expect(() => migrateAnimationData(future, {})).toThrow("Reload Studio");
  });
});
