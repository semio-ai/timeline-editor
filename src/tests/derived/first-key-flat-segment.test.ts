import { describe, expect, test } from "vitest";
import { createDefaultState } from "../../actions/create-default-state";
import { insertKeypointAtWorldStamp } from "../../actions/insert-keypoint-at-stamp";
import { buildDerivedSnapshot, materializeSegmentSample } from "../../functions";
import { LayerBand, TrackRender, type SourceRow } from "../../types";

describe("single-key derived segment rendering", () => {
  test("renders a value-flat spline segment after inserting the first key into an empty track", () => {
    const state = createDefaultState();

    const animationId = "anim";
    const namespaceId = "ns";
    const instanceId = "inst";
    const trackId = "track";
    const animatableId = "animatable";
    const rowId = "row";
    const defaultValue = 3;
    const worldStamp = 0.37;

    state.animatables[animatableId] = {
      id: animatableId,
      name: "Animatable",
      type: "number",
      default: defaultValue,
      constraints: { min: -10, max: 10 },
    };

    state.tracks[trackId] = {
      id: trackId,
      name: "Track",
      animatableId,
      points: [],
    };

    state.animations[animationId] = {
      id: animationId,
      name: "Animation",
      duration: 1000,
      tracks: [trackId],
      groups: [],
    };

    state.namespaces[namespaceId] = {
      id: namespaceId,
      name: "Namespace",
      animationInstances: {
        [instanceId]: {
          id: instanceId,
          animationId,
          settings: { active: true, offset: 0, timescale: 1 },
        },
      },
    };

    const sourceRow: SourceRow = {
      id: rowId,
      data: [
        {
          selectable: true,
          editable: true,
          layerBand: LayerBand.ForegroundSelected,
          animationId,
          namespaceId,
          instanceId,
          type: "number",
          trackId,
          animatableId,
        },
      ],
    };
    state.instancedTrackSources[rowId] = sourceRow;

    const inserted = insertKeypointAtWorldStamp(state, trackId, worldStamp, instanceId);
    expect(inserted).toBeTruthy();
    expect(inserted?.value).toBe(defaultValue);

    const snapshot = buildDerivedSnapshot({
      tracks: state.tracks,
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      instancedTrackSources: state.instancedTrackSources,
      dragState: state.dragState,
      selectionState: state.selectionState,
    });

    const row = snapshot.rows[rowId]?.computed;
    expect(row).toBeTruthy();

    const marker = row?.render?.markers.find((entry) => entry.id === inserted?.id);
    expect(marker?.value).toBe(defaultValue);

    const segment = row?.render?.segments.find((entry) => entry.trackId === trackId);
    expect(segment).toBeTruthy();

    const splineSample = segment?.samples[TrackRender.Spline];
    expect(splineSample).toBeTruthy();

    const materialized = splineSample
      ? materializeSegmentSample(splineSample, snapshot.renderSampleCache)
      : null;
    expect(materialized).toBeTruthy();

    const points = materialized?.points ?? new Float32Array();
    const stride = materialized?.stride ?? 2;
    expect(points.length).toBeGreaterThanOrEqual(4);

    const ys: number[] = [];
    for (let i = 1; i < points.length; i += stride) {
      ys.push(points[i]);
    }

    expect(ys.length).toBeGreaterThan(0);
    ys.forEach((y) => {
      expect(y).toBeCloseTo(defaultValue, 6);
    });
  });
});
