import type { RawVector2 } from "@semio/utils";
import type { TransitionParams } from "../../functions/compute-transition-params";
import type { StandardTransitionType } from "../data/keypoint";
import type { TrackRender } from "./track-render";

/** World-space control point. */
export interface WorldCP {
  /** Stamp position (normalized). */
  x: number;
  /** Value position. */
  y: number;
}

/** Whether a handle is explicit or derived from an easing enum. */
export enum TransitionHandleKind {
  Explicit = "explicit",
  Easing = "easing",
}

/** Resolved handle in world space with origin type. */
export interface ResolvedHandle {
  /** World-space handle position. */
  world: WorldCP;
  /** Whether the handle is explicit or easing-derived. */
  kind: TransitionHandleKind;
}

/** Start/end transitions for a segment. */
export interface EndpointTransitions {
  /** Outgoing transition from the start keypoint. */
  startOut?: RawVector2 | StandardTransitionType;
  /** Incoming transition to the end keypoint. */
  endIn?: RawVector2 | StandardTransitionType;
}

/** Flags indicating clamp/knot behavior for a segment. */
export interface ClampFlags {
  /** Whether the first control point was clamped. */
  cp1Clamped?: boolean;
  /** Whether the second control point was clamped. */
  cp2Clamped?: boolean;
  /** Whether knot constraints prevented a control point. */
  knotPrevented?: boolean;
}

/** Optional render parameters per TrackRender mode. */
export type SegmentRenderParams = Partial<Record<TrackRender, TransitionParams>>;

/** Geometry state for a segment (raw or effective). */
export interface SegmentGeometryState {
  /** Endpoint transition inputs. */
  transitions?: EndpointTransitions;
  /** Raw control points for the segment. */
  controlPoints?: {
    cp1?: WorldCP;
    cp2?: WorldCP;
  };
  /** Resolved handles for rendering. */
  handles?: {
    startOut?: ResolvedHandle;
    endIn?: ResolvedHandle;
  };
  /** Render-mode-specific parameters. */
  renderParams?: SegmentRenderParams;
}

/** Segment geometry with raw and effective (post-clamp) views. */
export interface SegmentGeometry {
  /** Raw geometry derived from keypoints/transitions. */
  raw: SegmentGeometryState;
  /** Effective geometry after clamping/adjustment. */
  effective: SegmentGeometryState;
  /** Flags describing applied adjustments. */
  flags?: ClampFlags;
}
