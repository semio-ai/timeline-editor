import { AnimatableValue } from "@semio/utils";
import type { LayerBand } from "./layer-band";

/**
 * Base interface for all source types containing common identification properties.
 * Sources represent animation data organized hierarchically for rendering and controls.
 */
interface SourceBase {
  /** Animation id this source belongs to. */
  animationId: string;
  /** Namespace id for grouping related sources. */
  namespaceId: string;
  /** Instance id for the animation instance. */
  instanceId: string;
  /** Whether this source is read-only in the UI. */
  readonly?: boolean;
}

/**
 * Group of sources that can contain nested groups or tracks.
 */
export interface SourceGroup extends SourceBase {
  /** Unique source id for this group. */
  id: string;
  /** TrackGroup id referenced by this source. */
  groupId: string;
  /** Display name for the group. */
  name: string;
  /**
   * Composite type for the group, or "group" when structural only.
   * Composite types are used to group derived component tracks.
   */
  type: "vector3" | "vector2" | "euler" | "rgb" | "hsl" | "group";
  /** Whether the group is expanded in the UI. */
  expanded: boolean;
  /** Optional icon code for UI rendering. */
  iconCode?: string;
  /** Child sources contained in this group. */
  children: Source[];
  /**
   * Optional layout hint for row flattening.
   * - "nested": show child rows independently.
   * - "interleave": interleave children by stamp.
   * - "overlay": merge sibling tracks into a composite row.
   */
  layout?: "nested" | "interleave" | "overlay";
}

/**
 * Leaf source representing an individual animation track.
 */
export interface SourceTrack extends SourceBase {
  /** Unique source id for this track. */
  id: string;
  /** Track id this source points to. */
  trackId: string;
  /** Animatable id owning the track. */
  animatableId: string;
  /** Scalar value type stored by the track. */
  type: "string" | "number" | "boolean";
  /** Whether this track is hidden in the UI. */
  hidden: boolean;
  /** Whether this track is muted from playback. */
  muted: boolean;
  /** Optional icon code for UI rendering. */
  iconCode?: string;
  /**
   * Optional channel label (target/feedback/sim). Not yet used by row
   * flattening; intended to order or pair tracks for future layouts.
   */
  channel?: string;
}

/** Union type representing any source in the animation hierarchy. */
export type Source = SourceGroup | SourceTrack;

/**
 * Flattened source row used for rendering and controls.
 */
export interface SourceRow {
  /** Unique id for this row. */
  id: string;
  /** Whether the row is expanded (for group rows). */
  expanded?: boolean;
  /** Optional display name for the row. */
  name?: string;
  /** Row entries representing tracks or grouped components. */
  data: SourceRowData[];
}

/**
 * Row entry describing a single track or grouped component for rendering.
 */
export interface SourceRowData {
  /** Whether this entry is editable in the UI. */
  editable: boolean;
  /** Whether this entry is selectable in the UI. */
  selectable: boolean;
  /** Layer band used for z-ordering in the row. */
  layerBand: LayerBand;

  /** Animation id this entry belongs to. */
  animationId: string;
  /** Namespace id for this entry. */
  namespaceId: string;
  /** Instance id for this entry. */
  instanceId: string;
  /** Value type for this entry (or "group" for grouped rows). */
  type: AnimatableValue["type"] | "group";
  /** Whether this entry is muted from playback. */
  muted?: boolean;
  /** Track id for this entry. */
  trackId: string;
  /** Animatable id for this entry. */
  animatableId: string;
  /** Optional icon code for UI rendering. */
  iconCode?: string;
}
