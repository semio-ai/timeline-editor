import { InstancePair } from "./instance-pair";
import { InstancedFrameInfo } from "./instanced-frame-info";
import { ViolationSet } from "./violation-set";

export interface ComputedRowData {
  virtualFrames: InstancedFrameInfo[];
  interpolations: InstancePair[];
  verticalBounds: { min: number; max: number };
  violationSet: ViolationSet;
}
