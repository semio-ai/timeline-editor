import { RawValue } from "@semio/utils";
import { Track } from "../types";

// Define the animation data structure
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
    settings: { offset: 0.5, timescale: 1, active: true },
  },
  offsetDoublespeed: {
    id: "some",
    animationId: "thing",
    settings: { offset: 0.5, timescale: 2, active: true },
  },
};

export const tracks: Record<string, Track<RawValue>> = {
  track1: {
    id: "track1",
    name: "Track 1",
    animatableId: "animatable1",
    points: [
      { id: "point1", stamp: 0.1, value: 10 },
      { id: "point2", stamp: 0.3, value: 15 },
      { id: "point3", stamp: 0.9, value: 20 },
    ],
  },
  track2: {
    id: "track2",
    name: "Track 2",
    animatableId: "animatable1",
    points: [
      { id: "point4", stamp: 0.1, value: 1.2 },
      { id: "point5", stamp: 0.9, value: 2.1 },
    ],
  },
};
