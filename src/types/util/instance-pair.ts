import { InstancedFrameInfo } from "./instanced-frame-info";

export interface InstancePair {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  buffer?: boolean;
}
