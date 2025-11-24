import type { RawValue, RawVector2 } from "@semio/utils";
import type { Keypoint } from "../data/keypoint";
import type { Track } from "../data/track";
import type { WorldCP } from "./segment-geometry";

export type DragAxis = "horizontal" | "vertical" | "both";

export interface DragStampTransform {
  offset: number;
  timescale: number;
}

export interface ValueScale {
  domain: [number, number];
  clamp: boolean;
  precision?: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

export interface DragAnchorRef {
  keypointId: string;
  trackId: string;
  rowId: string;
  markerId: string;
  kind?: "marker" | "handle-in" | "handle-out";
  neighborKeypointId?: string;
  attributePath?: string[];
  valueScale?: ValueScale;
}

export interface DragState {
  axis: DragAxis;
  instanceId: string;
  instanceTransform: DragStampTransform;
  anchor: DragAnchorRef;
  pointerOrigin: PointerPosition;
  stampOrigin?: number;
  stampDelta?: {
    raw: number;
    snapped?: number;
  };
  anchorValueOrigin?: number;
  normalizedValueDelta?: number;
  modifiers: {
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
  markerHandleOffsets?: Record<string, DragMarkerHandleOffsets>;
  trackSnapshots?: Record<string, TrackSnapshot>;
  activeHandleId?: string;
  handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2 }>;
  handleAnchor?: {
    side: "in" | "out";
    trackId: string;
    keypointId: string;
    neighborKeypointId: string;
    startStamp: number;
    endStamp: number;
    startValue: number;
    endValue: number;
    controlPoint: WorldCP;
    attributePath?: string[];
    valueScale?: ValueScale;
  };
}

export interface DragStartInput {
  origin: PointerPosition;
  axis: DragAxis;
  markerId: string;
  rowId: string;
  /**
   * Optional view-specific value scale to use for vertical drags.
   * When provided, this takes precedence over row-derived vertical bounds.
   */
  valueScale?: ValueScale;
}

export interface DragUpdateInput {
  pointer: PointerPosition;
  normalizedStamp?: {
    current: number;
    snapped?: number;
  };
  normalizedValueDelta?: number;
  modifiers: DragState["modifiers"];
}

export interface HandleDragStartInput {
  origin: PointerPosition;
  side: "in" | "out";
  rowId: string;
  trackId: string;
  keypointId: string;
  neighborKeypointId: string;
  attributePath?: string[];
  valueScale?: ValueScale;
  controlPoint: WorldCP;
  startStamp: number;
  endStamp: number;
  startValue: number;
  endValue: number;
}

export interface HandleDragUpdateInput {
  pointer: PointerPosition;
  normalizedValueDelta?: number;
  modifiers: DragState["modifiers"];
}

export interface KeypointCommitDelta {
  id: string;
  trackId: string;
  stamp?: number;
  value?: {
    path?: string[];
    next: (current: RawValue) => RawValue;
  };
}

export interface TrackSnapshot {
  trackId: string;
  points: Keypoint<RawValue>[];
}

export interface TrackDiffChanges {
  stamp?: number;
  value?: RawValue;
  transitions?: Track<RawValue>["points"][number]["transitions"];
}

export type TrackDiff =
  | {
      type: "updateKeypoint";
      trackId: string;
      keypointId: string;
      changes: TrackDiffChanges;
    }
  | {
      type: "reorderKeypoints";
      trackId: string;
      order: string[];
    };

export interface DragMarkerHandleOffsets {
  out?: DragHandleOffset;
  in?: DragHandleOffset;
}

export interface DragHandleOffset {
  delta: Pick<WorldCP, "x" | "y">;
  neighborKeypointId: string;
  fallback?: RawVector2;
}
