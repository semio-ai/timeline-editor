# @semio/animation Documentation

`@semio/animation` provides the shared timeline, selection, and gesture system used by Studio and Storybook demos.

This README is the source of truth for package architecture and current behavior. Keep short-lived implementation notes in PRs or issues.

## Package Anatomy

| Path | Purpose |
| --- | --- |
| `src/index.tsx` | Public package entry point and exports. |
| `src/store.ts` / `src/store-types.ts` | Zustand store wiring, canonical data model, and actions. |
| `src/actions/` | Immer reducers for animation, track, keypoint, selection, and drag mutations. |
| `src/functions/` | Pure helpers for derivation, curves, drag math, and transforms. |
| `src/subscriptions/` | Derived-state orchestration and store subscriptions. |
| `src/components/` | Timeline UI, controls, and canvas renderers. |
| `src/hooks/` | Store selectors, gesture hooks, and rendering hooks. |
| `src/types/` | Data + utility types used across the package. |
| `src/test-fixtures/` | Shared fixtures for tests and stories. |
| `src/tests/` | Vitest coverage for reducers and derived behavior. |

## Architecture Snapshot

- Canonical state is `AnimationData`; render-facing state is published through `derivedSnapshot` with a monotonic `version`.
- Drag workflows stage preview state in `dragState` and commit through dedicated drag actions.
- Selection is keyed by track/keypoint references and consumed by both controls and canvas renderers.
- Track values and velocities are keyed with `buildTrackKey(namespaceId, instanceId, trackId)` in derived outputs.
- Keep complex derivation in `src/functions`/`src/subscriptions`, not inline inside components.

## Rendering Notes

- `AnimationSheet` composes controls + canvas and is the primary consumer-facing editor surface.
- `canvas-sheet/` owns marker/segment/handle rendering and gesture-driven interactions.
- Storybook stories for this package live in `apps/docs/stories`.

## Playback speed controls

`PlaybackSettings` offers 0.1×, 0.5×, 1×, 1.5× and 2× playback, from
`PLAYBACK_SPEED_OPTIONS` (`src/components/playback-speed-options.ts`). Each option's
value is the string form of the store's multiplier, so the select matches it with
`speed.toString()`. Each speed shows its multiplier glyph, `playback-<rate>` from
`@semio/ui`'s default registry; the key keeps one decimal (`playback-1.0`) while the
value does not (`"1"`).

## The Vizij animation module's clip

`toModuleClip(animation, tracks)` (`src/functions/to-module-clip.ts`)
converts an animation into the `AnimationClip` the Vizij animation module's
`load_animation` takes, as the arora `Value` JSON a bridge `Call` carries. Its
docstring is the mapping; in short:

| Studio | Module clip |
| --- | --- |
| animation name, duration (`resolveAnimationDuration`) | `name`, `duration` in whole ms, rounded up |
| track id and name | track `id` and `name` |
| track's animatable (the first track on an animatable claims it) | `animatable_id` = the Studio animatable id; whatever loads the clip keys it onto a device |
| keypoint stamp (ms) | `stamp` = stamp / duration (`f32`) |
| number / boolean / string | `f64` / `bool` / `str` |
| numeric segment (easings, directives, explicit handles, clamps) | its Bézier from `resolveSegmentControlPoints`, normalized to the segment; cut at value extrema |
| string or boolean segment | no handles: the module holds the left value |
| instance offset and timescale, looping, bounce | not in the clip: player state (seek, speed, loop mode) |

`src/tests/module-clip/` holds the clip to Studio's curves: every fixture
animation and 120 generated ones are played by the module's `step` at 100 Hz
and sampled by its `bake`, and compared with the curve Studio's keypoints and
handles define, solved exactly (`studio-curve.ts`). Strings and booleans match
exactly; a number matches the curve at a time within 2 ppm of the duration, to
1e-6 of the track's magnitude, the module's `f32` precision. The module runs in
Node through `@vizij/runtime`, behind `ModuleClipHost` (`vizij-runtime-host.ts`).
`clipBaker` (`clip-baker.ts`), the baker the other tests draw curves with, reads a
clip back and samples it as the module does; the same tests hold it to the
exact curve.

