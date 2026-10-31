---
"@semio/timeline-editor": minor
---

A dragged track's preview in the derived snapshot carries the track itself (`DerivedTrackSnapshot.preview.track`): the stored track as the commit of the drag in progress will write it. A host that plays tracks plays this one while the drag lasts, so what it plays follows the drag and does not change at the commit.

The snapshot's preview of a track (its curve, its violations and the track) is now the projection of the first row that holds the stored track, the row whose diffs the commit replays, for every instance that plays the track. A track other than the drag's anchor can project differently in rows of different value ranges, and its preview then matches the value the commit writes. Each row still draws its own projection.
