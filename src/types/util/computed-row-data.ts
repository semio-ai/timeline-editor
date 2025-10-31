import { InstancePair } from "./instance-pair";
import { InstancedFrameInfo } from "./instanced-frame-info";
import { ViolationSet } from "./violation-set";
import type { VerticalAxisRange } from "./vertical-axis";

export interface ComputedRowData {
  virtualFrames: InstancedFrameInfo[];
  interpolations: InstancePair[];
  verticalBounds: { min: number; max: number };
  violationSet: ViolationSet;
  verticalAxisByView?: Record<string, VerticalAxisRange>;
}
