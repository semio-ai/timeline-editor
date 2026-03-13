/**
 * Hierarchical group node used to organize tracks in the editor.
 * Children can be track ids or nested group definitions.
 */
export interface TrackGroup {
  /** Unique group id. */
  id: string;
  /** Human-readable group name. */
  name: string;
  /** Nested children (track ids or nested group nodes). */
  children: (string | TrackGroup)[];
}
