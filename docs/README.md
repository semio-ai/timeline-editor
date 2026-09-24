# @semio/animation Documentation

`@semio/animation` provides the shared timeline, selection, and gesture system used by Studio and Storybook demos.

This README is the source of truth for package architecture and current behavior. Keep short-lived implementation notes in PRs or issues.

## Package Anatomy

| Path | Purpose |
| --- | --- |
| `src/index.tsx` | Public package entry point and exports. |
| `src/store.ts` / `src/store-types.ts` | Zustand store wiring, canonical data model, and actions. |
| `src/actions/` | Immer reducers for animation, track, keypoint, selection, and drag mutations. |
| `src/functions/` | Pure helpers for derivation, interpolation, drag math, and transforms. |
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

`PlaybackSettings` offers 0.1×, 0.5×, 1.0×, 1.5×, and 2.0× playback.
Its numeric speed glyphs use the `playback-<rate>` keys in `@semio/ui`'s default
registry; integer rates keep a decimal in the icon key (`playback-1.0`,
`playback-2.0`) while the selector passes numeric values to the player store.

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

### Data and curve glyphs

The animation registry uses Solar Hashtag for absent data and Text for text data.
Vector data glyphs pair half-opacity axes with opaque points. Curve glyphs retain
their existing geometry and use Solar-equivalent line weights; handle indicators
retain their independent state styling.

Grouped data uses the shared `IconFolderClosed` artwork through `data-group`.

Numeric and unspecified data labels share Solar Hashtag; binary data uses the
supplied data-binary.svg artwork, and text keeps its
explicit Text glyph. Percentage units use the bare percent mark.

Euler data uses the supplied rotate-3d artwork. Playback skip actions use Solar Bold SkipPrevious/SkipNext.

Animation inherits UI glyphs and owns its additional editor/transport/data keys.
Edit, menu, and settings use the approved Solar designs without Studio overrides.

### Semantic icon roles

Timeline views use `view-keys`, `view-transitions`, `view-preview`, `view-spline`,
and `view-data`; easing uses `transition-*`. Handle pairing keeps `vertex-*`,
and animation data keys keep `key`. Action marks (`mute`, `hide`, `unlock`)
are distinct from state marks (`state-muted`, `state-hidden`, `state-locked`).
Start/end bound icons own their orientation, so callers do not mirror them.
Time-format controls display the supplied `time-display-*` artwork without
expanding their supported format lists. Shared add/copy/remove roles come from UI.
