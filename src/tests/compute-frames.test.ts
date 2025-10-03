// import { describe, it, expect } from "vitest";
// import { RawValue } from "@semio/utils";
// import { computeFrames } from "../functions/compute-frames";
// import { Track } from "../types";

// describe("computeFrames", () => {
//   it("should compute frames from single track", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-1",
//             stamp: 0.25,
//             value: 100,
//             transitions: { out: { x: 0, y: 0 } },
//           },
//           {
//             id: "point-2",
//             stamp: 0.5,
//             value: 200,
//             transitions: { in: { x: 0.1, y: 1 }, out: { x: 0.8, y: 0.2 } },
//           },
//           {
//             id: "point-3",
//             stamp: 0.75,
//             value: 300,
//           },
//         ],
//       },
//     };

//     const frames = computeFrames(tracks);

//     expect(frames).toHaveLength(3);
//     expect(frames[0].stamp).toBe(0.25);
//     expect(frames[0].transitions).toEqual({ out: { x: 0, y: 0 } });
//     expect(frames[1].stamp).toBe(0.5);
//     expect(frames[1].transitions).toEqual({ in: { x: 0.1, y: 1 }, out: { x: 0.8, y: 0.2 } });
//     expect(frames[2].stamp).toBe(0.75);
//     expect(frames[2].transitions).toBeUndefined();
//   });

//   it("should merge points from multiple tracks at same timestamp", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-1",
//             stamp: 0.5,
//             value: 100,
//           },
//         ],
//       },
//       "track-2": {
//         id: "track-2",
//         name: "Track 2",
//         animatableId: "animatable-2",
//         points: [
//           {
//             id: "point-2",
//             stamp: 0.5,
//             value: 200,
//           },
//         ],
//       },
//     };

//     const frames = computeFrames(tracks);

//     expect(frames).toHaveLength(1);
//     expect(frames[0].stamp).toBe(0.5);
//     expect(frames[0].points).toHaveLength(2);
//     expect(frames[0].id).toBe("point-1-point-2");
//     // Transitions should be undefined when multiple points exist
//     expect(frames[0].transitions).toBeUndefined();
//   });

//   it("should preserve transitions for single point at timestamp", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-1",
//             stamp: 0.5,
//             value: 100,
//             transitions: { in: { x: 0.2, y: 0.8 }, out: { x: 0.5, y: 0.5 } },
//           },
//         ],
//       },
//     };

//     const frames = computeFrames(tracks);

//     expect(frames).toHaveLength(1);
//     expect(frames[0].transitions).toEqual({
//       in: { x: 0.2, y: 0.8 },
//       out: { x: 0.5, y: 0.5 },
//     });
//   });

//   it("should clear transitions when multiple points exist at same timestamp", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-1",
//             stamp: 0.5,
//             value: 100,
//             transitions: { in: { x: 0.1, y: 0.9 }, out: { x: 0.2, y: 0.8 } },
//           },
//         ],
//       },
//       "track-2": {
//         id: "track-2",
//         name: "Track 2",
//         animatableId: "animatable-2",
//         points: [
//           {
//             id: "point-2",
//             stamp: 0.5,
//             value: 200,
//             transitions: { in: { x: 0.3, y: 0.7 }, out: { x: 0.4, y: 0.6 } },
//           },
//         ],
//       },
//     };

//     const frames = computeFrames(tracks);

//     expect(frames).toHaveLength(1);
//     expect(frames[0].stamp).toBe(0.5);
//     expect(frames[0].points).toHaveLength(2);
//     // Transitions should be cleared when multiple points exist
//     expect(frames[0].transitions).toBeUndefined();
//   });

//   it("should handle dragging frames separately", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-1",
//             stamp: 0.5,
//             value: 100,
//           },
//           {
//             id: "point-2",
//             stamp: 0.5,
//             value: 200,
//           },
//         ],
//       },
//     };

//     const draggingFrameIds = ["point-1"];
//     const frames = computeFrames(tracks, draggingFrameIds);

//     // Points with different dragging states should create separate frames
//     expect(frames).toHaveLength(2);
//     expect(frames[0].stamp).toBe(0.5);
//     expect(frames[1].stamp).toBe(0.5);

//     // One frame should have the dragging point
//     const draggingFrame = frames.find((f) => f.points.some((p) => p.id === "point-1"));
//     expect(draggingFrame).toBeDefined();
//     expect(draggingFrame?.points).toHaveLength(1);

//     // Other frame should have the non-dragging point
//     const nonDraggingFrame = frames.find((f) => f.points.some((p) => p.id === "point-2"));
//     expect(nonDraggingFrame).toBeDefined();
//     expect(nonDraggingFrame?.points).toHaveLength(1);
//   });

//   it("should sort frames by timestamp", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-3",
//             stamp: 0.75,
//             value: 300,
//           },
//           {
//             id: "point-1",
//             stamp: 0.25,
//             value: 100,
//           },
//           {
//             id: "point-2",
//             stamp: 0.5,
//             value: 200,
//           },
//         ],
//       },
//     };

