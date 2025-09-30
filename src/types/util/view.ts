import { TrackRender } from "./track-render";

/**
 * A container to store information specific to a given editor view
 * @prop id - A unique identifier for the view
 * @prop trackRender - The current setting for how to render content. This may get overridden by datatypes.
 */
export interface View {
  id: string;
  trackRender: TrackRender;
}
