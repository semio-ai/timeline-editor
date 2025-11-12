import { InstancedFrameInfo } from "./instanced-frame-info";
import type { SegmentGeometry } from "./segment-geometry";

export interface InstancePair {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  buffer?: boolean;
  geometry?: SegmentGeometry;
}
