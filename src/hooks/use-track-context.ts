import { createContext, useContext } from "react";
import { type RectReadOnly } from "react-use-measure";
import { ScaleLinear, defaultScaleLinear } from "../scale-linear";

export const TrackContext = createContext<{
  bounds: RectReadOnly;
  scale: ScaleLinear;
  frameCount: number;
  color: string;
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
  frameCount: 1,
  color: "#737373",
});

export const useTrackContext = () => {
  return useContext(TrackContext);
};
