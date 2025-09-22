import { Source } from "./source";
import { TrackRender } from "./track-render";

/**
 * A container to store information specific to a given editor view
 * @prop id - A unique identifier for the view
 * @prop trackRender - The current setting for how to render content. This may get overridden by datatypes.
 * @prop activeAnimationInstance - The currently active animation instance for this view.
 * @prop sourcesByAnimationIndex - A record of sources for each animation, indexed by animation ID. Each entry contains a list of sources and an optional timeline of sources.
 */
export interface View {
  id: string;
  trackRender: TrackRender;
  activeAnimationInstance: string;
  sourcesByAnimationInstance: Record<string, Source[]>;
  sourceRowIds: string[];
}
