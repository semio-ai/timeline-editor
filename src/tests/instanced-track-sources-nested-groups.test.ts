import { describe, expect, it } from "vitest";
import {
  ANIMATION_IDS,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "./utils/flush-microtasks";

/**
 * Regression coverage for the leaf-only rollup in `flattenSources`.
 *
 * Without it, ancestor group rows would aggregate both their leaf descendants
 * AND the per-group aggregate rows produced for nested composite groups —
 * inflating `data.length` and skewing per-row metrics that consumers (e.g.
 * key strips, opacity overlays, filtered counts) read from `SourceRow.data`.
 */
describe("flattenSources nested-group leaf rollup", () => {
  it("aggregates only leaf data, never nested group rows", async () => {
    const store = createTestAnimationStore();
    await flushMicrotasks();

    const rows = store.getState().instancedTrackSources;

    // Composite group: vector3 with three scalar children.
    // Should contain exactly the three leaf children, not itself + children.
    const positionGroupId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;
    const positionGroup = rows[positionGroupId];
    expect(positionGroup?.isGroup).toBe(true);
    expect(positionGroup?.data.length).toBe(3);
    expect(new Set(positionGroup?.data.map((d) => d.trackId))).toEqual(
      new Set([TRACK_IDS.POSITION_X, TRACK_IDS.POSITION_Y, TRACK_IDS.POSITION_Z]),
    );

    // Instance group: SHARED animation has position(3) + scale + opacity = 5 leaves.
    // Without the leaf-only rollup, this would also include the position group's
    // own aggregate row — producing 6 entries instead of 5.
    const instanceGroupId = `instance:${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}`;
    const instanceGroup = rows[instanceGroupId];
    expect(instanceGroup?.isGroup).toBe(true);
    expect(instanceGroup?.data.length).toBe(5);

    // Entity group: namespace alpha has both ALPHA_SHARED (5 leaves) and
    // ALPHA_EXCLUSIVE (rotation(3) + width + height = 5 leaves) → 10 total.
    const entityGroupId = `entity:${NAMESPACE_IDS.ALPHA}`;
    const entityGroup = rows[entityGroupId];
    expect(entityGroup?.isGroup).toBe(true);
    expect(entityGroup?.data.length).toBe(10);

    // Global row mirrors the same leaf-only contract across all instances:
    // alpha-shared(5) + alpha-exclusive(5) + beta-shared(5) + beta-exclusive(5) = 20.
    const globalRow = rows.global;
    expect(globalRow?.data.length).toBe(20);

    // Every aggregated entry must reference a real leaf trackId (no group ids).
    const groupIds = new Set(
      Object.values(rows)
        .filter((row) => row.isGroup)
        .map((row) => row.id),
    );
    [positionGroup, instanceGroup, entityGroup, globalRow].forEach((row) => {
      row?.data.forEach((datum) => {
        const compositeId = `${datum.namespaceId}/${datum.instanceId}/${datum.trackId}`;
        expect(groupIds.has(compositeId)).toBe(false);
      });
    });
  });

  it("filters group rows to exactly one row per real group in the tree", async () => {
    const store = createTestAnimationStore();
    await flushMicrotasks();

    const rows = store.getState().instancedTrackSources;

    // Sanity: each entity group is listed exactly once.
    expect(rows[`entity:${NAMESPACE_IDS.ALPHA}`]).toBeDefined();
    expect(rows[`entity:${NAMESPACE_IDS.BETA}`]).toBeDefined();

    // Sanity: each instance group is listed exactly once.
    expect(rows[`instance:${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}`]).toBeDefined();
    expect(rows[`instance:${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_EXCLUSIVE}`]).toBeDefined();

    // Both shared instances should produce a position composite group.
    expect(
      rows[`${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`],
    ).toBeDefined();
    expect(
      rows[`${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/${TRACK_IDS.POSITION}`],
    ).toBeDefined();

    // Animations exist as expected (smoke check that fixture wiring is intact).
    expect(store.getState().animations[ANIMATION_IDS.SHARED]).toBeDefined();
  });
});
