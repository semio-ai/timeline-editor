---
"@semio/timeline-editor": minor
---

A row that spans several animation instances (the global row, a namespace's row) places each instance's keys at that instance's own world time, applying its timescale and offset. It used to draw every key at its local time as if that were world time, so an instance that does not play at speed 1 from 0 ms showed its keys in the wrong place there, and dragging, box selection, the key strip and next/previous key read them there too.

Each derived row records the time its stamps are in as `ComputedRowData.time`: its one instance's timing as the row was built, or absent for a row of several instances, whose stamps are in world time. Readers convert with it (`worldStampOf`, `rowStampOf`), and `adjacentKeyTime` finds a row's next or previous key from a world time. Box selection now finds a scaled instance's keys in its own rows, and a view's track filter no longer hides keys that share a column with a hidden track.
