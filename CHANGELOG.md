# @semio/animation

## 0.5.0

### Minor Changes

- 3eae826: Curves are evaluated exactly by the host, and Studio strictly reads format 3 and saves format 2.
  - **Evaluation.** A store's `trackEvaluator` (`TrackEvaluator`: `compile(track)` → `CompiledCurve`) evaluates every curve the editor uses: the curves it draws (`polyline`, points on the curve), the value and velocity at the playhead, the values a violation check reads (`numbers`, values and velocities in one batch) and the value a new keypoint takes. `trackCurve(track, evaluator)` gives a track's curve in clip-local milliseconds. An evaluator compiles a track as clip 2.0 plays it: `clipTrackJson(track)` writes its document, and `clipTrackColumns(track, codeOf)` writes a number track's keypoints as columns of numbers, which compile with no text to parse. Without an evaluator rows draw authored Béziers and have no value readouts or violations. Studio passes `@semio/studio-arora`'s `CompiledTrack`, the Arora animation engine its devices play with; `testTrackEvaluator` evaluates in JavaScript for tests and stories.
  - **Storage.** Studio reads formats 1, 2 and 3 and always saves format 2 through `writeAnimationForStorage` (`computeStoredAnimation`, the store save getters and `persistStoredAnimation`). Load/edit/save preserves `inputKey`, handles, every transition kind, negative keypoint times and legacy metadata. Composite values remain representable in format 2.
  - **Format 3.** `writeStoredAnimation` retains the nanosecond writer: safe-integer `timeNs`, handles `{ dtNs, dv }` with safe-integer `dtNs` and finite `dv`, editor metadata and optional `defaultViewportExtentNs`. It stores no length. The reader validates every required field before conversion, refuses v3 `stamp` and x/y handles and v2 `timeNs`, and preserves the unknown-version refusal. Switching the save boundary to write format 3 is a one-line change once clients that read 3 are in production. The framework-free codec is available from `@semio/animation/format`.
  - **Length.** `clipDocument` and device delivery set the engine clip's `lengthNs` using `resolveAnimationDuration`: the latest of the content end, the viewport hint and one second. Filtering tracks does not shorten the whole animation. The player's bounds remain its playback window.
  - **Handles.** A handle dragged on an instance played at a timescale stores the clip-local change that puts it under the pointer (`handlePointerDelta`), so it scales with the timescale exactly as keypoint times do.
  - **Removed.** `toModuleClip`, `moduleClipDuration`, `TrackBaker` and the store's `trackBaker`; the `@semio/animation/module-baker` entry point, and with it the dependency on `@vizij/runtime`; `computeTrackTrajectories` and the trajectory types.

