# @semio/animation Documentation

`@semio/animation` provides the shared timeline, selection, and gesture system used by Studio and Storybook demos.

This README is the source of truth for package architecture and current behavior. Keep short-lived implementation notes in PRs or issues.

## Package Anatomy

| Path                                  | Purpose                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `src/index.tsx`                       | Public package entry point and exports.                                       |
| `src/store.ts` / `src/store-types.ts` | Zustand store wiring, canonical data model, and actions.                      |
| `src/actions/`                        | Immer reducers for animation, track, keypoint, selection, and drag mutations. |
| `src/functions/`                      | Pure helpers for derivation, curves, drag math, and transforms.               |
| `src/subscriptions/`                  | Derived-state orchestration and store subscriptions.                          |
| `src/components/`                     | Timeline UI, controls, and canvas renderers.                                  |
| `src/hooks/`                          | Store selectors, gesture hooks, and rendering hooks.                          |
| `src/types/`                          | Data + utility types used across the package.                                 |
| `src/test-fixtures/`                  | Shared fixtures for tests and stories.                                        |
| `src/tests/`                          | Vitest coverage for reducers and derived behavior.                            |

## Architecture Snapshot

- Canonical state is `AnimationData`; render-facing state is published through `derivedSnapshot` with a monotonic `version`.
- Drag workflows stage preview state in `dragState` and commit through dedicated drag actions.
- Selection is keyed by track/keypoint references and consumed by both controls and canvas renderers.
- Track values and velocities are keyed with `buildTrackKey(namespaceId, instanceId, trackId)` in derived outputs.
- Keep complex derivation in `src/functions`/`src/subscriptions`, not inline inside components.

## Rendering Notes

- `AnimationSheet` composes controls + canvas and is the primary consumer-facing editor surface.
- `canvas-sheet/` owns marker/segment/handle rendering and gesture-driven interactions.
- All three canvases subscribe to `useCanvasFrameloop()` from `@semio/utils` outside their R3F roots. The default is `always`; a host choosing `demand` owns scheduling global invalidations for continuous behavior. See the [shared API](../../utils/README.md#canvas-render-loop).
- Storybook stories for this package live in `apps/docs/stories`.

## Playback speed controls

`PlaybackSettings` offers 0.1×, 0.5×, 1×, 1.5× and 2× playback, from
`PLAYBACK_SPEED_OPTIONS` (`src/components/playback-speed-options.ts`). Each option's
value is the string form of the store's multiplier, so the select matches it with
`speed.toString()`. Each speed shows its multiplier glyph, `playback-<rate>` from
`@semio/ui`'s default registry; the key keeps one decimal (`playback-1.0`) while the
value does not (`"1"`).

## Clip document and persistence

Studio reads formats 1, 2 and 3 and writes format 2 through
`writeAnimationForStorage`. `readStoredAnimation` validates required fields and
units before conversion; format 3 requires safe-integer `timeNs` and `dtNs`, finite
`dv`, and scalar values of one kind per track. Formats 1 and 2 require a defined
value (composites remain valid) and finite x/y handles or named transitions, with
legacy optional transition metadata preserved. A v3 `stamp` or x/y handle and a
v1/v2 `timeNs` or nanosecond handle are refused. Duplicate track ids are refused
in every format, and a track's optional `inputKey` must be a string in every
format. Unknown versions are refused before tracks are read.
The `@semio/animation/format` entry point exposes the codec without loading the UI.

`StoredAnimation` is the embedded millisecond model; `PersistedAnimation` describes
format 3 with optional `defaultViewportExtentNs` and no stored length.
`writeStoredAnimation` writes format 3, rounding stamps and handle time deltas to
nanoseconds, throwing for unsafe integer conversions or invalid content rather
than emitting unreadable documents or omitting handles. Switching the save boundary
to it is a one-line change once clients that read format 3 are in production.
Composite tracks with known schemas are
flattened by `migrateAnimationData`; unresolved composites save in format 2.
Both asset save hooks use the save boundary through `toAssetUploadBytes` in core.
`clipDocument` prepares a playable clip whose `lengthNs` follows
`resolveAnimationDuration`: content end, viewport hint or one second, whichever
is latest. Device conversion resolves the whole animation before filtering tracks.
Engine clip encoding and track evaluation preserve fractional handle nanoseconds
for exact v2 curves. Track evaluation and effective-motion export need no engine
clip length.

## A track on an input beyond the model

A track animates an animatable of the entity's model, `animatableId`, or an
input the entity's runtime declares beyond the model, which `inputKey` names by
its key (`fan.target_value`, `speaker/gain`). Such a track's `animatableId` is
`runtimeInputId(inputKey)` (`@semio/data`), the id under which the host keeps
the input's record among the animatables, so its rows, curves and controls are
an animatable's; `createTrack` sets `inputKey` for a track created on such an
id. It plays on an entity whose runtime declares the key, and nowhere else.

It is stored as every track is, in the animation's content (`StoredAnimation`,
the JSON an animation asset saves), with `inputKey` one more optional field;
the rest of the shape is unchanged, and no Firestore document or rule reads
tracks. A client that does not know the field reads the track as one on an
animatable its model lacks, as after a model update removed one: it lists the
track, draws and plays none of it, and keeps the field when it saves the
animation, since a track is stored whole.

