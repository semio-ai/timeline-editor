import { TrackRender } from "./track-render";
import { VerticalAxis } from "./vertical-axis";

/** Per-view configuration for editor windows. */
export interface View {
  /** Unique view id. */
  id: string;
  /** Human-readable view label shown in UI controls. */
  name?: string;
  /** Preferred track render mode for this view. */
  trackRender: TrackRender;
  /** Vertical axis scaling mode for this view. */
  verticalAxis: VerticalAxis;
  /** View-specific hidden leaf source track ids. */
  hiddenSourceTrackIds?: string[];
  /** Transient track search/filter text for this view. */
  trackFilter?: string;
  /**
   * Vertical viewport for spline mode, in value-space units.
   * Determines the camera's vertical frustum. When undefined, the viewport
   * is auto-fit to the data bounds (with padding).
   */
  verticalViewport?: { top: number; bottom: number };
}
