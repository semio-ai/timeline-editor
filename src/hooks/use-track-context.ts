import { createContext, useContext, MutableRefObject, createRef } from "react";
import { type RectReadOnly } from "react-use-measure";
import type { AnimatableValue } from "@semio/utils";
import { ScaleLinear, defaultScaleLinear } from "../scale-linear";
import { type AnimationInstanceSettings, TrackRender } from "../types";

/**
 * The context data for a track.
 * @param animationId - The id of the animation.
 * @param namespaceId - The id of the namespace.
 * @param instanceInfo - The instance info ({@link AnimationInstanceSettings}).
 * @param animationDuration - The duration of the animation.
 * @param bounds - The bounds of the track.
 * @param xScale - The x-scale of the track ({@link ScaleLinear}).
 * @param yScale - The y-scale of the track ({@link ScaleLinear}).
 * @param frameCount - The number of frames in the animation.
 * @param color - The color of the track
 */
export interface TrackContextData {
  animationId: string;
  instanceSettings: AnimationInstanceSettings;
  animationDuration: number;
  trackIds: string[];
  bounds: RectReadOnly;
  xScale: ScaleLinear;
  yScale: ScaleLinear;
  zoomScale: MutableRefObject<ScaleLinear>;
  frameCount: number;
  color: string;
  trackRender: TrackRender;
  trackType: AnimatableValue["type"] | "multiple";
}

export const TrackContext = createContext<TrackContextData>({
  animationId: "",
  instanceSettings: {
    active: true,
    offset: 0,
    timescale: 1,
  },
  animationDuration: 1000,
  trackIds: [],
  bounds: {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    right: 0,
    bottom: 0,
    x: 0,
    y: 0,
  },
  xScale: defaultScaleLinear,
  yScale: defaultScaleLinear,
  zoomScale: createRef<ScaleLinear>() as MutableRefObject<ScaleLinear>,
  frameCount: 1,
  color: "#737373",
  trackRender: TrackRender.Key,
  trackType: "number",
});

export const useTrackContext = () => {
  return useContext(TrackContext);
};
