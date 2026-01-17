import { InstancedFrameInfo } from "./instanced-frame-info";
import { ViolationSet } from "./violation-set";
import type { VerticalAxisRange } from "./vertical-axis";
import type { RowRenderData, SelectionFrame, ValueBounds } from "./render-types";

export interface ComputedRowData {
  virtualFrames: InstancedFrameInfo[];
  verticalBounds: ValueBounds;
  violationSet: ViolationSet;
  verticalAxisByView?: Record<string, VerticalAxisRange>;
  selection?: SelectionFrame[];
  render?: RowRenderData;
}
