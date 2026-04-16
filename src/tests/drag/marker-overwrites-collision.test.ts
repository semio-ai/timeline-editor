import { describe, expect, it } from "vitest";
import {
  createTestAnimationStore,
  TRACK_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { DerivedSnapshot, TrackKey } from "../../types";

const buildRowId = (trackId: string): TrackKey =>
  `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${trackId}`;

describe("marker drag overwrites coincident marker", () => {
  it("drops the existing point when a dragged marker lands on the same stamp", () => {
    const store = createTestAnimationStore({ includeNamespaceB: false });

    const trackId = TRACK_IDS.OPACITY;
    const anchorId = "o2"; // we will move this onto o1's stamp
    const targetId = "o1";
    const rowId = buildRowId(trackId);

    const track = store.getState().tracks[trackId];
    const anchor = track.points.find((p) => p.id === anchorId);
    const target = track.points.find((p) => p.id === targetId);
    if (!anchor || !target) throw new Error("fixture points missing");

    // Minimal derived snapshot to satisfy startDrag lookup.
    const derived: DerivedSnapshot = {
      tracks: {},
      rows: {
        [rowId]: {
          id: rowId,
          trackKeys: [rowId],
          computed: {
            verticalBounds: { min: -1, max: 2 },
            violationSet: { id: rowId, violations: {}, segments: [] },
            virtualFrames: [
              {
                id: anchorId,
                stamp: anchor.stamp,
                points: [
                  {
                    id: anchorId,
                    trackId,
                    stamp: anchor.stamp,
                    selectable: true,
                    editable: true,
                  } as any,
                ],
              },
              {
                id: targetId,
                stamp: target.stamp,
                points: [
                  {
                    id: targetId,
                    trackId,
                    stamp: target.stamp,
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
        reference: { rowId, markerId: anchorId },
        keypoints: new Map([[trackId, new Set([anchorId])]]),
        targetedTracks: new Set(),
        targetAnchor: null,
      },
    });

    store.getState().startDrag({
      axis: "horizontal",
      markerId: anchorId,
      rowId,
    });

    store.getState().updateDrag({
      normalizedStamp: { current: target.stamp },
      modifiers: { alt: false, shift: false, meta: false },
    });

    store.getState().commitDrag();

    const updatedTrack = store.getState().tracks[trackId];
    const updatedAnchor = updatedTrack.points.find((p) => p.id === anchorId);

    expect(updatedAnchor?.stamp).toBeCloseTo(target.stamp, 6);
    expect(updatedTrack.points.some((p) => p.id === targetId)).toBe(false);
    expect(updatedTrack.points.length).toBe(track.points.length - 1);
  });
});
