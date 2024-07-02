/*
@type TrackGroup
@description A track group is a collection of tracks that are grouped together for organizational purposes.
@prop id: string - a unique identifier for the track group.
@prop name: string - the name of the track group, defined by the user.
@prop tracks: string[] - a collection of track ids that exist in this group.
*/
export interface TrackGroup {
  id: string;
  name: string;
  tracks: string[];
}
