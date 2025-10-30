import type { RawValue } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import type { ValueScale } from "../../types";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getNumericValue = (value: RawValue, path?: string[]): number | undefined => {
  if (!path || path.length === 0) {
    return typeof value === "number" ? value : undefined;
  }

  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "number" ? current : undefined;
};

const setNumericValue = (value: RawValue, nextValue: number, path?: string[]): RawValue => {
  if (!path || path.length === 0) {
    return nextValue as RawValue;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    const index = Number(path[0]);
    if (Number.isNaN(index) || index < 0 || index >= value.length) {
      return value;
    }

    const cloned = value.slice();
    cloned[index] = setNumericValue(cloned[index] as RawValue, nextValue, path.slice(1));
    return cloned as unknown as RawValue;
  }

  const clone = { ...(value as unknown as Record<string, unknown>) };
  const [head, ...tail] = path;

  if (tail.length === 0) {
    clone[head] = nextValue;
  } else {
    const nextContainer = clone[head] ?? (Number.isNaN(Number(tail[0])) ? {} : ([] as unknown[]));
    clone[head] = setNumericValue(nextContainer as RawValue, nextValue, tail);
  }

  return clone as unknown as RawValue;
};

const applyPrecision = (value: number, valueScale?: ValueScale): number => {
  if (!valueScale?.precision && valueScale?.precision !== 0) {
    return value;
  }
  const factor = 10 ** valueScale.precision;
  return Math.round(value * factor) / factor;
};

const clampValue = (
  value: number,
  bounds: { min: number; max: number } | undefined,
  valueScale?: ValueScale,
): number => {
  if (!valueScale?.clamp) {
    return value;
  }

  if (bounds) {
    return Math.min(bounds.max, Math.max(bounds.min, value));
  }

  if (valueScale?.domain) {
    return Math.min(valueScale.domain[1], Math.max(valueScale.domain[0], value));
  }

  return value;
};

interface MarkerContext {
  attributePath?: string[];
  bounds?: { min: number; max: number };
}

const buildMarkerContextLookup = (state: AnimationData): Map<string, MarkerContext> => {
  const lookup = new Map<string, MarkerContext>();
  for (const computed of Object.values(state.computedRowData)) {
    if (!computed) continue;
    const bounds = computed.verticalBounds;

    for (const frame of computed.virtualFrames) {
      for (const point of frame.points) {
        const key = `${point.trackId}:${point.id}`;
        if (lookup.has(key)) continue;
        lookup.set(key, {
          attributePath: point.attribute ? [point.attribute] : undefined,
          bounds,
        });
      }
    }
  }
  return lookup;
};

/**
 * Commit the current drag operation, applying all changes.
 * This uses the ID-based architecture to avoid stale data issues.
 *
 * @param state - The animation state to modify
 */
export function commitDrag(state: AnimationData): void {
  const dragState = state.dragState;
  if (!dragState) {
    return;
  }

  const selection = state.selectionState;
  if (!selection.instanceId || selection.instanceId !== dragState.instanceId) {
    state.dragState = undefined;
    return;
  }

  const anchorTrackSelection = selection.keypoints.get(dragState.anchor.trackId);
  if (!anchorTrackSelection?.has(dragState.anchor.keypointId)) {
    state.dragState = undefined;
    return;
  }

  const rawStampDelta =
    dragState.axis === "horizontal" || dragState.axis === "both"
      ? (dragState.stampDelta?.snapped ?? dragState.stampDelta?.raw)
      : undefined;
  const stampDelta =
    typeof rawStampDelta === "number" && Number.isFinite(rawStampDelta) ? rawStampDelta : undefined;

  const rawValueDelta =
    dragState.axis === "vertical" || dragState.axis === "both"
      ? dragState.normalizedValueDelta
      : undefined;

  const normalizedValueDelta =
    typeof rawValueDelta === "number" && Number.isFinite(rawValueDelta) ? rawValueDelta : undefined;

  const hasVerticalDelta = normalizedValueDelta !== undefined;
  const hasHorizontalDelta = typeof stampDelta === "number";

  if (!hasHorizontalDelta && !hasVerticalDelta) {
    state.dragState = undefined;
    return;
  }

  const markerContexts = hasVerticalDelta ? buildMarkerContextLookup(state) : undefined;
  const anchorValueScale = dragState.anchor.valueScale;

  for (const [trackId, keypointIds] of selection.keypoints.entries()) {
    if (keypointIds.size === 0) continue;

    const track = state.tracks[trackId];
    if (!track) continue;

    let trackMutated = false;

    for (const keypointId of keypointIds) {
      const pointIndex = track.points.findIndex((point) => point.id === keypointId);
      if (pointIndex === -1) {
        continue;
      }

      const point = track.points[pointIndex];
      let nextStamp = point.stamp;
      let nextValue = point.value;
      let pointChanged = false;

      if (hasHorizontalDelta) {
        const candidate = clamp01(point.stamp + (stampDelta ?? 0));
        if (candidate !== point.stamp) {
          nextStamp = candidate;
          pointChanged = true;
        }
      }

      if (hasVerticalDelta && markerContexts && normalizedValueDelta !== undefined) {
        const contextKey = `${trackId}:${keypointId}`;
        const context = markerContexts.get(contextKey);
        const attributePath = context?.attributePath ?? dragState.anchor.attributePath;
        const bounds =
          context?.bounds ??
          (anchorValueScale?.domain
            ? { min: anchorValueScale.domain[0], max: anchorValueScale.domain[1] }
            : undefined);

        const current = getNumericValue(nextValue, attributePath);
        if (typeof current === "number") {
          const domainRange =
            anchorValueScale?.domain !== undefined
              ? anchorValueScale.domain[1] - anchorValueScale.domain[0]
              : undefined;
          const verticalRange = bounds ? bounds.max - bounds.min : domainRange;
          const appliedRange =
            typeof verticalRange === "number" &&
            Number.isFinite(verticalRange) &&
            verticalRange !== 0
              ? verticalRange
              : 1;

          const valueDelta = normalizedValueDelta;
          let candidate = current + valueDelta * appliedRange;
          candidate = clampValue(candidate, bounds, anchorValueScale);
          candidate = applyPrecision(candidate, anchorValueScale);

          if (candidate !== current) {
            nextValue = setNumericValue(nextValue, candidate, attributePath);
            pointChanged = true;
          }
        }
      }

      if (pointChanged) {
        track.points[pointIndex] = {
          ...point,
          stamp: nextStamp,
          value: nextValue,
        };
        trackMutated = true;
      }
    }

    if (trackMutated && hasHorizontalDelta) {
      track.points.sort((a, b) => a.stamp - b.stamp);
    }
  }

  state.dragState = undefined;
}
