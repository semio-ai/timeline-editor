---
"@semio/timeline-editor": minor
---

The store builds the derived snapshot once per write, rather than once for each nested write its own subscriptions make. A caller sees the new snapshot as soon as its action returns. So does a listener subscribed after the store's own, on the first notification that shows it the new inputs.

Violations come from a `FeedbackProvider`, which the host can set as `feedbackProvider` in the store. Without one, the store runs the editor's own limit and velocity checks and caches the results per track, so a write to one track rescans only that track. A dragged track's preview violations are computed once per build, and every row shares them.

A violation's `id` is derived from its track instance, type and start, so a violation that is computed again keeps its id. Source rows and row ids keep their identity across a write that leaves them unchanged.
