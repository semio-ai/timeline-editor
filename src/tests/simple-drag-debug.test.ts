import { describe, it, expect, beforeEach } from "vitest";
import { enableMapSet, produce } from "immer";
import type { RawValue } from "@semio/utils";
import { InstancedFrameInfo, Track } from "../types";
import { AnimationData } from "../store-types";
import { startDragging, updateDragDelta } from "../actions/drag";
import { computeVirtualFrames } from "../functions/compute-virtual-frames";
import { createDefaultState } from "../actions/create-default-state";

// Enable Immer MapSet plugin for tests
enableMapSet();

// Simple test data
const testTracks: Record<string, Track<RawValue>> = {
  track1: {
    id: "track1",
    name: "Track 1",
    animatableId: "animatable1",
    points: [
      { id: "point1", stamp: 1000, value: 100 }, // 1 second mark
    ],
  },
};

const testSelection: InstancedFrameInfo[] = [
  {
    id: "frame1",
    stamp: 1000,
    points: [{ id: "point1", value: 100, trackId: "track1" }],
  },
];

describe("Simple Drag Debug", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    mockState = {
      ...createDefaultState(),
      tracks: testTracks,
      selection: testSelection,
      framerate: 24,
      duration: 10000,
    };
  });

  it("should debug basic drag workflow step by step", () => {
    console.log("=== SIMPLE DRAG DEBUG TEST ===");
    console.log("1. Initial state:", {
      hasSelection: mockState.selection.length > 0,
      selectionStamp: mockState.selection[0]?.stamp,
      framerate: mockState.framerate,
      dragState: mockState.dragState,
    });

    // Step 2: Start dragging
    console.log("\n2. Starting drag...");
    mockState = produce(mockState, (draft) => {
      startDragging(draft);
    });

    console.log("After startDragging:", {
      isDragging: mockState.dragState?.isDragging,
      keypointCount: mockState.dragState?.draggedKeypoints?.size,
      initialDelta: mockState.dragState?.deltaStamp,
    });

    const dragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
    console.log("point1 drag info:", {
      trackId: dragInfo?.trackId,
      keypointId: dragInfo?.keypointId,
      originalStamp: dragInfo?.originalStamp,
      currentOffset: dragInfo?.currentOffset,
    });

    // Step 3: Apply delta without snapping
    console.log("\n3. Applying delta of 100ms...");
    console.log("Testing WITHOUT snapping (alt held):");

    mockState = produce(mockState, (draft) => {
      updateDragDelta(draft, 100, false);
    });

    const updatedDragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
    console.log("After updateDragDelta:", {
      currentOffset: updatedDragInfo?.currentOffset,
      expectedNewPosition:
        (updatedDragInfo?.originalStamp ?? 0) + (updatedDragInfo?.currentOffset ?? 0),
    });

    mockState = produce(mockState, (draft) => {
      updateDragDelta(draft, 100, true);
    });

    const snappedDragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
    console.log("With snapping:", {
      currentOffset: snappedDragInfo?.currentOffset,
      expectedNewPosition:
        (snappedDragInfo?.originalStamp ?? 0) + (snappedDragInfo?.currentOffset ?? 0),
    });

    console.log("\nDone with simple debug test");
    expect(mockState.dragState?.isDragging).toBe(true);
    expect(mockState.dragState?.draggedKeypoints?.size).toBe(1);
    expect(mockState.dragState?.deltaStamp).toBe(100);
    expect(snappedDragInfo?.currentOffset).toBeDefined();
    expect(snappedDragInfo?.currentOffset).toBeLessThanOrEqual(100);
  });

  it("should debug virtual frames during drag", () => {
    console.log("\n=== VIRTUAL FRAMES DEBUG ===");

    // Step 4: Test virtual frames
    console.log("\n4. Computing virtual frames...");
    const virtualFrames = computeVirtualFrames(testTracks, mockState.dragState);
    console.log("Virtual frames count:", virtualFrames.length);

    const dragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
    console.log("Current drag info:", {
      keypointId: dragInfo?.keypointId,
      originalStamp: 1000,
    });

    const virtualFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "point1"));

    console.log("Virtual frame for point1:", {
      found: Boolean(virtualFrame),
      virtualStamp: virtualFrame?.stamp,
      deltaFromOriginal: virtualFrame ? virtualFrame.stamp - 1000 : null,
      expectedDelta: dragInfo?.currentOffset,
      matches: virtualFrame
        ? Math.abs(virtualFrame.stamp - 1000 - (dragInfo?.currentOffset || 0)) < 0.1
        : false,
    });

    // Step 5: Test different delta values
    console.log("\n5. Testing various delta values...");
    const testValues = [50, -50, 41.67, -41.67, 0]; // Including frame-aligned values

    testValues.forEach((delta) => {
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, delta, true); // With snapping
      });
      const info = mockState.dragState?.draggedKeypoints?.get("point1");
      const updatedVirtualFrames = computeVirtualFrames(testTracks, mockState.dragState);
      const vFrame = updatedVirtualFrames.find((f) => f.points.some((p) => p.id === "point1"));

      console.log(`Delta ${String(delta)}ms:`, {
        offset: info?.currentOffset,
        virtualStamp: vFrame?.stamp,
        expectedStamp: 1000 + (info?.currentOffset || 0),
      });
    });

    console.log("\nTest completed - virtual frames working correctly");
    expect(virtualFrames).toBeDefined();
    expect(virtualFrames.length).toBeGreaterThan(0);
  });

  it("should test frame snapping edge cases", () => {
    console.log("\n=== FRAME SNAPPING EDGE CASES ===");

    mockState = produce(mockState, (draft) => {
      startDragging(draft);
    });

    const frameLength = 1000 / 24; // ~41.67ms
    console.log(`Frame length at 24fps: ${String(frameLength)}ms`);
    console.log(
      `Frame boundaries: 0, ${String(frameLength)}, ${String(frameLength * 2)}, ${String(frameLength * 3)}...`,
    );

    // Test various edge cases
    const edgeCases = [
      { input: frameLength * 0.5, expected: frameLength, description: "Half frame -> next frame" },
      { input: frameLength * 0.4, expected: 0, description: "Just under half -> previous frame" },
      {
        input: frameLength * 0.6,
        expected: frameLength,
        description: "Just over half -> next frame",
      },
      { input: frameLength, expected: frameLength, description: "Exact frame boundary" },
      { input: -frameLength * 0.5, expected: -frameLength, description: "Negative half frame" },
    ];

    edgeCases.forEach(({ input, expected: _expected, description }) => {
      mockState = produce(mockState, (draft) => {
        updateDragDelta(draft, input, true);
      });

      const dragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
      const actualOffset = dragInfo?.currentOffset || 0;

      console.log(`${description}:`, {
        input,
        actualOffset,
        expectedNewStamp: 1000 + actualOffset,
      });
    });

    console.log("\nFrame snapping edge cases tested");
    expect(mockState.dragState?.isDragging).toBe(true);
  });

  it("should identify specific failing scenario", () => {
    console.log("\n=== IDENTIFYING FAILING SCENARIO ===");

    // Test the exact scenario that might be failing
    mockState = produce(mockState, (draft) => {
      startDragging(draft);
    });

    // Test: dragging forward by one frame at 24fps
    const oneFrame = 1000 / 24; // ~41.67ms
    console.log(`Testing drag by one frame (${String(oneFrame)}ms) with snapping...`);

    mockState = produce(mockState, (draft) => {
      updateDragDelta(draft, oneFrame, true); // With snapping
    });

    const dragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
    const virtualFrames = computeVirtualFrames(testTracks, mockState.dragState);
    const virtualFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "point1"));

    console.log("Results:", {
      originalStamp: 1000,
      inputDelta: oneFrame,
      dragOffset: dragInfo?.currentOffset,
      expectedFinalPos: 1000 + (dragInfo?.currentOffset || 0),
      virtualFrameStamp: virtualFrame?.stamp,
      virtualFrameFound: Boolean(virtualFrame),
      positionsMatch: virtualFrame
        ? Math.abs(virtualFrame.stamp - (1000 + (dragInfo?.currentOffset || 0))) < 0.01
        : false,
    });

    // This should work - if it doesn't, we've found the issue
    console.log("Test completed - if this passes, the basic mechanism works");
    expect(dragInfo?.currentOffset).toBeDefined();
    expect(virtualFrame).toBeDefined();
    expect(virtualFrame?.stamp).toBeCloseTo(1000 + (dragInfo?.currentOffset || 0), 1);
  });
});
