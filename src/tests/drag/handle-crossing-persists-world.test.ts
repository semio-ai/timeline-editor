import { describe, expect, it } from "vitest";
import type { RawValue } from "@semio/utils";
import {
  createTestAnimationStore,
  TRACK_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { DerivedSnapshot, Track } from "../../types";

const buildRowId = (trackId: string) =>
  `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${trackId}`;

describe("drag handles when crossing a neighbor (world-space)", () => {
  it("preserves world handle deltas when dragging past a neighbor via store actions", () => {
    const store = createTestAnimationStore({ includeNamespaceB: false });
    store.getState().initAnimationSubscriptions();

    const trackId = `${TRACK_IDS.POSITION}.x`;
    const markerId = "px2.x";
    const rowId = buildRowId(trackId);
    const state = store.getState();
    const track = state.tracks[trackId];
    const anchor = track.points.find((p) => p.id === markerId);
    if (!anchor) throw new Error("anchor not found");

    // Minimal derived snapshot to satisfy startDrag lookup.
    const derived: DerivedSnapshot = {
      tracks: {},
      rows: {
        [rowId]: {
          computed: {
            verticalBounds: { min: -100, max: 100 },
            virtualFrames: [
              {
                id: markerId,
                stamp: anchor.stamp,
                points: [
                  {
                    id: markerId,
                    trackId,
                    stamp: anchor.stamp,
                    selectable: true,
                    editable: true,
                  } as any,
                ],
              },
            ],
          },
        },
      },
    };

    store.setState({
      derivedSnapshot: derived,
      selectionState: {
        instanceId: INSTANCE_IDS.ALPHA_SHARED,
        reference: { rowId, markerId },
        keypoints: new Map([[trackId, new Set([markerId])]]),
      },
    });

    // Start drag via store action (horizontal move).
    store.getState().startDrag({
      axis: "horizontal",
      markerId,
      rowId,
      origin: { x: 0, y: 0 },
    });

    // Push the marker past px3.x (0.7).
    const dragState = store.getState().dragState!;
    const origin = dragState.stampOrigin ?? anchor.stamp;
    store.getState().updateDrag({
      pointer: { x: 0, y: 0 },
      normalizedStamp: { current: origin + 0.5 },
      modifiers: dragState.modifiers,
    });

    store.getState().commitDrag();
    const committedAnchor = store.getState().tracks[trackId].points.find((p) => p.id === markerId);

    expect(committedAnchor?.transitionsWorld?.out?.handle?.deltaStamp).toBe(
      anchor.transitionsWorld!.out!.handle!.deltaStamp,
    );
    expect(committedAnchor?.transitionsWorld?.out?.handle?.deltaValue).toBe(
      anchor.transitionsWorld!.out!.handle!.deltaValue,
    );
    expect(committedAnchor?.transitionsWorld?.in?.handle?.deltaStamp).toBe(
      anchor.transitionsWorld!.in!.handle!.deltaStamp,
    );
    expect(committedAnchor?.transitionsWorld?.in?.handle?.deltaValue).toBe(
      anchor.transitionsWorld!.in!.handle!.deltaValue,
    );
  });

  it("keeps downstream opacity handles stable when a leading marker overtakes its neighbor", () => {
    const store = createTestAnimationStore({ includeNamespaceB: false });
    store.getState().initAnimationSubscriptions();

    const trackId = TRACK_IDS.OPACITY;
    const anchorId = "o1";
    const rowId = buildRowId(trackId);

    const track = store.getState().tracks[trackId] as Track<RawValue>;
    const before = captureHandleDeltas(track, { outId: "o2", inId: "o3" });

    const anchor = track.points.find((p) => p.id === anchorId);
    if (!anchor) throw new Error("anchor not found");

    const derived: DerivedSnapshot = {
      tracks: {},
      rows: {
        [rowId]: {
          computed: {
            verticalBounds: { min: -100, max: 100 },
            virtualFrames: [
              {
                id: anchor.id,
                stamp: anchor.stamp,
                points: [
                  {
                    id: anchor.id,
                    trackId,
                    stamp: anchor.stamp,
                    selectable: true,
                    editable: true,
                  } as any,
                ],
              },
            ],
          },
        },
      },
    };

    store.setState({
      derivedSnapshot: derived,
      selectionState: {
        instanceId: INSTANCE_IDS.ALPHA_SHARED,
        reference: { rowId, markerId: anchor.id },
        keypoints: new Map([[trackId, new Set([anchor.id])]]),
      },
    });

    store.getState().startDrag({
      axis: "horizontal",
      markerId: anchor.id,
      rowId,
      origin: { x: 0, y: 0 },
    });

    // Move the anchor past o2 (0.6) into the 0.7 region.
    store.getState().updateDrag({
      pointer: { x: 0, y: 0 },
      normalizedStamp: { current: 0.7 },
      modifiers: store.getState().dragState?.modifiers ?? { alt: false, shift: false, meta: false },
    });

    store.getState().commitDrag();

    const afterTrack = store.getState().tracks[trackId] as Track<RawValue>;
    const after = captureHandleDeltas(afterTrack, { outId: "o2", inId: "o3" });

    const expectedO2Stamp = before.o2Out?.deltaStamp ?? 0;
    const expectedO2Value = before.o2Out?.deltaValue ?? 0;
    const expectedO3Stamp = before.o3In?.deltaStamp ?? 0;
    const expectedO3Value = before.o3In?.deltaValue ?? 0;

    expect(after.o2Out?.deltaStamp ?? 0).toBeCloseTo(expectedO2Stamp, 6);
    expect(after.o2Out?.deltaValue ?? 0).toBeCloseTo(expectedO2Value, 6);
    expect(after.o3In?.deltaStamp ?? 0).toBeCloseTo(expectedO3Stamp, 6);
    expect(after.o3In?.deltaValue ?? 0).toBeCloseTo(expectedO3Value, 6);
  });
});

const computeHandleDelta = (
  track: Track<RawValue>,
  pointId: string,
  neighborId: string,
  direction: "in" | "out",
) => {
  const point = track.points.find((p) => p.id === pointId);
  const neighbor = track.points.find((p) => p.id === neighborId);
  if (!point || !neighbor) return undefined;

  const handle =
    direction === "out" ? point.transitionsWorld?.out?.handle : point.transitionsWorld?.in?.handle;

  const pointValue = typeof point.value === "number" ? point.value : undefined;
  const neighborValue = typeof neighbor.value === "number" ? neighbor.value : undefined;
  if (pointValue === undefined || neighborValue === undefined) return undefined;

  if (handle && typeof handle.deltaStamp === "number" && typeof handle.deltaValue === "number") {
    return { deltaStamp: handle.deltaStamp, deltaValue: handle.deltaValue };
  }

  if (direction === "out" && point.transitions?.out) {
    const span = neighbor.stamp - point.stamp;
    const deltaValue = neighborValue - pointValue;
    return {
      deltaStamp: span * point.transitions.out.x,
      deltaValue: deltaValue * point.transitions.out.y,
    };
  }
  if (direction === "in" && point.transitions?.in) {
    const span = point.stamp - neighbor.stamp;
    const deltaValue = pointValue - neighborValue;
    const cpStamp = neighbor.stamp + span * point.transitions.in.x;
    const cpValue = neighborValue + deltaValue * point.transitions.in.y;
    return {
      deltaStamp: cpStamp - point.stamp,
      deltaValue: cpValue - pointValue,
    };
  }
  return undefined;
};

const captureHandleDeltas = (track: Track<RawValue>, ids: { outId: string; inId: string }) => {
  const o2Out = computeHandleDelta(track, ids.outId, "o3", "out");
  const o3In = computeHandleDelta(track, ids.inId, "o2", "in");
  return { o2Out, o3In };
};
