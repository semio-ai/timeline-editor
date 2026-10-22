# @semio/animation

Higher-level visualization and editing components for animating assets — a
canvas-based timeline editor (`AnimationSheet`) plus the track/keyframe controls
and motion primitives it's built from. Rendered with
[react-three-fiber](https://docs.pmnd.rs/react-three-fiber), themed with
[`@semio/ui`](https://www.npmjs.com/package/@semio/ui).

## Installation

```bash
npm install @semio/animation
```

Brings `@semio/ui` and `@semio/utils`
along as dependencies.

## Usage

The host hands the sheet three things:

- **the animation store** (`AnimationContext`), created with the player the
  timeline shows and commands (`createAnimationStore({ playerStore })`; one
  created without one has a player of its own);
- **the values store** (`DataStoreContext` from `@semio/utils`), Arora's data
  store interface, which the direct controls read;
- **an evaluator** (`trackEvaluator` on the store), whose `compile(trackJson)`
  returns a `CompiledCurve` with batched values and velocities. Studio injects
  `@semio/studio-arora`'s compiled tracks. Hosts own the evaluator's initialization.

```tsx
import { useState } from "react";
import { AnimationContext, AnimationSheet, createAnimationStore } from "@semio/animation";
import type { TrackEvaluator } from "@semio/animation";

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
Framework-free persistence APIs are available from `@semio/animation/format`.

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
[shared API](../utils/README.md#canvas-render-loop).

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

## License

MIT
