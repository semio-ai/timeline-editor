import { MotionValue } from "motion/react";
import { useMotionCanvas } from "../components/canvas-sheet/shared/motion-canvas-context";

export function useInvariantScale(): MotionValue<number> {
  // Create a motion value that represents an invariant scale
  //
  const ctx = useMotionCanvas();
  if (!ctx) {
    throw new Error("useInvariantScale must be used within a MotionCanvasProvider");
  }
  return ctx.invariantScale;
}
