import { AnimatableValue } from "@semio/utils";

/**
 * Base interface for all source types containing common identification properties.
 * Sources represent animation data organized hierarchically in the animation system.
 *
 * @property {string} animationId - Unique identifier of the animation this source belongs to
 * @property {string} namespaceId - Namespace identifier for organizing related animation sources
 */
interface SourceBase {
  animationId: string;
  namespaceId: string;
  instanceId: string;
  readonly?: boolean;
}

/**
 * Represents a group of animation sources that can contain other groups or tracks.
 * Groups provide hierarchical organization for animation data and can be expanded/collapsed in the UI.
 *
 * @property {string} animationId - Unique identifier of the animation this source belongs to
 * @property {string} animationId - Unique identifier of the animation this source belongs to
 * @property {string} namespaceId - Namespace identifier for organizing related animation sources
 * @property {string} groupId - Unique identifier for this specific group
 * @property {string} name - Display name for the group
 * @property {"group"} type - Discriminator indicating this is a group source
 * @property {boolean} expanded - Whether the group is expanded in the UI to show its children
 * @property {Source[]} children - Child sources contained within this group (can be nested groups or tracks)
 */
export interface SourceGroup extends SourceBase {
  id: string;
  groupId: string;
  name: string;
  type: "vector3" | "vector2" | "euler" | "rgb" | "hsl" | "group";
  expanded: boolean;
  iconCode?: string;
  children: Source[];
}

/**
 * Represents an individual animation track containing keyframe data.
 * Tracks are the leaf nodes in the source hierarchy that hold actual animation values.
 *
 * @property {string} id - Unique identifier for this source (combination of namespace, instance, and track IDs)
 * @property {string} animationId - Unique identifier of the animation this source belongs to
 * @property {string} namespaceId - Namespace identifier for organizing related animation sources
 * @property {string} trackId - Unique identifier for this specific track
 * @property {AnimatableValue["type"]} type - The data type of values stored in this track (e.g., number, vector3, color)
 * @property {boolean} hidden - Whether this track is hidden from view in the UI
 * @property {boolean} muted - Whether this track is muted (excluded from playback)
 * @property {string} [attribute] - Optional attribute specifier for tracks that represent components of composite values (e.g., "x", "y", "z" for vector components). Will be replaced by composable primitive values in future versions
 */
export interface SourceTrack extends SourceBase {
  id: string;
  trackId: string;
  animatableId: string;
  type: "string" | "number" | "boolean";
  hidden: boolean;
  muted: boolean;
  iconCode?: string;
  attribute?: string;
}

/**
 * Union type representing any source in the animation hierarchy.
 * Use the `type` discriminator to determine whether a source is a group or track.
 */
export type Source = SourceGroup | SourceTrack;

/**
 * Flattened representation of source information for rendering purposes.
 * Each row represents a renderable line in the animation timeline UI,
 * potentially aggregating multiple tracks that should be displayed together.
 *
 * @property {string} id - Unique identifier for this source row.
 * @property {SourceRowData[]} data - Array of data entries for this row, each representing a track or component to render
 */
export interface SourceRow {
  id: string;
  expanded?: boolean;
  data: SourceRowData[];
}

export interface SourceRowData {
  // Foreground (whether the row is in the foreground or not)
  foreground: boolean;
  // Editable (whether the row is editable or not)
  editable: boolean;
  // Selectable (whether the row is selectable or not)
  selectable: boolean;

  // Source information
  animationId: string;
  namespaceId: string;
  instanceId: string;
  type: AnimatableValue["type"] | "group";
  trackId: string;
  animatableId: string;
  iconCode?: string;
  attribute?: string;
}
