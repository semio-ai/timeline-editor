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
- **a baker** (`trackBaker` on the store), which draws each track's curve from
  the Vizij animation module, the only evaluator of a curve. Studio bakes on an
  emulated device of its own; a page with no device attaches the module this
  package bundles.

```tsx
import { AnimationContext, AnimationSheet, createAnimationStore } from "@semio/animation";
import { attachModuleBaker } from "@semio/animation/module-baker";
import { createValuesStore, DataStoreContext, valuesDataStore } from "@semio/utils";

const store = createAnimationStore();
const values = valuesDataStore(createValuesStore());

export function Editor() {
  useEffect(() => attachModuleBaker(store), []);
  return (
    <DataStoreContext.Provider value={values}>
      <AnimationContext.Provider value={store}>
        <AnimationSheet /* viewId, theme, fonts, … */ />
      </AnimationContext.Provider>
    </DataStoreContext.Provider>
  );
}
```

`attachModuleBaker` runs the module in the page through `@vizij/runtime`
(25 MB of wasm, 7 MB compressed, fetched on the first bake). It lives on its own
entry point, `@semio/animation/module-baker`, so a host that bakes elsewhere
never bundles it. Without a baker, curves are drawn from their authored Béziers
and tracks have no values or violations.

Playback and viewport are decoupled: pan / zoom / playhead-follow are driven by
motion values independent of the player tick, so the timeline follows the
playhead smoothly without re-rendering the React tree on every frame.

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

## License

MIT
