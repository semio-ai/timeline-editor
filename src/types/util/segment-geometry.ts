import type { RawVector2 } from "@semio/utils";
import type { TransitionParams } from "../../functions/compute-transition-params";
import type { StandardTransitionType } from "../data/keypoint";
import type { TrackRender } from "./track-render";

export interface WorldCP {
  x: number;
  y: number;
}

export enum TransitionHandleKind {
  Explicit = "explicit",
  Easing = "easing",
}

export interface ResolvedHandle {
  world: WorldCP;
  kind: TransitionHandleKind;
}

export interface EndpointTransitions {
  startOut?: RawVector2 | StandardTransitionType;
  endIn?: RawVector2 | StandardTransitionType;
}

export interface ClampFlags {
  cp1Clamped?: boolean;
  cp2Clamped?: boolean;
  knotPrevented?: boolean;
}

export type SegmentRenderParams = Partial<Record<TrackRender, TransitionParams>>;

export interface SegmentGeometryState {
  transitions?: EndpointTransitions;
  controlPoints?: {
    cp1?: WorldCP;
    cp2?: WorldCP;
  };
  handles?: {
    startOut?: ResolvedHandle;
    endIn?: ResolvedHandle;
  };
  renderParams?: SegmentRenderParams;
}

export interface SegmentGeometry {
  raw: SegmentGeometryState;
  effective: SegmentGeometryState;
  flags?: ClampFlags;
}