## Curves from the module

The module is the only evaluator of a track's curve. A host gives the store a
`trackBaker` (Studio bakes on an emulated device's module); `trackCurve`
(`src/functions/track-curve.ts`) bakes a track alone over its animation's
duration, at 200 samples a second (fewer for an animation past 100 s), once per
track (copies with the same keypoints share a bake), and reads it back: a number
between two samples on the line between them, a string or a boolean held. From
that curve come:

- the values and velocities the derived snapshot writes for each track at the
  playhead (the velocity a finite difference of the curve);
- the violations, checked as each instance plays the curve in world time (its
  timescale scales the velocities) and reported in the track's local time;
- a value row's spline (`TrackRender.Spline` / `Preview`), the drag preview
  baking the dragged points;
- the value a new keypoint takes on a curve.

Without a baker no track has a curve: values and violations are empty, and a
value row draws its segments' Bézier parameters instead. The key and transition
views draw each segment's easing from its handles: the authored shape, not a
value over time.

## Testing Notes

- Prefer action-level and function-level coverage for gesture-heavy behavior.
- Reuse `src/test-fixtures` so tests and Storybook scenarios stay aligned.
- For UI flows that are hard to test in Vitest browser mode (three.js / react-three/fiber), validate behavior through store action tests and document manual QA in PR notes.

## Editor MVP Checklist

Current status snapshot:

- [X] Correct interpolation methods (cubic-bezier + transition settings)
- [ ] Full handle support
  - [X] Handles on Bezier curves
  - [ ] Hotkey to reset handles to flat
  - [X] Key addition in mid-transitions (use a tangent calculation)
- [ ] Selection
  - [X] Single selection
  - [X] Multi selection (Shift + Click, CTRL + Click)
  - [ ] Box selection (Click + Drag) (?)
- [ ] Move selected keyframes (Click + Drag)
  - [X] Click + Drag
  - [ ] Mode switching with T or G keys (plus X/Y)
- [ ] Cut/Copy/Paste keyframes (CTRL + X, CTRL + C, CTRL + V)
- [ ] Locking specific tracks/splines
- [ ] Show/Hide of individual tracks (specific visual depending on TrackRender mode)
- [ ] Scaling when multiple keyframes are selected (with S keybinding)

## Icons

`animationIconRegistry` (`src/icons/registry.ts`) is the second of three registry
layers. It inherits every `@semio/ui` key and adds only what the editor owns:
editor actions (`edit`, `menu`, `settings`, `delete`, `cut`, `paste`), playback
(`playback-*`), data types (`data-*`), units (`unit-*`), timeline views (`view-*`)
and easing (`transition-*`). Studio adds its own keys on top without redefining
these, so a standalone consumer of this package renders the same editor artwork as
Studio with no provider of its own. Shared roles such as `add`, `copy` and
`remove` come from `@semio/ui`. How keys resolve and how a consumer overrides one is
in `packages/ui/docs/icon-registry.md`.

Conventions the registry encodes:

- Actions and states are separate keys: `mute`, `hide` and `unlock` are verbs;
  `state-muted`, `state-hidden` and `state-locked` describe the current value, and
  each can be restyled without the other.
- Start and end bound glyphs carry their own orientation: `playback-seek-start-bounds`
  and `move-player-start-bounds` are the end-bound artwork turned half a turn, composed
  with any transform or `mirrored` the caller passes, so call sites do not flip them.
- Deprecated keys stay registered with the key to use instead: `speed-slow`,
  `speed-normal`, `speed-fast` and `speed-fastest` resolve to `playback-0.5`,
  `playback-1.0`, `playback-1.5` and `playback-2.0`.

The registry uses `@solar-icons/react-perf` components directly, which is why that
package is a dependency here. Solar artwork is by 480 Design under CC BY 4.0; this
package's `NOTICE` carries the attributions and the list of vendored glyphs it
renders through `@semio/ui`.
