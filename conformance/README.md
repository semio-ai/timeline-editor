# Animation engine reference

These plain JSON cases define the results an animation engine must reproduce.
They contain Studio v2 animations and scalar tracks, with no JavaScript-specific
Map serialization. The generator uses Studio's control-point resolver, not its
track interpolator, so it can run after the interpolator is removed.

## Format

One file per animation and instance setting:

- `animation`: the stored v2 animation, including embedded tracks and groups.
- `instance`: `offset` in world milliseconds, `timescale` as a speed multiplier,
  and `active` (`false` means the instance is muted).
- `samples`: sorted `worldTimeMs` and a `tracks` object keyed by track id. Each
  entry contains `value` and `velocity`. Velocity is value units **per second of
  world time**, matching Studio's velocity consumers. It is `null` for strings
  and booleans. A muted instance, muted track or empty track contributes nothing:
  both fields are `null`. Numeric held values have velocity zero.

Numbers are JSON doubles; consumers should parse and compute with f64. Compare
numeric results with a floating-point tolerance, not decimal text equality.
All numeric outputs must be finite. There are no timestamps or random inputs.

## Rules

1. Solve cubic Bézier time to double precision (64 bisections), then evaluate the
   value analytically. Do not interpolate a baked polyline or stop after twelve
   iterations. Different easing families use Studio's preset control points.
2. The last keypoint plays at its instant, including booleans and strings.
3. Strings and booleans hold the left value between keypoints. At an **interior**
   keypoint's exact instant they still hold the left segment's value, as Studio
   does; immediately after it they play that keypoint's value.
4. Resolve numeric handles in local time using `resolveSegmentControlPoints`:
   presets, inferred auto (`ExplicitHandles` directive), auto-clamped tangents,
   and explicit deltas all pass through Studio's effective clamps. Then map the
   entire curve with `world = local / timescale + offset`. Handle time deltas
   scale by `1 / timescale`; handle value deltas do not scale.
5. Negative local times are evaluated without clamping them to zero. Hold the
   first value before the first keypoint and the last value after the last.
6. Numeric velocity is the analytic derivative `dy/du / dx/du`, multiplied by
   `timescale * 1000` for world seconds. At an interior numeric knot use the left
   segment's derivative. At the first and final instants use the held value's
   zero velocity; these are the inclusive boundaries of the holds. At a collapsed
   control handle use the first nonzero parametric derivative (the limiting
   tangent). Discrete values have no numeric derivative.
7. Offset, speed, track mute and instance mute affect contributions. This corpus
   evaluates each track independently; target arbitration, playback looping,
   transport speed/direction and composition across instances are outside it.
8. All other curve behavior follows Studio. Its control-point resolver remains
   the authority for clamps and inference. Changing that resolver requires review
   of the resulting JSON diff.

## Cases and sampling

The research corpus's `fixtureCorpus()` uses `createTestAnimationStore()`:
`shared-animation`, `namespace-a-animation`, and `namespace-b-animation`. The
same data factories are used here, with composite tracks flattened and v1 times
migrated before recording. Every fixture and dedicated animation is recorded at
speeds 0.5, 1 and 2 with offset 137 ms. Dedicated cases cover strings, the boolean
final knot, asymmetric explicit handles, clamped handles, negative keypoints,
large values with fractional stamps, both inferred directives, all nine easing
presets, a single point and an empty track. Two extra cases exercise mutes.

Each case includes a 257-point uniform grid extending beyond both ends and every
keypoint at its exact world instant and ±0.001 ms. JSON is indented and the complete
set is under 5 MB. Filenames identify the animation and speed.

## Regenerate and verify

From the repository root (dependencies installed):

```sh
npx turbo run build --filter=@semio/utils
npm run conformance:generate --workspace=@semio/animation
```

Or, from `packages/animation`, run `npm run conformance:generate`. The bundled
runner is generated under ignored `dist/conformance`; it needs the utils build,
not an animation build. Two runs on one platform produce byte-identical JSON.
Across platforms a number can differ in its last bit or two, so the test compares
a regeneration with the committed set to a relative 1e-12 rather than as text.
Format generator sources with Prettier; the generator itself deterministically
formats the JSON.

Run `npx vitest run conformance/conformance.test.ts` from `packages/animation`.
The tests compare committed samples with the generator, and numeric speed-1 values
with Studio's interpolator, excluding the final instant, within 8.2e-4 of each
track's range. Separate tests pin the intentional handle, string and final-boolean
differences, negative time and analytic world velocities. The generator and curve
helpers never import `compute-track-interpolator.ts`; only these comparison tests
do. When that implementation is deleted, replace the comparison tests with the
new engine's reader of these JSON files.
