import { InstancedFrameInfo } from "./instanced-frame-info";
import { ViolationSet } from "./violation-set";
import type { VerticalAxisRange } from "./vertical-axis";
import type { RowRenderData, SelectionFrame, ValueBounds } from "./render-types";

/** Derived data for a single source row used by renderers and controls. */
export interface ComputedRowData {
  /** Instanced frames for this row (used by markers/segments). */
  virtualFrames: InstancedFrameInfo[];
  /** Value bounds for this row in literal data space. */
  verticalBounds: ValueBounds;
  /** Violations aggregated for this row. */
  violationSet: ViolationSet;
  /** Optional per-view vertical axis overrides. */
  verticalAxisByView?: Record<string, VerticalAxisRange>;
  /** Selection frames for marker-level selection UI. */
  selection?: SelectionFrame[];
  /** Render-ready row data (markers, segments, handles). */
  render?: RowRenderData;
}
