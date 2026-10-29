import { describe, expect, it } from "vitest";
import type { RawValue } from "@semio/data";
import { LayerBand, type SourceRow, type Track } from "../types";
import { computeFrames } from "../functions/compute-frames";

describe("computeFrames anchor frame id stabilization", () => {
  it("applies anchorFrameId only to the matching anchor track", () => {
    const tracks: Record<string, Track<RawValue>> = {
      trackA: {
        id: "trackA",
        name: "Track A",
        animatableId: "anim-a",
        points: [
          { id: "shared-id", stamp: 0.2, value: 1 },
          { id: "a-1", stamp: 0.8, value: 0 },
        ],
      },
      trackB: {
        id: "trackB",
        name: "Track B",
        animatableId: "anim-b",
        points: [
          { id: "shared-id", stamp: 0.4, value: 0.5 },
          { id: "b-1", stamp: 0.9, value: 0.75 },
        ],
      },
    };

    const sourceRow: SourceRow = {
      id: "row-1",
      data: [
        {
          editable: true,
          selectable: true,
          layerBand: LayerBand.Background,
          trackId: "trackA",
          animatableId: "anim-a",
          namespaceId: "ns-1",
          instanceId: "inst-1",
          animationId: "anim-1",
          type: "number",
          muted: false,
        },
        {
          editable: true,
          selectable: true,
          layerBand: LayerBand.Background,
          trackId: "trackB",
          animatableId: "anim-b",
          namespaceId: "ns-1",
          instanceId: "inst-1",
          animationId: "anim-1",
          type: "number",
          muted: false,
        },
      ],
    };

    const anchorFrameId = "anchor-stable";
    const frames = computeFrames(tracks, sourceRow, {
      ignoreDraggingState: true,
      anchorFrameKey: "shared-id",
      anchorFrameId,
      anchorTrackId: "trackA",
      anchorNamespaceId: "ns-1",
      anchorInstanceId: "inst-1",
    });

    const anchorFrames = frames.filter((frame) => frame.id === anchorFrameId);
    expect(anchorFrames).toHaveLength(1);
    expect(anchorFrames[0]?.points.some((point) => point.trackId === "trackA")).toBe(true);

    const ids = frames.map((frame) => frame.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      frames.some(
        (frame) =>
          frame.stamp === 0.4 &&
          frame.points.some((point) => point.trackId === "trackB") &&
          frame.id !== anchorFrameId,
      ),
    ).toBe(true);
  });
});
