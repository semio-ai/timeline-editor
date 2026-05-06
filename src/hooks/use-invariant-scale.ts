import { MotionValue } from "motion/react";
import { useMotionCanvas } from "../components/canvas-sheet/shared/motion-canvas-context";

export function useInvariantScaleX(): MotionValue<number> {
  const ctx = useMotionCanvas();
  if (!ctx) {
    throw new Error("useInvariantScaleX must be used within a MotionCanvasProvider");
  }
  return ctx.invariantScaleX;
}

export function useInvariantScaleY(): MotionValue<number> {
  const ctx = useMotionCanvas();
  if (!ctx) {
    throw new Error("useInvariantScaleY must be used within a MotionCanvasProvider");
  }
  return ctx.invariantScaleY;
}

/** @deprecated Use useInvariantScaleX instead */
export const useInvariantScale = useInvariantScaleX;
