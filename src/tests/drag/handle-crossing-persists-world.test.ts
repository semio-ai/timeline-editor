import { describe, expect, it } from "vitest";
import type { RawValue } from "@semio/data";
import {
  createTestAnimationStore,
  TRACK_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { DerivedSnapshot, Track, TrackKey } from "../../types";
import { StandardTransitionType } from "../../types";
import { resolveTransitionDelta } from "../../functions/get-world-control-points";

const buildRowId = (trackId: string): TrackKey =>
  `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${trackId}`;

describe("drag handles when crossing a neighbor (world-space)", () => {
  it("keeps easing transitions when dragging past a neighbor via store actions", () => {
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
          id: rowId,
          trackKeys: [rowId],
          computed: {
            verticalBounds: { min: -100, max: 100 },
            violationSet: { id: rowId, violations: {}, segments: [] },
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
    });

    // Push the marker past px3.x (0.7).
    const dragState = store.getState().dragState!;
    const origin = dragState.stampOrigin ?? anchor.stamp;
    store.getState().updateDrag({
      normalizedStamp: { current: origin + 0.5 },
      modifiers: dragState.modifiers,
    });

    store.getState().commitDrag();
    const committedAnchor = store.getState().tracks[trackId].points.find((p) => p.id === markerId);

    expect(committedAnchor?.stamp).toBeCloseTo(origin + 0.5, 6);
    expect(committedAnchor?.transitions?.out).toBe(StandardTransitionType.Cubic);
    expect(committedAnchor?.transitions?.in).toBe(StandardTransitionType.Cubic);
  });

  it("keeps downstream opacity handles stable when a leading marker overtakes its neighbor", () => {
    const store = createTestAnimationStore({ includeNamespaceB: false });
    store.getState().initAnimationSubscriptions();

    const trackId = TRACK_IDS.OPACITY;
    const anchorId = "o1";
    const rowId = buildRowId(trackId);

    const track = store.getState().tracks[trackId] as Track<RawValue>;
    const before = captureHandleDeltas(track, {
      outId: "o2",
      outNeighborId: "o3",
      inId: "o3",
      inNeighborId: "o2",
    });

    const anchor = track.points.find((p) => p.id === anchorId);
    if (!anchor) throw new Error("anchor not found");

    const derived: DerivedSnapshot = {
      tracks: {},
      rows: {
        [rowId]: {
          id: rowId,
          trackKeys: [rowId],
          computed: {
            verticalBounds: { min: -100, max: 100 },
            violationSet: { id: rowId, violations: {}, segments: [] },
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
    });

    // Move the anchor past o2 (0.6) into the 0.7 region.
    store.getState().updateDrag({
      normalizedStamp: { current: 0.7 },
      modifiers: store.getState().dragState?.modifiers ?? { alt: false, shift: false, meta: false },
    });

    store.getState().commitDrag();

    const afterTrack = store.getState().tracks[trackId] as Track<RawValue>;
    const after = captureHandleDeltas(afterTrack, {
      outId: "o2",
      outNeighborId: "o3",
      inId: "o3",
      inNeighborId: "o2",
    });

    expect(after.out?.deltaStamp ?? 0).toBeCloseTo(before.out?.deltaStamp ?? 0, 6);
    expect(after.out?.deltaValue ?? 0).toBeCloseTo(before.out?.deltaValue ?? 0, 6);
    expect(after.in?.deltaStamp ?? 0).toBeCloseTo(before.in?.deltaStamp ?? 0, 6);
    expect(after.in?.deltaValue ?? 0).toBeCloseTo(before.in?.deltaValue ?? 0, 6);
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

  const pointValue = typeof point.value === "number" ? point.value : undefined;
  const neighborValue = typeof neighbor.value === "number" ? neighbor.value : undefined;
  if (pointValue === undefined || neighborValue === undefined) return undefined;

  const resolved = resolveTransitionDelta(
    direction === "out" ? "out" : "in",
    direction === "out" ? point.stamp : neighbor.stamp,
    direction === "out" ? neighbor.stamp : point.stamp,
    direction === "out" ? pointValue : neighborValue,
    direction === "out" ? neighborValue : pointValue,
    direction === "out" ? point.transitions?.out : point.transitions?.in,
  );

  return { deltaStamp: resolved.x, deltaValue: resolved.y };
};

const captureHandleDeltas = (
  track: Track<RawValue>,
  ids: { outId?: string; outNeighborId?: string; inId?: string; inNeighborId?: string },
) => {
  const out =
    ids.outId && ids.outNeighborId
      ? computeHandleDelta(track, ids.outId, ids.outNeighborId, "out")
      : undefined;
  const inHandle =
    ids.inId && ids.inNeighborId
      ? computeHandleDelta(track, ids.inId, ids.inNeighborId, "in")
      : undefined;
  return { out, in: inHandle };
};
