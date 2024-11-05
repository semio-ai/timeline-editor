/**
 * A collection of tracks that are grouped together for organizational purposes.
 * @param id - a unique identifier for the track group.
 * @param name - the name of the track group, defined by the user.
 * @param tracks - a collection of track ids that exist in this group.
 */
export interface TrackGroup {
  id: string;
  name: string;
  tracks: string[];
}
