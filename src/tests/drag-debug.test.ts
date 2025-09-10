import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { enableMapSet } from "immer";
import type { RawValue } from "@semio/utils";
import { InstancedFrameInfo, Track } from "../types";
import { AnimationData } from "../store-types";
import { startDragging, updateDragDelta } from "../actions/drag";
import { computeVirtualFrames } from "../functions/compute-virtual-frames";
import { createDefaultState } from "../actions/create-default-state";

// Enable Immer MapSet plugin for tests
enableMapSet();

// Debug test data
const debugTracks: Record<string, Track<RawValue>> = {
  testTrack: {
    id: "testTrack",
    name: "Test Track",
    animatableId: "testAnimatable",
    points: [
      { id: "testPoint", stamp: 1000, value: 100 }, // Start at 1 second (1000ms)
    ],
  },
};

const debugSelection: InstancedFrameInfo[] = [
  {
    id: "debugFrame",
    stamp: 1000,
    points: [{ id: "testPoint", value: 100, trackId: "testTrack" }],
  },
];

describe("Drag Position Computation Debug", () => {
  let mockState: any;
  let consoleLog: any;

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
      tracks: debugTracks,
      selection: debugSelection,
      framerate: 24, // 24 FPS for debugging
      dragState: null,
    };

    // Capture console logs for debugging
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  describe("Step-by-Step Drag Computation", () => {
    it("should debug drag state initialization", () => {
      console.log("=== DEBUGGING DRAG STATE INITIALIZATION ===");

      console.log("Initial state:", {
        tracks: Object.keys(mockState.tracks),
        selection: mockState.selection,
        framerate: mockState.framerate,
      });

      startDragging(mockGet, mockSet);

      console.log("After startDragging:", {
        isDragging: mockState.dragState?.isDragging,
        draggedKeypointsCount: mockState.dragState?.draggedKeypoints?.size,
        deltaStamp: mockState.dragState?.deltaStamp,
      });

      if (mockState.dragState?.draggedKeypoints) {
        mockState.dragState.draggedKeypoints.forEach((dragInfo: any, keypointId: string) => {
          console.log(`Dragged keypoint ${keypointId}:`, dragInfo);
        });
      }

      expect(mockState.dragState?.isDragging).toBe(true);
      expect(mockState.dragState?.draggedKeypoints?.size).toBe(1);
    });

    it("should debug coordinate conversion with various deltas", () => {
      console.log("=== DEBUGGING COORDINATE CONVERSION ===");

      startDragging(mockGet, mockSet);

      const testDeltas = [50, 100, -50, 41.67, 83.33]; // Include frame-aligned values
      const frameLength = 1000 / 24; // ~41.67ms per frame at 24fps

      console.log(`Frame length at 24fps: ${frameLength}ms`);

      testDeltas.forEach((deltaStamp, index) => {
        console.log(`\n--- Test ${index + 1}: deltaStamp = ${deltaStamp} ---`);

        // Test with snapping enabled (non-alt case)
        updateDragDelta(mockGet, mockSet, deltaStamp, true);

        const dragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");

        console.log("With snapping enabled:", {
          inputDelta: deltaStamp,
          originalStamp: dragInfo?.originalStamp,
          currentOffset: dragInfo?.currentOffset,
          wouldSnapTo: dragInfo?.originalStamp + dragInfo?.currentOffset,
        });

        // Calculate expected snapping
        const absolutePosition = 1000 + deltaStamp;
        const expectedFrame = Math.round(absolutePosition / frameLength);
        const expectedSnappedPos = expectedFrame * frameLength;
        const expectedOffset = expectedSnappedPos - 1000;

        console.log("Expected snapping calculation:", {
          absolutePosition,
          nearestFrame: expectedFrame,
          expectedSnappedPos,
          expectedOffset,
        });

        // Test with snapping disabled (alt case)
        updateDragDelta(mockGet, mockSet, deltaStamp, false);

        const dragInfoNoSnap = mockState.dragState?.draggedKeypoints?.get("testPoint");

        console.log("With snapping disabled:", {
          inputDelta: deltaStamp,
          currentOffset: dragInfoNoSnap?.currentOffset,
          exactPosition: dragInfoNoSnap?.originalStamp + dragInfoNoSnap?.currentOffset,
        });
      });
    });

    it("should debug virtual frame computation", () => {
      console.log("=== DEBUGGING VIRTUAL FRAME COMPUTATION ===");

      startDragging(mockGet, mockSet);

      // Test different drag deltas
      const testCases = [
        { deltaStamp: 100, snapEnabled: true, description: "100ms with snapping" },
        { deltaStamp: 100, snapEnabled: false, description: "100ms without snapping" },
        { deltaStamp: 41.67, snapEnabled: true, description: "One frame with snapping" },
        { deltaStamp: -50, snapEnabled: true, description: "Negative delta with snapping" },
      ];

      testCases.forEach((testCase, index) => {
        console.log(`\n--- Virtual Frame Test ${index + 1}: ${testCase.description} ---`);

        updateDragDelta(mockGet, mockSet, testCase.deltaStamp, testCase.snapEnabled);

        const dragState = mockState.dragState;
        const virtualFrames = computeVirtualFrames(debugTracks, dragState);

        console.log("Drag state:", {
          deltaStamp: dragState?.deltaStamp,
          draggedKeypointOffset: dragState?.draggedKeypoints?.get("testPoint")?.currentOffset,
        });

        console.log("Virtual frames:", {
          frameCount: virtualFrames.length,
          frames: virtualFrames.map((f) => ({
            id: f.id,
            stamp: f.stamp,
            pointIds: f.points.map((p) => p.id),
          })),
        });

        const testPointFrame = virtualFrames.find((f) =>
          f.points.some((p) => p.id === "testPoint"),
        );

        console.log("Test point virtual frame:", {
          originalStamp: 1000,
          virtualStamp: testPointFrame?.stamp,
          deltaFromOriginal: testPointFrame ? testPointFrame.stamp - 1000 : "NOT FOUND",
        });

        expect(virtualFrames.length).toBeGreaterThan(0);
        expect(testPointFrame).toBeDefined();
      });
    });

    it("should debug frame snapping edge cases", () => {
      console.log("=== DEBUGGING FRAME SNAPPING EDGE CASES ===");

      const frameLength = 1000 / 24; // ~41.67ms
      console.log(
        `Frame boundaries at 24fps: 0, ${frameLength}, ${frameLength * 2}, ${frameLength * 3}, etc.`,
      );

      // Test cases around frame boundaries
      const edgeCases = [
        { delta: frameLength / 2, description: "Half frame forward" },
        { delta: frameLength, description: "Exactly one frame forward" },
        { delta: frameLength * 1.5, description: "One and half frames forward" },
        { delta: -frameLength / 2, description: "Half frame backward" },
        { delta: frameLength * 0.4, description: "Just under half frame" },
        { delta: frameLength * 0.6, description: "Just over half frame" },
      ];

      startDragging(mockGet, mockSet);

      edgeCases.forEach((testCase, index) => {
        console.log(`\n--- Edge Case ${index + 1}: ${testCase.description} ---`);
        console.log(`Input delta: ${testCase.delta}ms`);

        updateDragDelta(mockGet, mockSet, testCase.delta, true); // With snapping

        const dragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");
        const originalStamp = 1000;
        const absolutePos = originalStamp + testCase.delta;

        // Manual calculation
        const expectedFrame = Math.round(absolutePos / frameLength);
        const expectedSnappedPos = expectedFrame * frameLength;
        const expectedOffset = expectedSnappedPos - originalStamp;

        console.log("Manual calculation:", {
          absolutePosition: absolutePos,
          nearestFrame: expectedFrame,
          expectedSnappedPosition: expectedSnappedPos,
          expectedOffset: expectedOffset,
        });

        console.log("Actual result:", {
          actualOffset: dragInfo?.currentOffset,
          actualPosition: originalStamp + (dragInfo?.currentOffset || 0),
          difference: Math.abs((dragInfo?.currentOffset || 0) - expectedOffset),
        });

        // Check if they match within reasonable precision
        const tolerance = 0.001; // 1ms tolerance
        if (dragInfo) {
          expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 3);
        }
      });
    });

    it("should debug different framerates", () => {
      console.log("=== DEBUGGING DIFFERENT FRAMERATES ===");

      const framerates = [24, 30, 60, 25]; // Common framerates
      const testDelta = 100; // 100ms drag

      startDragging(mockGet, mockSet);

      framerates.forEach((framerate) => {
        console.log(`\n--- Testing framerate: ${framerate}fps ---`);

        mockState.framerate = framerate;
        const frameLength = 1000 / framerate;

        console.log(`Frame length: ${frameLength}ms`);

        updateDragDelta(mockGet, mockSet, testDelta, true); // With snapping

        const dragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");
        const originalStamp = 1000;

        // Expected calculation
        const absolutePos = originalStamp + testDelta;
        const expectedFrame = Math.round(absolutePos / frameLength);
        const expectedSnappedPos = expectedFrame * frameLength;
        const expectedOffset = expectedSnappedPos - originalStamp;

        console.log("Results:", {
          inputDelta: testDelta,
          absolutePosition: absolutePos,
          nearestFrame: expectedFrame,
          expectedSnappedPos,
          expectedOffset,
          actualOffset: dragInfo?.currentOffset,
          matches: Math.abs((dragInfo?.currentOffset || 0) - expectedOffset) < 0.001,
        });

        if (dragInfo) {
          expect(dragInfo.currentOffset).toBeCloseTo(expectedOffset, 3);
        }
      });
    });
  });

  describe("Integration Debug", () => {
    it("should debug full drag workflow with logging", () => {
      console.log("=== DEBUGGING FULL DRAG WORKFLOW ===");

      console.log("Step 1: Initialize drag");
      startDragging(mockGet, mockSet);

      console.log("Initial drag state:", {
        isDragging: mockState.dragState?.isDragging,
        keypoints: Array.from(mockState.dragState?.draggedKeypoints || []).map(
          ([id, info]: [string, any]) => ({
            id,
            originalStamp: info.originalStamp,
            currentOffset: info.currentOffset,
          }),
        ),
      });

      console.log("\nStep 2: Apply drag delta (snapping enabled)");
      const testDelta = 125; // 125ms
      updateDragDelta(mockGet, mockSet, testDelta, true);

      console.log("After drag delta:", {
        deltaStamp: mockState.dragState?.deltaStamp,
        keypoints: Array.from(mockState.dragState?.draggedKeypoints || []).map(
          ([id, info]: [string, any]) => ({
            id,
            originalStamp: info.originalStamp,
            currentOffset: info.currentOffset,
            finalPosition: info.originalStamp + info.currentOffset,
          }),
        ),
      });

      console.log("\nStep 3: Compute virtual frames");
      const virtualFrames = computeVirtualFrames(debugTracks, mockState.dragState);

      console.log("Virtual frames:", {
        count: virtualFrames.length,
        frames: virtualFrames.map((f) => ({
          id: f.id,
          stamp: f.stamp,
          originalStamp: debugTracks.testTrack.points.find((p) => p.id === f.points[0]?.id)?.stamp,
          deltaFromOriginal:
            f.stamp -
            (debugTracks.testTrack.points.find((p) => p.id === f.points[0]?.id)?.stamp || 0),
        })),
      });

      // Verify the workflow produces expected results
      const testPointFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "testPoint"));

      expect(testPointFrame).toBeDefined();
      expect(testPointFrame!.stamp).not.toBe(1000); // Should have moved from original position

      console.log("\nWorkflow completed successfully!");
    });
  });
});
