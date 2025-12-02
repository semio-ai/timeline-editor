/**
 * Proposed DragState typings that align with the explicit diff schema (DiffOp).
 * This is a drop-in replacement draft; not wired into runtime.
 */
import type { RawValue, RawVector2 } from "@semio/utils";
import type {
  DragAxis,
  DragStampTransform,
  DragMarkerHandleOffsets,
  ValueScale,
} from "./drag-state";
import type { DiffOp } from "./diff";

export interface ProposedDragAnchor {
  keypointId: string;
  trackId: string;
  rowId: string;
  markerId: string;
  attributePath?: string[];
  valueScale?: ValueScale;
  neighborKeypointId?: string;
}

export interface ProposedHandleAnchor {
  side: "in" | "out";
  trackId: string;
  keypointId: string;
  neighborKeypointId?: string;
  startStamp: number;
  endStamp: number;
  startValue: number;
  endValue: number;
  controlPoint: { x: number; y: number };
  attributePath?: string[];
  valueScale?: ValueScale;
}

export interface ProposedDragState {
  axis: DragAxis;
  instanceId: string;
  instanceTransform: DragStampTransform;
  anchor: ProposedDragAnchor;
  pointerOrigin: { x: number; y: number };
  stampOrigin?: number;
  anchorValueOrigin?: number | RawValue;
  modifiers: { alt: boolean; shift: boolean; meta: boolean };
  activeHandleId?: string;
  handleAnchor?: ProposedHandleAnchor;
  handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2 }>;
  markerHandleOffsets?: DragMarkerHandleOffsets;
  stampDelta?: { raw?: number; snapped?: number };
  normalizedValueDelta?: number;
  trackSnapshots?: Record<
    string,
    {
      points: {
        id: string;
        stamp: number;
        value: RawValue;
        transitions?: any;
      }[];
    }
  >;
  /**
   * Unified diff ops for this drag. Preview and commit should consume the same set.
   */
  pendingDiffs?: DiffOp[];
}
