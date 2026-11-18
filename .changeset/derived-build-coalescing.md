---
"@semio/timeline-editor": minor
---

The store builds the derived snapshot once per write, rather than once for each nested write its own subscriptions make. A caller sees the new snapshot as soon as its action returns. So does a listener subscribed after the store's own, on the first notification that shows it the new inputs.

Violations come from a `FeedbackProvider`, which the host can set as `feedbackProvider` in the store. Without one, the store runs the editor's own limit and velocity checks and caches the results per track, so a write to one track rescans only that track. A dragged track's preview violations are computed once per build, and every row shares them.

A violation's `id` is derived from its track instance, type and start, so a violation that is computed again keeps its id. Source rows and row ids keep their identity across a write that leaves them unchanged.

A derived row whose inputs did not change is handed on from the previous snapshot as the same object, with its render samples. A key edit recomputes only the rows that draw the edited track, and a viewport change recomputes none. `rowRenderSamples(snapshot, rowId)` gives the samples one row's segments point to; the data renderer selects these instead of the whole sample cache, so a row the build kept does not redraw.

The published `derivedSnapshot` is frozen at its top level, which stops each action's Immer recipe from walking the whole snapshot. A snapshot is replaced, never edited: its inner objects are not frozen, but must not be changed in place. Host-supplied objects the snapshot reads, such as the evaluator and the animatables, are compared by identity, so a host changes one by replacing it.
