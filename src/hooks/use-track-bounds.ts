import { createContext, useContext } from "react";
import { type RectReadOnly } from "react-use-measure";
import { ScaleLinear, defaultScaleLinear } from "../scale-linear";

export const TrackBoundsContext = createContext<{
  bounds: RectReadOnly;
  scale: ScaleLinear;
  zoom: ScaleLinear;
  zoomReference?: ScaleLinear;
  frameCount: number;
}>({
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
  scale: defaultScaleLinear,
  zoom: defaultScaleLinear,
  frameCount: 1,
});

export const useTrackBounds = () => {
  return useContext(TrackBoundsContext);
};
