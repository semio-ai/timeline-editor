import { TrackRender } from "./track-render";
import { VerticalAxis } from "./vertical-axis";

/** Per-view configuration for editor windows. */
export interface View {
  /** Unique view id. */
  id: string;
  /** Preferred track render mode for this view. */
  trackRender: TrackRender;
  /** Vertical axis scaling mode for this view. */
  verticalAxis: VerticalAxis;
}
