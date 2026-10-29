# @semio/timeline-editor

Higher-level visualization and editing components for animating assets — a
canvas-based timeline editor (`AnimationSheet`) plus the track/keyframe controls
and motion primitives it's built from. Rendered with
[react-three-fiber](https://docs.pmnd.rs/react-three-fiber), themed with
[`@semio/ui`](https://www.npmjs.com/package/@semio/ui).

## Installation

```bash
npm install @semio/timeline-editor
```

Brings `@semio/ui`, `@semio/utils` and `@semio/data`
along as dependencies.

## Development and Storybook

Semio Studio mounts this repository as a git submodule at `packages/timeline-editor` and develops it
from source there. Run these commands from this package's root in either checkout:

```sh
npm ci
npm run storybook        # http://localhost:6008
npm run build-storybook  # storybook-static/
npm run typecheck
npm run lint
npm run test
npm run test:release
npm run build
```

Package-root checks use the existing `dist` exports of `@semio/utils`, `@semio/data` and `@semio/ui`.
In a standalone clone, npm installs those builds. Inside Studio, build the linked
siblings first so checks use their latest edits. From Studio's root, run
`npx turbo run lint typecheck test:unit build --filter=@semio/timeline-editor` to build
dependencies before running the package's checks and reuse cached builds.

Stories live in `stories/`; `.storybook/` supplies the light/dark toolbar and the
library's default theme. Storybook aliases only `@semio/timeline-editor` to `src/index.tsx`.
Other `@semio/*` dependencies resolve to their installed `dist` exports. npm
releases include those builds. With workspace links in Studio, build dependencies
first: from Studio's root, `npx turbo run storybook --filter=@semio/timeline-editor` or
`npx turbo run build-storybook --filter=@semio/timeline-editor` does that automatically
and reuses cached builds. Stop the dev server with Ctrl-C before handoff.
Storybook is separate from `npm run build`.

A changeset for this library belongs in this repository's `.changeset/`. Inside Studio's
mount, the changesets CLI resolves to Studio's workspace root and writes into Studio's
`.changeset/` instead, which Studio's CI rejects. There, write the file by hand under
`packages/timeline-editor/.changeset/`, or run `npx changeset` from a standalone clone.

## Usage

The host hands the sheet three things:

- **the animation store** (`AnimationContext`), created with the player the
  timeline shows and commands (`createAnimationStore({ playerStore })`; one
  created without one has a player of its own);
- **the values store** (`DataStoreContext` from `@semio/data`), Arora's data
  store interface, which the direct controls read;
- **an evaluator** (`trackEvaluator` on the store), whose `compile(trackJson)`
  returns a `CompiledCurve` with batched values and velocities. Studio injects
  `@semio/studio-arora`'s compiled tracks. Hosts own the evaluator's initialization.

```tsx
import { useState } from "react";
import { AnimationContext, AnimationSheet, createAnimationStore } from "@semio/timeline-editor";
import type { TrackEvaluator } from "@semio/timeline-editor";

export function Editor({ evaluator }: { evaluator: TrackEvaluator }) {
  const [store] = useState(() => createAnimationStore({ trackEvaluator: evaluator }));
  return (
    <AnimationContext.Provider value={store}>
      <AnimationSheet /* viewId, theme, fonts, … */ />
    </AnimationContext.Provider>
  );
}
```

An evaluator compiles a track as clip 2.0 plays it: `clipTrackJson` emits its
document, the one Studio's World delivers, and `clipTrackColumns` a number track's
keypoints as columns of numbers, which compile with no text to parse. Values and velocities are evaluated exactly in clip-local milliseconds;
number velocities are in value units per second. A row draws a number track from
the evaluator's `polyline`, points on the curve, and a violation check reads values
and velocities from one `numbers` batch. A cache compiles a track once
per evaluator (a frozen track found again by identity, any other by its document)
and frees its compiled resource on eviction. Without an
evaluator, rows draw authored Béziers and have no readouts or violations.

## Playback

`usePlayerStore` holds the shared transport state under `s.player` (`stamp`,
`running`, `duration`, all in **milliseconds**). A store created without a
`playerStore` has a player of its own.

```ts
import { usePlayerStore } from "@semio/timeline-editor";

// Read transport state in a component (state lives under `s.player`)
const stamp = usePlayerStore((s) => s.player.stamp); // milliseconds
const running = usePlayerStore((s) => s.player.running);

// Drive playback via store actions
usePlayerStore.getState().playPlayer();
usePlayerStore.getState().pausePlayer();
usePlayerStore.getState().resetPlayer(2500); // jump to t = 2500ms
```

## Animation content

Studio reads formats 1, 2 and 3 and writes format 2 through
`writeAnimationForStorage` (also exported as `computeStoredAnimation`, used by
the store's save getters and `persistStoredAnimation`). This keeps saves readable
by deployed millisecond clients, including tracks with `inputKey` and legacy
composite values. `StoredAnimation` names the embedded millisecond model.

`PersistedAnimation` describes format 3: clip 2.0's document plus editor metadata,
with safe-integer `timeNs`, handles `{ dtNs, dv }` (safe-integer nanoseconds and
finite value deltas), and optional `defaultViewportExtentNs`. It stores no length.
`readStoredAnimation` checks required fields before conversion and refuses duplicate
track ids in every format. Formats 1 (including an absent version) and 2 require
finite `stamp`, a defined value (including composites or null), and named
transitions or finite `{ x, y }` handles; `timeNs` and `{ dtNs, dv }` handles are
refused. Optional legacy transitions and sides may be null or absent, pairing and
settings contents remain permissive, and a null/absent format-1 duration defaults
to 5000 ms. Format 3 refuses `stamp`, x/y handles, null transitions, invalid pairing
and malformed optional metadata, and requires finite scalar values of one kind
per track. Unsupported versions are refused before tracks are read. The validator
`isStoredAnimationContent` documents the complete requirements per format.
Framework-free persistence APIs are available from `@semio/timeline-editor/format`.

`writeStoredAnimation` retains the format-3 writer; switching the save boundary to
it is a one-line change once clients that read format 3 are in production. It
rounds stamps and handle time deltas to whole nanoseconds, and throws if a time,
viewport hint or handle delta cannot be written as a safe integer. It refuses
invalid transitions, unresolved composite values and any document its reader
would reject, so handles cannot silently disappear from a save.
Muted state is runtime-only; colours, input keys, group names, groups and viewport
extent persist. `clipDocument` prepares a clip to play with `lengthNs` resolved by
`resolveAnimationDuration`: the latest of the content's end, the viewport hint and
one second. Device delivery uses the same rule for the whole animation even when
some tracks are filtered out. Engine clips and track evaluation (`clipTrackJson` and `clipTrackColumns`)
keep fractional handle nanoseconds so v2 curves retain their exact geometry.
A track evaluated alone has no clip duration. Effective-motion export carries keys and
handles in milliseconds and has no engine clip length.

Playback and viewport are decoupled: pan / zoom / playhead-follow are driven by
motion values independent of the player tick, so the timeline follows the
playhead smoothly without re-rendering the React tree on every frame.

## Canvas render loop

The timeline, tracks and minimap render every frame by default
(`frameloop="always"`). Hosts can choose `CanvasFrameloop.Demand` through
`setCanvasFrameloop()` from `@semio/utils`, which also controls `@semio/scene`.
All three canvases subscribe to the setting, including while mounted. The
host must schedule R3F's global `invalidate()` to keep continuous behavior
running in demand mode; this package starts no timer. See the
[shared API](https://github.com/semio-ai/semio-utils/blob/main/README.md#canvas-render-loop).

## What's inside

All re-exported from the package root:

- **`AnimationSheet`** / `AnimationSheetCore` — the full timeline editor (ruler,
  tracks, minimap) across three independent canvases.
- **`AnimatableControl`** / `AnimatableControlList` / `TrackControl` / `KeyStrip`
  — per-track and per-keyframe editing controls.
- **`MotionCubicBezierLine`** / `MotionCubicBezierFill` — animated curve
  primitives.
- **Hooks** — viewport, key-control, and edge-scroll helpers for composing
  custom animation UIs.

## Effective motion export

`exportEffectiveMotion(animation, tracks, animatables)` produces a versioned,
robot-neutral JSON object from the loaded animation. Each channel uses the
animatable's public `output` and `units`, and each key contains its time and
value plus the effective incoming and outgoing handle offsets. Offsets are
relative to the key, in milliseconds and channel units. The function resolves
easing directives, inferred handles, and playback clamps through the same
segment resolver used by the interpolator. A middle key may therefore have
independent incoming and outgoing handles.

The JSON contract is:

```json
{
  "format": "semio-effective-motion",
  "version": 1,
  "animationName": "Look around",
  "timeBasis": "animation-local",
  "timeUnit": "ms",
  "channels": [
    {
      "output": "HeadYaw",
      "units": "rad",
      "keys": [
        { "timeMs": 0, "value": 0, "out": { "deltaTimeMs": 300, "deltaValue": 0 } },
        { "timeMs": 900, "value": 0.4, "in": { "deltaTimeMs": -300, "deltaValue": 0 } }
      ]
    }
  ]
}
```

Each segment is formed by one key's `out` and the next key's `in`; only the
first `in` and last `out` are absent. The first key can occur at zero, so a
NAOqi converter must shift key times to positive seconds before calling
`angleInterpolationBezier`. Its incoming and outgoing handle arrays correspond
to these two fields respectively, with offsets relative to each key. Verify
the target NAOqi version's handle mode and joint limits before robot execution.

The times are local to the animation asset. Instance offset and timescale are
applied only when that asset is placed in a scene. Muted, empty, and private
tracks are omitted. Public tracks with missing output metadata, duplicate
outputs, nonnumeric channels, non-finite curve geometry, and simultaneous keys
cause an explicit error so the file cannot silently name the wrong joint or
describe a different curve.
Legacy v1 files are migrated to millisecond stamps when loaded; the export
function accepts the resulting runtime animation rather than a raw stored file.

Toolbar sections use the shared UI `toolbar-segments` style for 2px gaps, square
shared edges and rounded exposed ends. Section outlines remain on the group.

## Engine conformance

The [animation engine reference](conformance/README.md) contains deterministic
v2 JSON cases, exact samples and world velocities for a replacement engine.
Regenerate from this package's root with `npm run conformance:generate`.
In Studio, build workspace dependencies first with
`npx turbo run build --filter=@semio/utils --filter=@semio/data` from Studio's root.
Stored animations with unknown format versions are refused before migration or
editing; newer versions ask the person to reload Studio.

`@semio/timeline-editor/format` exposes the version classifier, refusal error and guard
without initializing the editor store or loading its UI.

## Releasing

Add a changeset for each pull request that changes the published package. Changesets opens
a Version Packages PR for the next version. Staging does not wait for that PR: every main
run stages the current version when npm has not published it and neither `staged/v<version>`
nor `v<version>` exists on origin, even with pending changesets.

The build uses the version commit: the latest first-parent commit on main changing the
`package.json` version line, whose version must match the current version. A merge commit
merging a Version PR counts as that commit. Its own worktree and `npm ci` keep later code
and Changesets branch handling out of the build. Successful staging creates an annotated
`staged/v<version>` there. A maintainer approves it with 2FA on npmjs.com → package → Staged
Packages, or with `npm stage approve <id>`. The next run validates each marker's ancestry
on main and package version, tags `v<version>` at its commit after npm reports publication,
and deletes the marker. An unapproved annotated marker older than seven days warns with
approval or cleanup instructions. A published current version missing both tags gets its
`v<version>` at the version commit, including when the marker push failed.

Runs happen daily, on main pushes, or by manual dispatch on main. GitHub disables public
schedules after 60 days without activity; after that, use a main push or dispatch.

A rejected version may not be stageable again under the same number; npm's documentation
does not say. Restage by bumping the version with another changeset, and delete the rejected
version's `staged/v<version>` tag from origin.

## License

Apache-2.0
