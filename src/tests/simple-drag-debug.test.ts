import { describe, it, expect, beforeEach, vi } from "vitest";
import { enableMapSet } from "immer";
import type { RawValue } from "@semio/utils";
import { InstancedFrameInfo, Track } from "../types";
import { AnimationData } from "../store-types";
import { startDragging, updateDragDelta, commitDrag } from "../actions/drag";
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
  let mockState: any;

  const mockGet = () => mockState as any;
  const mockSet = (updater: any) => {
    if (typeof updater === "function") {
      const result = updater({ ...mockState });
      mockState = { ...mockState, ...result };
    } else {
      mockState = { ...mockState, ...updater };
    }
  };

  beforeEach(() => {
    mockState = {
      ...createDefaultState(),
      tracks: testTracks,
      selection: testSelection,
      framerate: 24,
      dragState: null,
    };
  });

  it("should debug basic drag workflow step by step", () => {
    console.log("=== SIMPLE DRAG DEBUG TEST ===");

    // Step 1: Check initial state
    console.log("1. Initial state:", {
      hasSelection: mockState.selection.length > 0,
      selectionStamp: mockState.selection[0]?.stamp,
      framerate: mockState.framerate,
      dragState: mockState.dragState,
    });

    // Step 2: Start dragging
    console.log("\n2. Starting drag...");
    startDragging(mockGet, mockSet);

    console.log("After startDragging:", {
      isDragging: mockState.dragState?.isDragging,
      keypointCount: mockState.dragState?.draggedKeypoints?.size,
      initialDelta: mockState.dragState?.deltaStamp,
    });

    if (mockState.dragState?.draggedKeypoints) {
      const dragInfo = mockState.dragState.draggedKeypoints.get("point1");
      console.log("point1 drag info:", dragInfo);
    }

    // Step 3: Apply a simple drag delta
    const testDelta = 100; // 100ms forward
    console.log(`\n3. Applying delta of ${testDelta}ms...`);

    console.log("Testing WITHOUT snapping (alt held):");
    updateDragDelta(mockGet, mockSet, testDelta, false);

    let dragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
    console.log("Result without snapping:", {
      inputDelta: testDelta,
      currentOffset: dragInfo?.currentOffset,
      expectedPosition: dragInfo?.originalStamp + dragInfo?.currentOffset,
    });

    console.log("\nTesting WITH snapping (default):");
    updateDragDelta(mockGet, mockSet, testDelta, true);

    dragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
    const frameLength = 1000 / 24; // ~41.67ms
    const absolutePos = 1000 + testDelta; // 1100ms
    const expectedFrame = Math.round(absolutePos / frameLength);
    const expectedSnappedPos = expectedFrame * frameLength;
    const expectedOffset = expectedSnappedPos - 1000;

    console.log("Result with snapping:", {
      inputDelta: testDelta,
      frameLength: frameLength,
      absolutePosition: absolutePos,
      expectedFrame: expectedFrame,
      expectedSnappedPos: expectedSnappedPos,
      expectedOffset: expectedOffset,
      actualOffset: dragInfo?.currentOffset,
      match: Math.abs((dragInfo?.currentOffset || 0) - expectedOffset) < 0.1,
    });

    // Step 4: Test virtual frames
    console.log("\n4. Testing virtual frames...");
    const virtualFrames = computeVirtualFrames(testTracks, mockState.dragState);

    console.log("Virtual frames result:", {
      frameCount: virtualFrames.length,
      originalStamp: 1000,
    });

    const virtualFrame = virtualFrames.find(f =>
      f.points.some(p => p.id === "point1")
    );

    console.log("Virtual frame for point1:", {
      found: !!virtualFrame,
      virtualStamp: virtualFrame?.stamp,
      deltaFromOriginal: virtualFrame ? virtualFrame.stamp - 1000 : null,
      expectedDelta: dragInfo?.currentOffset,
      matches: virtualFrame ? Math.abs(virtualFrame.stamp - 1000 - (dragInfo?.currentOffset || 0)) < 0.1 : false,
    });

    // Step 5: Test different delta values
    console.log("\n5. Testing various delta values...");
    const testValues = [50, -50, 41.67, -41.67, 0]; // Including frame-aligned values

    testValues.forEach(delta => {
      updateDragDelta(mockGet, mockSet, delta, true); // With snapping
      const info = mockState.dragState?.draggedKeypoints?.get("point1");
      const virtualFrames = computeVirtualFrames(testTracks, mockState.dragState);
      const vFrame = virtualFrames.find(f => f.points.some(p => p.id === "point1"));

      console.log(`Delta ${delta}ms:`, {
        offset: info?.currentOffset,
        virtualStamp: vFrame?.stamp,
        deltaFromOriginal: vFrame ? vFrame.stamp - 1000 : null,
      });
    });

    // Verify basic expectations
    expect(mockState.dragState?.isDragging).toBe(true);
    expect(mockState.dragState?.draggedKeypoints?.size).toBe(1);
    expect(virtualFrames.length).toBeGreaterThan(0);

    console.log("\n=== END DEBUG TEST ===");
  });

  it("should test frame snapping edge cases", () => {
    console.log("\n=== FRAME SNAPPING EDGE CASES ===");

    startDragging(mockGet, mockSet);

    const frameLength = 1000 / 24; // ~41.67ms
    console.log(`Frame length at 24fps: ${frameLength}ms`);
    console.log(`Frame boundaries: 0, ${frameLength}, ${frameLength * 2}, ${frameLength * 3}...`);

    // Test values that should snap to specific frames
    const edgeCases = [
      { input: frameLength * 0.5, expected: frameLength, description: "Half frame -> next frame" },
      { input: frameLength * 0.4, expected: 0, description: "Just under half -> previous frame" },
      { input: frameLength * 0.6, expected: frameLength, description: "Just over half -> next frame" },
      { input: frameLength, expected: frameLength, description: "Exact frame boundary" },
      { input: -frameLength * 0.5, expected: -frameLength, description: "Negative half frame" },
    ];

    edgeCases.forEach(({ input, expected, description }) => {
      updateDragDelta(mockGet, mockSet, input, true);
      const dragInfo = mockState.dragState?.draggedKeypoints?.get("point1");

      // Manual calculation for verification
      const absolutePos = 1000 + input;
      const nearestFrame = Math.round(absolutePos / frameLength);
      const snappedPos = nearestFrame * frameLength;
      const calculatedOffset = snappedPos - 1000;

      console.log(`${description}:`, {
        input: input,
        absolutePos: absolutePos,
        nearestFrame: nearestFrame,
        snappedPos: snappedPos,
        calculatedOffset: calculatedOffset,
        actualOffset: dragInfo?.currentOffset,
        difference: Math.abs((dragInfo?.currentOffset || 0) - calculatedOffset),
        withinTolerance: Math.abs((dragInfo?.currentOffset || 0) - calculatedOffset) < 0.01,
      });

      // Verify the calculation is correct
      expect(dragInfo?.currentOffset).toBeCloseTo(calculatedOffset, 2);
    });
  });

  it("should identify specific failing scenario", () => {
    console.log("\n=== IDENTIFYING FAILING SCENARIO ===");

    // Test the exact scenario that might be failing
    startDragging(mockGet, mockSet);

    // Test: dragging forward by one frame at 24fps
    const oneFrame = 1000 / 24; // ~41.67ms
    console.log(`Testing drag by one frame (${oneFrame}ms)`);

    updateDragDelta(mockGet, mockSet, oneFrame, true); // With snapping enabled

    const dragInfo = mockState.dragState?.draggedKeypoints?.get("point1");
    const virtualFrames = computeVirtualFrames(testTracks, mockState.dragState);
    const virtualFrame = virtualFrames.find(f => f.points.some(p => p.id === "point1"));

    console.log("Results:", {
      originalStamp: 1000,
      inputDelta: oneFrame,
      dragOffset: dragInfo?.currentOffset,
      expectedFinalPos: 1000 + (dragInfo?.currentOffset || 0),
      virtualFrameStamp: virtualFrame?.stamp,
      virtualFrameFound: !!virtualFrame,
      positionsMatch: virtualFrame ? Math.abs(virtualFrame.stamp - (1000 + (dragInfo?.currentOffset || 0))) < 0.01 : false,
    });

    // This should work - if it doesn't, we've found the issue
    expect(virtualFrame).toBeDefined();
    expect(virtualFrame?.stamp).not.toBe(1000); // Should have moved

    if (virtualFrame && dragInfo) {
      expect(virtualFrame.stamp).toBeCloseTo(1000 + dragInfo.currentOffset, 1);
    }

    console.log("Test completed - if this passes, the basic mechanism works");
  });
});
