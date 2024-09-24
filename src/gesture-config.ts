import { UserGestureConfig } from "@use-gesture/react";

export const DRAG_X_CONFIG: UserGestureConfig = {
  drag: {
    axis: "x",
    filterTaps: true,
    pointer: {
      capture: false,
    },
  },
};