//     const frames = computeFrames(tracks);

//     expect(frames).toHaveLength(3);
//     expect(frames[0].stamp).toBe(0.25);
//     expect(frames[1].stamp).toBe(0.5);
//     expect(frames[2].stamp).toBe(0.75);
//   });

//   it("should handle empty tracks", () => {
//     const tracks: Record<string, Track<RawValue>> = {};
//     const frames = computeFrames(tracks);

//     expect(frames).toEqual([]);
//   });

//   it("should handle tracks with no points", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [],
//       },
//     };

//     const frames = computeFrames(tracks);

//     expect(frames).toEqual([]);
//   });

//   it("should update frame ID when points are added", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-1",
//             stamp: 0.5,
//             value: 100,
//           },
//         ],
//       },
//       "track-2": {
//         id: "track-2",
//         name: "Track 2",
//         animatableId: "animatable-2",
//         points: [
//           {
//             id: "point-2",
//             stamp: 0.5,
//             value: 200,
//           },
//         ],
//       },
//       "track-3": {
//         id: "track-3",
//         name: "Track 3",
//         animatableId: "animatable-3",
//         points: [
//           {
//             id: "point-3",
//             stamp: 0.5,
//             value: 300,
//           },
//         ],
//       },
//     };

//     const frames = computeFrames(tracks);

//     expect(frames).toHaveLength(1);
//     expect(frames[0].points).toHaveLength(3);
//     // Frame ID should be concatenation of all point IDs sorted
//     expect(frames[0].id).toBe("point-1-point-2-point-3");
//   });

//   it("should not merge points with same ID but different dragging state", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-1",
//             stamp: 0.5,
//             value: 100,
//           },
//         ],
//       },
//       "track-2": {
//         id: "track-2",
//         name: "Track 2",
//         animatableId: "animatable-2",
//         points: [
//           {
//             id: "point-2",
//             stamp: 0.5,
//             value: 200,
//           },
//         ],
//       },
//     };

//     // Mark one point as dragging
//     const draggingFrameIds = ["point-1"];
//     const frames = computeFrames(tracks, draggingFrameIds);

//     // Should create separate frames for dragging and non-dragging points
//     expect(frames).toHaveLength(2);

//     const draggingFrame = frames.find((f) => f.id === "point-1");
//     const nonDraggingFrame = frames.find((f) => f.id === "point-2");

//     expect(draggingFrame).toBeDefined();
//     expect(nonDraggingFrame).toBeDefined();
//     expect(draggingFrame?.points).toHaveLength(1);
//     expect(nonDraggingFrame?.points).toHaveLength(1);
//   });

//   it("should handle complex scenario with multiple tracks and timestamps", () => {
//     const tracks: Record<string, Track<RawValue>> = {
//       "track-1": {
//         id: "track-1",
//         name: "Track 1",
//         animatableId: "animatable-1",
//         points: [
//           {
//             id: "point-1-1",
//             stamp: 0.25,
//             value: 100,
//             transitions: { out: { x: 0, y: 0 } },
//           },
//           {
//             id: "point-1-2",
//             stamp: 0.5,
//             value: 150,
//           },
//           {
//             id: "point-1-3",
//             stamp: 0.75,
//             value: 200,
//             transitions: { in: { x: 1, y: 1 } },
//           },
//         ],
//       },
//       "track-2": {
//         id: "track-2",
//         name: "Track 2",
//         animatableId: "animatable-2",
//         points: [
//           {
//             id: "point-2-1",
//             stamp: 0.5,
//             value: 300,
//           },
//           {
//             id: "point-2-2",
//             stamp: 1.0,
//             value: 400,
//             transitions: { in: { x: 0.5, y: 0.5 } },
//           },
//         ],
//       },
//     };

//     const frames = computeFrames(tracks);

//     expect(frames).toHaveLength(4);

//     // Frame at 0.25 - single point with transitions
//     expect(frames[0].stamp).toBe(0.25);
//     expect(frames[0].points).toHaveLength(1);
//     expect(frames[0].transitions).toEqual({ out: { x: 0, y: 0 } });

//     // Frame at 0.5 - multiple points, no transitions
//     expect(frames[1].stamp).toBe(0.5);
//     expect(frames[1].points).toHaveLength(2);
//     expect(frames[1].transitions).toBeUndefined();

//     // Frame at 0.75 - single point with transitions
//     expect(frames[2].stamp).toBe(0.75);
//     expect(frames[2].points).toHaveLength(1);
//     expect(frames[2].transitions).toEqual({ in: { x: 1, y: 1 } });

//     // Frame at 1.0 - single point with transitions
//     expect(frames[3].stamp).toBe(1.0);
//     expect(frames[3].points).toHaveLength(1);
//     expect(frames[3].transitions).toEqual({ in: { x: 0.5, y: 0.5 } });
//   });
// });
