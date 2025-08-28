import { createContext, useContext } from "react";
import { MotionValue } from "motion";

export interface MotionCanvasState {
  size: {
    width: MotionValue<number>;
    height: MotionValue<number>;
  };
  invariantScale: MotionValue<number>;
}

export const MotionCanvasContext = createContext<MotionCanvasState | null>(null);

export function useMotionCanvas() {
  const context = useContext(MotionCanvasContext);
  if (!context) {
    throw new Error("useMotionCanvas must be used within a MotionCanvasProvider");
  }
  return context;
}
