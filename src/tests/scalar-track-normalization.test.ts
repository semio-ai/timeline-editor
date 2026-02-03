import { describe, expect, it } from "vitest";
import type { SourceGroup, SourceTrack } from "../types";
import { computeDefaultSourcesFromInstance } from "../functions/compute-default-sources-from-instance";
import {
  createTestAnimationStore,
  TRACK_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  ANIMATION_IDS,
  ANIMATABLE_IDS,
} from "../test-fixtures/animation-store-factory";

describe("scalar track normalization", () => {
  it("normalizes composite tracks into per-axis scalar tracks with inherited names", () => {
    const store = createTestAnimationStore();
    const state = store.getState();
    const positionX = state.tracks[`${TRACK_IDS.POSITION}.x`];

    expect(positionX).toBeDefined();
    expect(positionX?.name).toBe("x");
  });

  it("produces a single grouped source row per animatable with unique children", () => {
    const store = createTestAnimationStore();
    const state = store.getState();
    const namespace = state.namespaces[NAMESPACE_IDS.ALPHA];
    const instance = namespace.animationInstances[INSTANCE_IDS.ALPHA_SHARED];

    const sources = computeDefaultSourcesFromInstance(
      NAMESPACE_IDS.ALPHA,
      instance,
      state.animations,
      state.animatables,
      state.tracks,
    );

    const group = sources.find((source): source is SourceGroup => {
      if (!("children" in source)) return false;
      const childTrackIds = source.children
        .map((child) => ("trackId" in child ? child.trackId : undefined))
        .filter(Boolean);
      return childTrackIds.includes(`${TRACK_IDS.POSITION}.x`);
    });
    expect(group).toBeDefined();
    expect(group?.name).toBe("Position");
    expect(group?.children.length).toBe(3);

    const childIdSet = new Set(group?.children.map((child) => child.id));
    expect(childIdSet.size).toBe(3);

    const childTrackIds = group?.children.map((child) => (child as SourceTrack).trackId);
    expect(childTrackIds).toContain(`${TRACK_IDS.POSITION}.x`);
  });

  it("prunes composite animatables and replaces animation track lists with derived ids", () => {
    const store = createTestAnimationStore();
    const state = store.getState();

    expect(state.animatables[ANIMATABLE_IDS.POSITION]).toBeUndefined();
    expect(state.animatables[`${ANIMATABLE_IDS.POSITION}.x`]).toBeDefined();

    const sharedTrackIds = state.animations[ANIMATION_IDS.SHARED]?.tracks ?? [];

    expect(sharedTrackIds).toContain(`${TRACK_IDS.POSITION}.x`);
    expect(sharedTrackIds).not.toContain(TRACK_IDS.POSITION);
  });
});
