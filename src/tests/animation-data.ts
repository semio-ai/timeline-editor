import { RawValue } from "@semio/data";
import { Track } from "../types";

// Test animation data in v2 format (millisecond stamps).
export const instances = {
  default: {
    id: "some",
    animationId: "thing",
    settings: { offset: 0, timescale: 1, active: true },
  },
  doublespeed: {
    id: "some",
    animationId: "thing",
    settings: { offset: 0, timescale: 2, active: true },
  },
  offset: {
    id: "some",
    animationId: "thing",
    settings: { offset: 500, timescale: 1, active: true },
  },
  offsetDoublespeed: {
    id: "some",
    animationId: "thing",
    settings: { offset: 500, timescale: 2, active: true },
  },
};

export const tracks: Record<string, Track<RawValue>> = {
  track1: {
    id: "track1",
    name: "Track 1",
    animatableId: "animatable1",
    points: [
      { id: "point1", stamp: 100, value: 10 },
      { id: "point2", stamp: 300, value: 15 },
      { id: "point3", stamp: 900, value: 20 },
    ],
  },
  track2: {
    id: "track2",
    name: "Track 2",
    animatableId: "animatable1",
    points: [
      { id: "point4", stamp: 100, value: 1.2 },
      { id: "point5", stamp: 900, value: 2.1 },
    ],
  },
};
