import { describe, expect, it } from "vitest";
import type { RawValue } from "@semio/utils";
import { applyDragDeltas } from "../functions/apply-drag-deltas";
import type { DragState, Keypoint, SelectionState, Track } from "../types";

const buildSelection = (trackId: string, keypointId: string): SelectionState => ({
  instanceId: "instance-1",
  keypoints: new Map([[trackId, new Set([keypointId])]]),
  reference: null,
  targetedTracks: new Set(),
  targetAnchor: null,
});

const buildTrack = (points: Keypoint<RawValue>[]): Track<RawValue> => ({
  id: "track-1",
  name: "Test",
  animatableId: "anim-1",
  points,
  settings: {},
});

describe("applyDragDeltas (anchor-relative transitions)", () => {
  it("moves a selected marker without mutating its stored transitions", () => {
    const leftPoint: Keypoint<RawValue> = {
      id: "left",
      stamp: 0,
      value: 0,
      transitions: { out: { x: 0.2, y: 0 } },
    };

    const rightPoint: Keypoint<RawValue> = {
      id: "right",
      stamp: 0.5,
      value: 10,
      transitions: { in: { x: -0.1, y: 0 } },
    };

    const track = buildTrack([leftPoint, rightPoint]);

    const dragState: DragState = {
      axis: "horizontal",
      instanceId: "instance-1",
      instanceTransform: { offset: 0, timescale: 1 },
      anchor: {
        keypointId: rightPoint.id,
        trackId: track.id,
        rowId: "row-1",
      },
      stampOrigin: rightPoint.stamp,
      modifiers: { alt: false, shift: false, meta: false },
      stampDelta: { raw: 0.2 },
    };

    const selection = buildSelection(track.id, rightPoint.id);

    const updatedLeft = applyDragDeltas(leftPoint, {
      dragState,
      selection,
      trackId: track.id,
    });

    expect(updatedLeft.transitions?.out).toMatchObject(leftPoint.transitions?.out ?? {});

    const updatedRight = applyDragDeltas(rightPoint, {
      dragState,
      selection,
      trackId: track.id,
    });

    expect(updatedRight.stamp).toBeCloseTo(0.7, 6);
    expect(updatedRight.transitions?.in).toMatchObject(rightPoint.transitions?.in ?? {});
  });
});
