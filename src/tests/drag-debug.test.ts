/**
 * Hello future AI agents. This file contains a series of drag-related tests for the animation editor.
 * Since these tests were written, the api and implementation has changed, and therefore they have been commented out.
 * However, they may contain information that could be used to infer the types of tests that should be written for the new implementation.
 * Please use this file as a reference, but do not attempt to run these tests as-is.
 *
 * When moving to updating these tests, you should consider looking at the [store.ts](../store.ts) file, which contains the current store implementation.
 * Additionally, you may need to reference the store type definitions in [store-types.ts](../store-types.ts), and implementations of the drag actions in [actions/drag.ts](../actions/drag/*.ts).
 * Drag events are executed within the context of the animation editor sheet, and most specifically on individual data-markers [data-marker.tsx](../components/canvas-sheet/data-point.tsx).
 *
 */

// import { describe, it, expect, beforeEach } from "vitest";
// import { enableMapSet, produce } from "immer";
// import type { RawValue } from "@semio/utils";
// import { InstancedFrameInfo, Track } from "../types";
// import { AnimationData } from "../store-types";
// import { startDragging, updateDragDelta } from "../actions/drag";
// import { computeVirtualFrames } from "../functions/compute-virtual-frames";
// import { createDefaultState } from "../actions/create-default-state";

// // Enable Immer MapSet plugin for tests
// enableMapSet();

// // Debug test data
// const debugTracks: Record<string, Track<RawValue>> = {
//   testTrack: {
//     id: "testTrack",
//     name: "Test Track",
//     animatableId: "testAnimatable",
//     points: [
//       { id: "testPoint", stamp: 0.1, value: 100 }, // Start at 0.1 (normalized)
//     ],
//   },
// };

// const debugSelection: InstancedFrameInfo[] = [
//   {
//     id: "debugFrame",
//     stamp: 0.1,
//     points: [{ id: "testPoint", value: 100, trackId: "testTrack" }],
//   },
// ];

// describe("Drag Position Computation Debug", () => {
//   let mockState: AnimationData;

//   beforeEach(() => {
//     mockState = {
//       ...createDefaultState(),
//       tracks: debugTracks,
//       selection: debugSelection,
//       framerate: 24,
//       duration: 10000,
//     };
//   });

//   describe("Step-by-Step Drag Computation", () => {
//     it("should debug drag state initialization", () => {
//       console.log("=== DRAG STATE INITIALIZATION DEBUG ===");
//       console.log("Initial selection:", {
//         frameCount: mockState.selection.length,
//         firstFrameStamp: mockState.selection[0]?.stamp,
//       });

//       mockState = produce(mockState, (draft) => {
//         startDragging(draft);
//       });

//       console.log("After startDragging:", {
//         isDragging: mockState.dragState?.isDragging,
//         draggedKeypointsCount: mockState.dragState?.draggedKeypoints?.size,
//         deltaStamp: mockState.dragState?.deltaStamp,
//       });

//       const dragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");
//       console.log("Drag info for testPoint:", {
//         trackId: dragInfo?.trackId,
//         keypointId: dragInfo?.keypointId,
//         originalStamp: dragInfo?.originalStamp,
//         currentOffset: dragInfo?.currentOffset,
//       });

//       expect(mockState.dragState?.isDragging).toBe(true);
//       expect(mockState.dragState?.draggedKeypoints?.size).toBe(1);
//       expect(dragInfo?.originalStamp).toBe(0.1);
//       expect(dragInfo?.currentOffset).toBe(0);
//     });

//     it("should debug coordinate conversion with various deltas", () => {
//       console.log("=== COORDINATE CONVERSION DEBUG ===");

//       mockState = produce(mockState, (draft) => {
//         startDragging(draft);
//       });

//       const testDeltas = [50, 100, -50, 41.67, 83.33];
//       const frameLength = 1000 / 24;

//       console.log(`Frame length at 24fps: ${String(frameLength)}ms`);

//       testDeltas.forEach((delta) => {
//         const normalizedDelta = delta / 10000; // Normalize to 0-1 range
//         console.log(
//           `\nTesting delta: ${String(delta)}ms (normalized: ${normalizedDelta.toString()})`,
//         );

//         mockState = produce(mockState, (draft) => {
//           updateDragDelta(draft, normalizedDelta, false);
//         });

//         const dragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");
//         const expectedPosition = 0.1 + (dragInfo?.currentOffset ?? 0);

//         console.log("Without snapping:", {
//           inputDelta: delta,
//           currentOffset: dragInfo?.currentOffset,
//           expectedPosition,
//         });

//         mockState = produce(mockState, (draft) => {
//           updateDragDelta(draft, delta, true);
//         });

//         const snappedDragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");
//         const snappedPosition = 0.1 + (snappedDragInfo?.currentOffset ?? 0);

//         console.log("With snapping:", {
//           inputDelta: delta,
//           currentOffset: snappedDragInfo?.currentOffset,
//           expectedPosition: snappedPosition,
//         });
//       });

//       expect(mockState.dragState?.isDragging).toBe(true);
//     });

//     it("should debug virtual frame computation", () => {
//       console.log("=== VIRTUAL FRAME COMPUTATION DEBUG ===");

//       mockState = produce(mockState, (draft) => {
//         startDragging(draft);
//         updateDragDelta(draft, 0.01, false); // 100ms normalized to 0.01
//       });

