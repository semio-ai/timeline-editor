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

`clipTrackJson` emits the clip 2.0 track document both the evaluator and Studio's
World read. Values and velocities are evaluated exactly in clip-local milliseconds;
number velocities are in value units per second. A content-keyed cache compiles a
track once per evaluator and frees its compiled resource on eviction. Without an
evaluator, rows draw authored Béziers and have no readouts or violations.

## Animation content

Persistence writes format 3: clip 2.0's document in integer nanoseconds plus editor
metadata. `writeStoredAnimation` (also exported as `computeStoredAnimation`) writes
it from an `Animation` and a track map. `PersistedAnimation` names those bytes;
`StoredAnimation` names the embedded millisecond model returned by
`readStoredAnimation`. The reader accepts formats 1, 2 and 3 and rejects unsupported
versions before inspecting tracks. Framework-free persistence APIs are also available
from `@semio/animation/format`.

Every saved point must be scalar. Composite migration requires its animatable's
schema; an unresolved composite is refused by the writer. Invalid transition names
and non-finite handles play as the default cubic and are omitted from the document.
Muted state is runtime-only; colours, input keys, group names, groups and viewport
extent persist. `lengthNs` is the resolved editor duration (content extent, viewport
extent or 1000 ms, whichever is greatest).

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
