import { InstancedFrameInfo } from "./instanced-frame-info";
import { ViolationSet } from "./violation-set";
import type { VerticalAxisRange } from "./vertical-axis";
import type { RowRenderData, SelectionFrame, ValueBounds } from "./render-types";

/** The instance time a row's stamps are in, as the row was built. */
export interface RowTime {
  namespaceId: string;
  instanceId: string;
  /** The instance's speed, as conversions use it (never zero). */
  timescale: number;
  offset: number;
}

/** Derived data for a single source row used by renderers and controls. */
export interface ComputedRowData {
  /**
   * The time this row's stamps are in: its one instance's local time, as that
   * instance was timed when the row was built; absent when they are in world
   * time (a row of several instances, whose keys each sit at their own
   * instance's world time). Readers convert with this rather than with the
   * row's instance as it is now, which can differ from the one the stamps
   * were built with.
   */
  time?: RowTime;
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