//       const virtualFrames = computeVirtualFrames(debugTracks, mockState.dragState);

//       console.log("Virtual frames result:", {
//         frameCount: virtualFrames.length,
//         originalStamp: 0.1,
//         deltaApplied: 0.01,
//       });

//       const virtualFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "testPoint"));

//       console.log("Virtual frame for testPoint:", {
//         found: Boolean(virtualFrame),
//         virtualStamp: virtualFrame?.stamp,
//         expectedStamp: 0.11,
//         matches: Math.abs((virtualFrame?.stamp ?? 0) - 0.11) < 0.001,
//       });

//       expect(virtualFrames.length).toBeGreaterThan(0);
//       expect(virtualFrame).toBeDefined();
//       expect(virtualFrame?.stamp).toBeCloseTo(0.11, 3);
//     });

//     it("should debug frame snapping edge cases", () => {
//       console.log("=== FRAME SNAPPING EDGE CASES DEBUG ===");

//       mockState = produce(mockState, (draft) => {
//         startDragging(draft);
//       });

//       const frameLength = 1 / 24; // Normalized frame length
//       console.log(`Frame length: ${String(frameLength)} (normalized)`);

//       const edgeCases = [
//         { delta: frameLength * 0.4, description: "Just under half frame" },
//         { delta: frameLength * 0.6, description: "Just over half frame" },
//         { delta: frameLength, description: "Exact frame boundary" },
//         { delta: -frameLength * 0.5, description: "Negative half frame" },
//       ];

//       edgeCases.forEach(({ delta, description }) => {
//         mockState = produce(mockState, (draft) => {
//           updateDragDelta(draft, delta, true);
//         });

//         const dragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");
//         const actualPosition = 0.1 + (dragInfo?.currentOffset ?? 0);

//         console.log(`${description}:`, {
//           inputDelta: delta,
//           actualOffset: dragInfo?.currentOffset,
//           resultPosition: actualPosition,
//         });
//       });

//       expect(mockState.dragState?.isDragging).toBe(true);
//     });

//     it("should debug different framerates", () => {
//       console.log("=== DIFFERENT FRAMERATES DEBUG ===");

//       const framerates = [24, 30, 60];

//       framerates.forEach((fps) => {
//         console.log(`\nTesting at ${String(fps)}fps:`);

//         mockState = produce(mockState, (draft) => {
//           draft.framerate = fps;
//         });
//         const frameLength = 1 / fps; // Normalized frame length
//         console.log(`Frame length: ${String(frameLength)} (normalized)`);

//         mockState = produce(mockState, (draft) => {
//           startDragging(draft);
//           updateDragDelta(draft, frameLength, true);
//         });

//         const dragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");
//         const actualPosition = 0.1 + (dragInfo?.currentOffset ?? 0);

//         console.log("One frame forward:", {
//           frameLength,
//           actualOffset: dragInfo?.currentOffset,
//           resultPosition: actualPosition,
//         });

//         // Reset for next test
//         mockState = produce(mockState, (draft) => {
//           draft.dragState = null;
//         });
//       });

//       expect(true).toBe(true); // Basic assertion to ensure test runs
//     });
//   });

//   describe("Integration Debug", () => {
//     it("should debug full drag workflow with logging", () => {
//       console.log("=== FULL DRAG WORKFLOW DEBUG ===");

//       // Step 1: Initialize
//       console.log("1. Initial state:", {
//         hasSelection: mockState.selection.length > 0,
//         selectionStamp: mockState.selection[0]?.stamp,
//       });

//       // Step 2: Start drag
//       mockState = produce(mockState, (draft) => {
//         startDragging(draft);
//       });

//       console.log("2. After start drag:", {
//         isDragging: mockState.dragState?.isDragging,
//         draggedCount: mockState.dragState?.draggedKeypoints?.size,
//       });

//       // Step 3: Apply delta
//       const testDelta = 0.01; // 100ms normalized to 0.01
//       mockState = produce(mockState, (draft) => {
//         updateDragDelta(draft, testDelta, false);
//       });

//       const dragInfo = mockState.dragState?.draggedKeypoints?.get("testPoint");
//       console.log("3. After delta update:", {
//         delta: testDelta,
//         currentOffset: dragInfo?.currentOffset,
//         expectedNewPosition: 0.1 + (dragInfo?.currentOffset ?? 0),
//       });

//       // Step 4: Check virtual frames
//       const virtualFrames = computeVirtualFrames(debugTracks, mockState.dragState);
//       const virtualFrame = virtualFrames.find((f) => f.points.some((p) => p.id === "testPoint"));

//       console.log("4. Virtual frame check:", {
//         found: Boolean(virtualFrame),
//         stamp: virtualFrame?.stamp,
//         pointCount: virtualFrame?.points.length,
//       });

//       // Step 5: Verify state consistency
//       console.log("5. Final state check:", {
//         stillDragging: mockState.dragState?.isDragging,
//         deltaStamp: mockState.dragState?.deltaStamp,
//         virtualFramesGenerated: virtualFrames.length > 0,
//       });

//       expect(mockState.dragState?.isDragging).toBe(true);
//       expect(dragInfo?.currentOffset).toBe(testDelta);
//       expect(virtualFrame?.stamp).toBeCloseTo(0.11, 3);
//       expect(virtualFrames.length).toBeGreaterThan(0);
//     });
//   });
// });