- f286b72: Recorded tracks: the values a key of a device took, over the device's own clock.
  - **`RecordedTrack`** — `{ device, key, points }`, each point `{ stamp, value }` with `stamp` the device's `arora/time` in milliseconds and `value` a scalar. Read-only, keyed by device and key (`RecordedKey`), so a device's input, animation output and feedback, and another device's beside them, sit in one view.
  - **`Recorder`** — records `RecordedKey`s from the changes of a store keyed `<device>/<key>`: a point each time a key's value changes, stamped with its device's clock as the same change or the last before sets it. `capture` has the shape of a `DataStore` listener, `storeKeys` names the keys it reads (each recorded key and each device's `arora/time`), and `tracks()` returns what it holds. Nothing is persisted.

- 6371a2a: The animation package reads no singleton: its values come from the store the host injects and its player comes with its store.
  - **Values.** A direct `AnimatableControl` watches its `valueLookupKey` in the injected `DataStore` (`DataStoreContext` from `@semio/utils`); rendering one without a provider throws. The value a track takes at the playhead is read from its curve in the derived snapshot rather than from values the store wrote, and an editor re-renders when that value changes: the derived orchestrator no longer writes `useValuesStore`, and the deprecated `updateValues`, `updateVelocities` and `setTrackValue` actions are removed.
  - **Player.** `AnimationData.playerStore` is the player the timeline shows and commands. The host passes the one it drives when it creates the store (`createAnimationStore({ playerStore })`; Studio passes `usePlayerStore`); a store created without one has a player of its own (`createPlayerStore()`). Components, actions and subscriptions all read it there, `usePlayerSubscription` included; the actions `skipToStart`, `skipToEnd`, `updateDuration` and `focusSelectionInstance` take the store's getter to reach it.
  - **Namespaces.** The package resolves a namespace's entity with `namespaceEntity` from `@semio/utils` and spells `entityId@instanceId` nowhere.

- a764cdc: A track can animate an input an entity's runtime declares beyond its model: `Track.inputKey` (and `StoredTrack.inputKey`) names that input by its key, the track's `animatableId` being the input's `runtimeInputId`. `createTrack` sets `inputKey` for a track created on such an id, and a stored animation keeps it. `RowNoticeContext` lets a host show a statement beside the name of every track row, from the row's namespace and what it animates; `AnimatableControl` and `TrackControl` take a `notice` beside their label.

### Patch Changes

- b914075: `@semio/animation`, `@semio/scene` and `vizij` declare their `@semio/ui`, `@semio/utils`
  and `vizij` dependencies as caret ranges instead of `*`, so a later breaking release of
  one of them no longer reaches an earlier published version of these packages.
- Updated dependencies [1e272bf]
- Updated dependencies [e3be707]
- Updated dependencies [a26939f]
- Updated dependencies [4bb39a2]
- Updated dependencies [c2738c1]
- Updated dependencies [3db3ee1]
- Updated dependencies [f286b72]
- Updated dependencies [6e59734]
- Updated dependencies [4bb39a2]
- Updated dependencies [544a676]
- Updated dependencies [4bb39a2]
- Updated dependencies [f718bde]
- Updated dependencies [0a439db]
- Updated dependencies [6371a2a]
- Updated dependencies [a764cdc]
- Updated dependencies [f2ebc2d]
  - @semio/ui@0.5.0
  - @semio/utils@0.5.0

## 0.4.0

### Minor Changes

- 0f67e09: Expose host-supplied control properties and shared strip mode, scoped control-list sources, and per-control scene visibility and interaction policy.

### Patch Changes

- 718aa2c: Subscribe the timeline, tracks and minimap canvases to the host's shared render-loop setting from @semio/utils, preserving continuous rendering by default.
- 00a3856: Use shared toolbar segment adjacency styling to keep square shared edges and rounded exposed ends.
- Updated dependencies [59c07f3]
- Updated dependencies [7eafe8d]
- Updated dependencies [68f6c72]
- Updated dependencies [fb2e03d]
- Updated dependencies [1242fdc]
- Updated dependencies [d25b073]
- Updated dependencies [58ee9aa]
- Updated dependencies [5033a08]
- Updated dependencies [4fa327f]
- Updated dependencies [718aa2c]
- Updated dependencies [8101906]
  - @semio/ui@0.4.0
  - @semio/utils@0.4.0

## 0.3.0

### Minor Changes

- 856f872: A numeric animatable's value field shows percentages as 0–100, and every spelling of a unit gets that unit's symbol and icon.
  - **`AnimatableNumberField`** renders a numeric animatable's value as an editable field in the units a person reads. It shows radians in degrees and a percentage's fraction as 0–100, converts the animatable's limits the same way, and hands `onChange` the stored value back. The timeline's direct value editor uses it.
  - **The animatable editor, `getIconCode` and the curve graph's fallback range** use `unitDisplay` from `@semio/utils` in place of their own radian checks.
  - **A flat percentage row** in the curve graph gets the 0..1 range its fraction is stored on.

  Tracks, playback, the curve graph and the effective-motion export keep stored values.

- 87eaee7: Stopping a store's animation subscriptions now stops all of their work, and a host can stop whichever set is current.
  - **`stopAnimationSubscriptions()`** stops the set the latest `initAnimationSubscriptions()` call started. A host disposing a store calls it rather than holding the cleanup the first call returned, since a later call spends that handle.
  - **A cleanup stops its own set, once.** It clears the player interval its set started and drops a playback write already queued, so neither acts on the shared player or values store afterwards. Once a later `initAnimationSubscriptions()` call has replaced its set, running it again does nothing.

- f149ca7: Editor icons use semantic keys and Solar artwork, and playback gains a 0.1× speed.
  - **0.1× playback.** `PlaybackSettings` offers 0.1×, 0.5×, 1×, 1.5× and 2×, each
    with its multiplier glyph (`playback-0.1` … `playback-2.0` from `@semio/ui`).
  - **Speed keys are deprecated, not removed.** `speed-slow`, `speed-normal`,
    `speed-fast` and `speed-fastest` stay registered and resolve to `playback-0.5`,
    `playback-1.0`, `playback-1.5` and `playback-2.0`. Use the new keys; the select
    names them, so an override of a deprecated key no longer reaches it.
  - **New keys** for editor actions, playback (`playback-bounce`,
    `playback-seek-start-bounds` / `-end-bounds`, `move-player-start-bounds`), timeline
    views (`view-*`), easing (`transition-*`) and data types. Start-bound glyphs carry
    their own orientation and compose it with a caller's `style.transform` and
    `mirrored`.
  - **Keys now owned by `@semio/ui`.** `add`, `copy`, `data-binary`, `data-vector2`,
    `data-vector3` and `fit-horizontal` moved to the default registry, so they still
    resolve for any consumer rendering through `@semio/ui`'s registry; only a consumer
    reading them off `animationIconRegistry` directly sees them gone.
  - **`@tabler/icons-react` is no longer a dependency or peer dependency**; nothing in
    this package imports it.
  - `NOTICE` carries the Solar and Tabler attributions and permission texts and lists
    the vendored glyphs this package renders through `@semio/ui`.

  `minor` rather than `major` because the removed speed keys are kept as deprecated
  aliases.

### Patch Changes

- d9b51af: Ship the MIT license text in the package tarball, and make the third-party icon
  attributions in `@semio/ui`'s and `@semio/animation`'s `NOTICE` self-contained.
  The versions on npm declared `"license": "MIT"` while carrying none of its text,
  and the `NOTICE` files referred to a repository-root document that is not in the
  tarball — so `changeset publish` has to cut a release for the fix to reach a
  consumer.
- Updated dependencies [97535c3]
- Updated dependencies [cf826a7]
- Updated dependencies [7ac1802]
- Updated dependencies [81ded72]
- Updated dependencies [e0eaaaa]
- Updated dependencies [fa5efd3]
- Updated dependencies [f60ad86]
- Updated dependencies [f9a9ad1]
- Updated dependencies [9e6378f]
- Updated dependencies [b9fab3b]
- Updated dependencies [f23dbe6]
- Updated dependencies [b0cd78f]
- Updated dependencies [f191a72]
- Updated dependencies [e0b63c1]
- Updated dependencies [1a485fe]
- Updated dependencies [6e3f609]
- Updated dependencies [19a8313]
- Updated dependencies [ca48232]
- Updated dependencies [f2a1653]
- Updated dependencies [57ce815]
- Updated dependencies [7ce8ad5]
- Updated dependencies [bc2c951]
- Updated dependencies [47a771b]
- Updated dependencies [d9b51af]
- Updated dependencies [06a1ef5]
- Updated dependencies [c03d3fe]
- Updated dependencies [da054ab]
- Updated dependencies [af004b1]
- Updated dependencies [2c24c55]
- Updated dependencies [fd54217]
- Updated dependencies [4329e93]
- Updated dependencies [7ff1178]
- Updated dependencies [856f872]
- Updated dependencies [e0baad1]
- Updated dependencies [e24d20a]
- Updated dependencies [e387961]
- Updated dependencies [959b980]
- Updated dependencies [ef61a12]
- Updated dependencies [a64543e]
- Updated dependencies [aa3ee48]
- Updated dependencies [e14141d]
- Updated dependencies [196a346]
- Updated dependencies [69c2ecd]
- Updated dependencies [da5c118]
- Updated dependencies [0050e73]
- Updated dependencies [90d1847]
- Updated dependencies [f149ca7]
- Updated dependencies [75cafdf]
- Updated dependencies [fd54217]
- Updated dependencies [ef61a12]
- Updated dependencies [91d1ed0]
- Updated dependencies [fe7ec2d]
- Updated dependencies [f72e3a7]
- Updated dependencies [34ea216]
- Updated dependencies [856f872]
- Updated dependencies [10cdce0]
- Updated dependencies [e293941]
  - @semio/ui@0.3.0
  - @semio/utils@0.3.0

## 0.2.1

### Patch Changes

- e15f29f: Add third-party icon attribution. Both packages now ship a `NOTICE` file crediting Tabler Icons (MIT) and Solar Icons by 480 Design (CC BY 4.0), satisfying the CC BY 4.0 attribution requirement for the bundled Solar icon designs. See `THIRD-PARTY-NOTICES.md` at the repo root.

## 0.2.0

### Minor Changes

- e5f82d6: Unify the animation timeline viewport and split it into three independent canvases (SEM-114).
  - **@semio/utils** (breaking): removed `Player.viewport` and the per-tick viewport rewrite; `seek()` is now a pure stamp-set and the `updatePlayerViewportCenter` action is gone. Consumers that read `Player.viewport` must move to `@semio/animation`'s `viewportMotion`.
  - **@semio/animation**: viewport state now lives in a module-level `viewportMotion` (`viewport-state.ts`) with a swappable follow-policy subscription; one rendering invariant (fixed scene, moving camera); the HUD portal is replaced by three independent canvases (timeline / tracks / minimap); playhead cart redesigned. `scrollOffset`/`verticalFitCounter` removed from the animation store; `useOrthoCameraSetup` and `hud-section` removed.
  - **@semio/ui**: `menuStateAtom` now defaults to expanded (`true`).

  Bumped `minor` rather than `major` because these packages are pre-1.0 (0.x), where breaking changes ship as a minor per semver convention.

### Patch Changes

- Updated dependencies [e5f82d6]
  - @semio/utils@0.2.0

## 0.1.0

### Minor Changes

- Migrate to React 19 with compiler enabled. Upgrade React Three Fiber to v9, drei to v10, and enable babel-plugin-react-compiler. Fix all TypeScript compatibility issues and add Canvas fade-in for R3F v9 async initialization.

### Patch Changes

- Updated dependencies
  - @semio/utils@0.1.0
  - @semio/ui@0.1.0