## Exact curves

The host injects `store.trackEvaluator`. Studio supplies `@semio/studio-arora`'s
`CompiledTrack`; tests and stories use `testTrackEvaluator`, a test-only resolver
with 64-step bisection. `trackCurve(track, evaluator)` compiles `clipTrackJson(track)`
once per content and evaluator, with up to 512 entries; eviction frees the compiled
curve. Tracks hold their endpoint values before and after their keypoints, including
negative clip-local times. A track curve has no animation duration.

Rows sample all their value segments in one values batch. Violations batch values
and exact velocities at 10 ms world intervals. Endpoint differences also detect a
velocity violation across an interval whose sampled velocities are held values:
its average speed proves some velocity within that interval exceeds the limit.
The instance timescale multiplies local velocities into world velocities. Derived
snapshots and readouts use exact values and velocities; insertion uses the same
compiled curve. Without an evaluator, values and violations are absent, rendering
uses authored Béziers, and insertion preserves its containing segment with a de Casteljau split.
Numeric splits use effective control points and the host's inserted value. Adjacent
inferred handles re-resolve when the inserted key changes their neighbouring key.

Handle pointer time is mapped through `xInverse` into local time before storing
its delta. Thus a timeline delta is multiplied by the instance timescale and value
deltas keep their units. The component and drag-start inference judge pairing in
screen units; `handlePointerDelta` and `handlesWithinSnapTolerance` provide the pure
math exercised by action-level round-trip tests.

## Testing Notes

- Prefer action-level and function-level coverage for gesture-heavy behavior.
- Reuse `src/test-fixtures` so tests and Storybook scenarios stay aligned.
- For UI flows that are hard to test in Vitest browser mode (three.js / react-three/fiber), validate behavior through store action tests and document manual QA in PR notes.

## Editor MVP Checklist

Current status snapshot:

- [x] Correct interpolation methods (cubic-bezier + transition settings)
- [ ] Full handle support
  - [x] Handles on Bezier curves
  - [ ] Hotkey to reset handles to flat
  - [x] Key addition in mid-transitions (use a tangent calculation)
- [ ] Selection
  - [x] Single selection
  - [x] Multi selection (Shift + Click, CTRL + Click)
  - [ ] Box selection (Click + Drag) (?)
- [ ] Move selected keyframes (Click + Drag)
  - [x] Click + Drag
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

## Shared animatable control properties

`AnimatableControl` and its group rows honor `preferences.controlStripMode`, the
same preference as timeline rows. `ControlStripModeToggle` is shared by the editor
and hosts. A host may supply `propertyControls` (the `TrackPropertiesStrip` props)
for direct controls or groups mixing tracked and trackless children; track-backed
rows otherwise retain the editor's source-flag actions.

`AnimatableControlList` accepts `sourceNamespaceId` and `sourceInstanceId` to scope
backing rows explicitly. Passing `sourceInstanceId={null}` excludes all track
associations, including group rows. Without an explicit scope, the list retains
its selection-based behavior. These options keep host-specific entity identity
resolution outside the animation package.

Host-provided property state and callbacks also drive track-row and mixed-group
context menus. A namespace scope without an instance scope includes that
namespace's instances; `sourceInstanceId={null}` explicitly selects direct controls.

## Stored animation compatibility

`classifyAnimationFormat` recognizes absent/1 as normalized v1, 2 as millisecond
v2, and 3 as the current nanosecond format. Every other version is unreadable.
`readStoredAnimation` validates content before conversion; `addAnimation`,
composite migration and the fixture loader use this reader.
`migrateToMillisecondStamps` rescales v1 stamps, preserves v2 content and delegates
v3 conversion to the reader. Its guard also refuses v1 keypoints without numeric
stamps so direct migration cannot invent times. The shared core asset parser
applies the same version and structural checks to persisted bytes. A numeric
version above 3 asks the person to reload Studio. Refused content must not enter the editable
store or a save payload, including when it replaces already-loaded content.

The [engine reference](../conformance/README.md) records exact values and world
velocities for the fixture animations and dedicated semantic cases. Regenerate it
with `npm run conformance:generate --workspace=@semio/animation` from the root.
