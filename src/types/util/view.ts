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
}
