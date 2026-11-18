import type { DerivedSnapshot, RenderSampleCache, SegmentSample } from "../types";

export interface MaterializedSegmentSample {
  points: Float32Array;
  stride: 2 | 3;
}

export function materializeSegmentSample(
  sample: SegmentSample,
  cache?: RenderSampleCache,
): MaterializedSegmentSample | null {
  if (sample.kind === "direct") {
    return { points: sample.points, stride: sample.stride };
  }

  if (!cache) return null;
  const cached = cache.samples[sample.sampleId];
  if (!cached) return null;

  const stride = cached.stride;
  const pointCount = Math.floor(cached.points.length / stride);
  const startIndex = Math.max(0, Math.min(sample.range.startIndex, pointCount));
  const endIndex = Math.max(startIndex, Math.min(sample.range.endIndex, pointCount));
  const count = endIndex - startIndex;
  const points = new Float32Array(count * stride);
  const { scaleX, scaleY, offsetX, offsetY } = sample.transform;

  // Range indices are in points; transform applies in sample space before row scaling.
  for (let i = 0; i < count; i += 1) {
    const srcOffset = (startIndex + i) * stride;
    const dstOffset = i * stride;
    points[dstOffset] = cached.points[srcOffset] * scaleX + offsetX;
    points[dstOffset + 1] = cached.points[srcOffset + 1] * scaleY + offsetY;
    if (stride === 3) {
      points[dstOffset + 2] = cached.points[srcOffset + 2];
    }
  }

  return { points, stride };
}

/**
 * The cached samples one row's segments point to, by id.
 *
 * A renderer that read the whole cache would change with every build, since
 * each build makes a new cache. A row the build kept carries the same sample
 * objects into the new cache, so this subset is shallow-equal from one build
 * to the next exactly when the row's drawing did not change.
 */
export function rowRenderSamples(
  snapshot: DerivedSnapshot | undefined,
  rowId: string,
): RenderSampleCache["samples"] {
  const subset: RenderSampleCache["samples"] = {};
  const samples = snapshot?.renderSampleCache?.samples;
  if (!samples) return subset;
  snapshot.rows[rowId]?.computed.render?.segments.forEach((segment) =>
    Object.values(segment.samples).forEach((sample) => {
      if (sample?.kind === "shared" && samples[sample.sampleId]) {
        subset[sample.sampleId] = samples[sample.sampleId];
      }
    }),
  );
  return subset;
}
